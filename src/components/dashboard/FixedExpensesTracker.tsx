import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  Receipt,
  CheckCircle2,
  Clock,
  Link2,
  Unlink,
  Search,
  ChevronDown,
  ChevronUp,
  Settings,
} from 'lucide-react'
import { FixedExpense, Transaction } from '@/lib/types'
import { useFixedExpenses, useBudgetRules, QUERY_KEYS } from '@/lib/queries'
import { DEFAULT_BUDGET_RULES, RECONCILIATION_TYPE } from '@/lib/constants'
import { updateTransactionPB } from '@/lib/sync'
import { computeFixedExpensesStatus } from '@/lib/fixedExpensesMatching'
import { formatCurrency } from '@/lib/utils'
import Modal from '@/components/ui/Modal'
import { useTranslation } from '@/i18n'

interface FixedExpensesTrackerProps {
  transactions: Transaction[]
  selectedMonth: string
}

export default function FixedExpensesTracker({
  transactions,
  selectedMonth,
}: FixedExpensesTrackerProps) {
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const { data: fixedExpenses = [] } = useFixedExpenses()
  const { data: budgetRules = DEFAULT_BUDGET_RULES } = useBudgetRules()

  const [expanded, setExpanded] = useState(true)
  const [linkingExpense, setLinkingExpense] = useState<FixedExpense | null>(null)
  const [txSearch, setTxSearch] = useState('')
  const [savingLink, setSavingLink] = useState(false)

  const tolerance = budgetRules.fixed_match_tolerance ?? 0

  const summary = useMemo(
    () =>
      computeFixedExpensesStatus(
        fixedExpenses,
        transactions,
        selectedMonth,
        tolerance
      ),
    [fixedExpenses, transactions, selectedMonth, tolerance]
  )

  // Transactions du mois éligibles au rapprochement manuel (débits non ignorés)
  const monthDebitTransactions = useMemo(() => {
    const matchedTxIds = new Set(
      summary.items
        .map(i => i.matchedTransaction?.id)
        .filter((id): id is string => Boolean(id))
    )

    const list = transactions.filter(
      t => t.mois === selectedMonth && !t.ignore_dashboard && t.type !== RECONCILIATION_TYPE && Number(t.debit) > 0
    )

    const q = txSearch.trim().toLowerCase()
    const filtered = q
      ? list.filter(t => {
          const text = `${t.libelle_operation} ${t.libelle_simplifie} ${t.categorie} ${t.debit}`.toLowerCase()
          return text.includes(q)
        })
      : list

    // Trier : transactions non encore rapprochées en premier, puis montant proche en priorité
    return [...filtered].sort((a, b) => {
      const aUsed = matchedTxIds.has(a.id) ? 1 : 0
      const bUsed = matchedTxIds.has(b.id) ? 1 : 0
      if (aUsed !== bUsed) return aUsed - bUsed

      if (linkingExpense) {
        const aDiff = Math.abs(a.debit - linkingExpense.montant)
        const bDiff = Math.abs(b.debit - linkingExpense.montant)
        if (aDiff !== bDiff) return aDiff - bDiff
      }
      return b.date.localeCompare(a.date)
    })
  }, [transactions, selectedMonth, txSearch, summary.items, linkingExpense])

  const handleManualLink = async (expense: FixedExpense, tx: Transaction) => {
    setSavingLink(true)
    try {
      await updateTransactionPB(tx.id, { fixed_expense_id: expense.id })
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.transactions })
      setLinkingExpense(null)
      setTxSearch('')
    } finally {
      setSavingLink(false)
    }
  }

  const handleUnlink = async (_expense: FixedExpense, tx?: Transaction) => {
    if (!tx) return
    await updateTransactionPB(tx.id, { fixed_expense_id: '' })
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.transactions })
  }

  const progressPct =
    summary.totalExpected > 0
      ? Math.min(100, Math.round((summary.totalPaid / summary.totalExpected) * 100))
      : 0

  if (summary.items.length === 0) {
    return (
      <div className="card p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              {t('fixedTracker.title')}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('fixedTracker.emptyDesc')}
            </p>
          </div>
        </div>
        <Link
          to="/settings?tab=depenses"
          className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>{t('fixedTracker.configureBtn')}</span>
        </Link>
      </div>
    )
  }

  return (
    <div className="card p-5 space-y-4">
      {/* Header + Résumé */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {t('fixedTracker.title')}
              </h3>
              <span className="badge text-[11px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                {t('fixedTracker.countLabel', { paid: summary.paidCount, total: summary.items.length })}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {tolerance > 0
                ? t('fixedTracker.matchDescTolerance', { tolerance: formatCurrency(tolerance) })
                : t('fixedTracker.matchDescExact')}
            </p>
          </div>
        </div>

        {/* 3 KPIs rapides */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/40 text-right">
            <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              {t('fixedTracker.paid')}
            </p>
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
              {formatCurrency(summary.totalPaid)}
            </p>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/40 text-right">
            <p className="text-[10px] font-medium uppercase tracking-wider text-amber-700 dark:text-amber-400">
              {t('fixedTracker.pending')}
            </p>
            <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
              {formatCurrency(summary.totalPending)}
            </p>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200/70 dark:border-gray-700 text-right">
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {t('fixedTracker.expected')}
            </p>
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
              {formatCurrency(summary.totalExpected)}
            </p>
          </div>

          <button
            onClick={() => setExpanded(p => !p)}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
            title={expanded ? t('fixedTracker.collapse') : t('fixedTracker.expand')}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Barre de progression */}
      <div className="space-y-1">
        <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Détail des dépenses fixes */}
      {expanded && (
        <div className="divide-y divide-gray-100 dark:divide-gray-800/70 border-t border-gray-100 dark:border-gray-800 pt-2">
          {summary.items.map(({ expense, status, matchType, matchedTransaction }) => {
            const isPaid = status === 'paid'
            return (
              <div
                key={expense.id}
                className="py-2.5 flex items-center justify-between gap-3 flex-wrap text-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {isPaid ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 dark:text-white truncate">
                        {expense.libelle}
                      </span>
                      {expense.pattern && (
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-mono text-[10px]">
                          {expense.pattern}
                        </span>
                      )}
                      <span className="text-[11px] text-gray-400">
                        {expense.categorie}
                      </span>
                    </div>

                    {isPaid && matchedTransaction ? (
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 truncate">
                        {matchType === 'auto' ? t('fixedTracker.auto') : t('fixedTracker.manual')} · {matchedTransaction.date} —{' '}
                        {matchedTransaction.libelle_simplifie || matchedTransaction.libelle_operation}
                        {Math.abs(matchedTransaction.debit - expense.montant) >= 0.01 && (
                          <span className="ml-1 font-semibold">
                            {t('fixedTracker.actual', { amount: formatCurrency(matchedTransaction.debit) })}
                          </span>
                        )}
                      </p>
                    ) : (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        {expense.pattern
                          ? t('fixedTracker.waitingPattern', {
                              amount: formatCurrency(expense.montant),
                              tolerance: tolerance > 0 ? ` (± ${formatCurrency(tolerance)})` : '',
                              pattern: expense.pattern,
                            })
                          : t('fixedTracker.waitingNoPattern')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <span
                    className={`font-semibold ${
                      isPaid
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {formatCurrency(expense.montant)}
                  </span>

                  {isPaid && matchType === 'manual' && (
                    <button
                      onClick={() => handleUnlink(expense, matchedTransaction)}
                      className="btn-secondary text-xs py-1 px-2 flex items-center gap-1 text-gray-500 hover:text-red-500"
                      title={t('fixedTracker.unlinkTitle')}
                    >
                      <Unlink className="w-3 h-3" />
                      <span>{t('fixedTracker.unlink')}</span>
                    </button>
                  )}

                  {!isPaid && (
                    <button
                      onClick={() => {
                        setLinkingExpense(expense)
                        setTxSearch('')
                      }}
                      className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:border-indigo-300"
                      title={t('fixedTracker.linkTitle')}
                    >
                      <Link2 className="w-3 h-3" />
                      <span>{t('fixedTracker.link')}</span>
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modale de rapprochement manuel */}
      <Modal
        open={Boolean(linkingExpense)}
        onClose={() => setLinkingExpense(null)}
        title={
          linkingExpense
            ? t('fixedTracker.modalTitle', { label: linkingExpense.libelle, amount: formatCurrency(linkingExpense.montant) })
            : t('fixedTracker.modalDefaultTitle')
        }
        size="lg"
      >
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              autoFocus
              type="text"
              className="input pl-9 text-sm w-full"
              placeholder={t('fixedTracker.searchPlaceholder')}
              value={txSearch}
              onChange={e => setTxSearch(e.target.value)}
            />
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 border border-gray-100 dark:border-gray-800 rounded-xl">
            {monthDebitTransactions.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-400">
                {t('fixedTracker.noDebitFound')}
              </div>
            ) : (
              monthDebitTransactions.map(tx => {
                const isExactAmount =
                  linkingExpense && Math.abs(tx.debit - linkingExpense.montant) < 0.01
                return (
                  <button
                    key={tx.id}
                    disabled={savingLink}
                    onClick={() => linkingExpense && handleManualLink(linkingExpense, tx)}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30 transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                        {tx.libelle_simplifie || tx.libelle_operation}
                      </p>
                      <p className="text-[11px] text-gray-400 truncate">
                        {tx.date} · {tx.categorie || t('fixedTracker.uncategorized')}
                        {tx.libelle_operation && tx.libelle_simplifie
                          ? ` · ${tx.libelle_operation}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isExactAmount && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold">
                          {t('fixedTracker.exactMatch')}
                        </span>
                      )}
                      <span className="text-xs font-bold text-gray-900 dark:text-white">
                        -{formatCurrency(tx.debit)}
                      </span>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
