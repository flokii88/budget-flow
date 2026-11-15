import { useState, useMemo } from 'react'
import Modal from '@/components/ui/Modal'
import { createTransaction } from '@/lib/sync'
import { useTransactions, QUERY_KEYS } from '@/lib/queries'
import {
  RECONCILIATION_LABEL,
  RECONCILIATION_TYPE,
  RECONCILIATION_CATEGORY,
} from '@/lib/constants'
import { useQueryClient } from '@tanstack/react-query'
import {
  formatCurrency,
  getCurrencySymbol,
  dateToMois,
} from '@/lib/utils'
import { Scale, CheckCircle2 } from 'lucide-react'
import { useTranslation } from '@/i18n'

interface ReconciliationModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

const getTodayDateStr = () => {
  const d = new Date()
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

export default function ReconciliationModal({
  open,
  onClose,
  onSuccess,
}: ReconciliationModalProps) {
  const { t } = useTranslation()
  const [bankBalanceInput, setBankBalanceInput] = useState('')
  const [reconcilDate, setReconcilDate] = useState(getTodayDateStr)

  const queryClient = useQueryClient()
  const { data: transactions = [] } = useTransactions()

  // Solde actuel cumulé
  const currentBalance = useMemo(() => {
    const credits = transactions.reduce((acc, t) => acc + (t.credit || 0), 0)
    const debits = transactions.reduce((acc, t) => acc + (t.debit || 0), 0)
    return credits - debits
  }, [transactions])

  const cleanedInput = bankBalanceInput.replace(/\s/g, '').replace(',', '.')
  const parsedBankBalance = parseFloat(cleanedInput)
  const hasEntered = !isNaN(parsedBankBalance) && bankBalanceInput.trim() !== ''

  const discrepancy = hasEntered
    ? Math.round((parsedBankBalance - currentBalance) * 100) / 100
    : 0
  const isSynchronized = hasEntered && Math.abs(discrepancy) < 0.005
  const isPositive = discrepancy > 0

  const handleConfirm = async () => {
    if (!hasEntered || isSynchronized) return

    const d = reconcilDate.trim() || getTodayDateStr()

    await createTransaction({
      date: d,
      mois: dateToMois(d),
      libelle_simplifie: RECONCILIATION_LABEL,
      libelle_operation: RECONCILIATION_LABEL,
      categorie: RECONCILIATION_CATEGORY,
      type: RECONCILIATION_TYPE,
      debit: isPositive ? 0 : Math.abs(discrepancy),
      credit: isPositive ? discrepancy : 0,
    })
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.transactions })

    onSuccess?.()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={t('reconcil.title')} size="lg">
      <div className="space-y-5">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('reconcil.desc')}
        </p>

        {/* Comparatif visuel */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-800 space-y-1">
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {t('reconcil.appBalance')}
            </span>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(currentBalance)}
            </p>
            <p className="text-[11px] text-gray-400">
              {t('reconcil.basedOnTx', { count: transactions.length })}
            </p>
          </div>

          <div className="p-3.5 bg-primary-50 dark:bg-primary-950/20 rounded-xl border border-primary-100 dark:border-primary-900/40 space-y-1">
            <label className="text-[11px] font-semibold text-primary-700 dark:text-primary-300 uppercase tracking-wider block">
              {t('reconcil.bankBalanceLabel')}
            </label>
            <div className="relative">
              <input
                type="text"
                autoFocus
                placeholder={t('reconcil.bankBalancePlaceholder')}
                value={bankBalanceInput}
                onChange={e => setBankBalanceInput(e.target.value)}
                className="input py-1.5 px-3 font-bold text-lg text-primary-900 dark:text-primary-100 placeholder:text-gray-400"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">
                {getCurrencySymbol()}
              </span>
            </div>
            <p className="text-[10px] text-primary-600 dark:text-primary-400">
              {t('reconcil.bankBalanceHint')}
            </p>
          </div>
        </div>

        {/* Résultat de l'analyse */}
        {hasEntered && (
          <div className="space-y-3 animate-fade-in">
            {isSynchronized ? (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-3 text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                <div className="text-xs">
                  <span className="font-bold">{t('reconcil.synchronized')}</span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Scale className="w-5 h-5 text-amber-500 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                        {t('reconcil.discrepancyDetected', { sign: isPositive ? '+' : '', amount: formatCurrency(discrepancy) })}
                      </span>
                      <p className="text-[11px] text-amber-700 dark:text-amber-400">
                        {isPositive
                          ? t('reconcil.willCreateCredit', { amount: formatCurrency(Math.abs(discrepancy)) })
                          : t('reconcil.willCreateDebit', { amount: formatCurrency(Math.abs(discrepancy)) })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Paramètres de la transaction d'ajustement */}
                <div className="pt-2 border-t border-amber-200 dark:border-amber-900/60 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                      {t('reconcil.dateLabel')}
                    </label>
                    <input
                      type="text"
                      value={reconcilDate}
                      onChange={e => setReconcilDate(e.target.value)}
                      placeholder="DD/MM/YYYY"
                      className="input text-xs py-1.5 px-2.5 font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                      {t('tx.colLabel')}
                    </label>
                    <input
                      type="text"
                      value={RECONCILIATION_LABEL}
                      readOnly
                      disabled
                      className="input text-xs py-1.5 px-2.5 font-medium bg-gray-100 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                      {t('tx.colType')} / {t('tx.colCategory')}
                    </label>
                    <input
                      type="text"
                      value={RECONCILIATION_CATEGORY}
                      readOnly
                      disabled
                      className="input text-xs py-1.5 px-2.5 font-medium bg-gray-100 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <button onClick={onClose} className="btn-secondary text-xs">
            {t('common.cancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!hasEntered || isSynchronized}
            className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            <Scale className="w-3.5 h-3.5" />
            {t('reconcil.confirmBtn')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
