import { useState, useMemo } from 'react'
import { Plus, Download, Sparkles, AlertCircle, Calendar } from 'lucide-react'
import { PocketBaseGuard } from '@/components/ui/PocketBaseRequiredState'
import { useStore } from '@/store/useStore'
import { Transaction } from '@/lib/types'
import {
  createTransaction,
  updateTransactionPB,
  deleteTransactionPB,
  deduplicateTransactionsPB,
} from '@/lib/sync'
import { useTransactions, QUERY_KEYS } from '@/lib/queries'
import { useQueryClient } from '@tanstack/react-query'
import { getAvailableMonths, moisToLabel, countDuplicateTransactions } from '@/lib/utils'
import TransactionTable from '@/components/transactions/TransactionTable'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useTranslation } from '@/i18n'

export default function Transactions() {
  const { selectedMonth, setSelectedMonth } = useStore()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: transactions = [], isLoading: loading, error: queryError, refetch } = useTransactions()
  const [actionError, setActionError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [showAddRow, setShowAddRow] = useState(false)
  const [dedupNotice, setDedupNotice] = useState<string | null>(null)

  const error = actionError || (queryError ? (queryError as Error).message || t('common.pbUnreachable') : null)

  const loadTransactions = () => {
    setActionError(null)
    refetch()
  }

  const duplicatesCount = useMemo(() => countDuplicateTransactions(transactions), [transactions])

  const monthTx = useMemo(
    () => transactions.filter(t => t.mois === selectedMonth),
    [transactions, selectedMonth]
  )

  const availableMonths = useMemo(() => getAvailableMonths(transactions), [transactions])

  const handleUpdate = async (id: string, updates: Partial<Transaction>) => {
    try {
      await updateTransactionPB(id, updates)
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.transactions })
    } catch (err: any) {
      setActionError(err.message || 'Erreur mise à jour')
    }
  }

  const handleToggleIgnoreDashboard = async (id: string) => {
    const tx = transactions.find(t => t.id === id)
    if (!tx) return
    await handleUpdate(id, { ignore_dashboard: !tx.ignore_dashboard })
  }

  const handleAdd = async (data: Omit<Transaction, 'id' | 'created' | 'updated'>) => {
    try {
      await createTransaction(data)
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.transactions })
    } catch (err: any) {
      setActionError(err.message || 'Erreur ajout transaction')
    }
  }

  const handleDelete = (id: string) => setDeleteId(id)

  const confirmDelete = async () => {
    if (deleteId) {
      try {
        await deleteTransactionPB(deleteId)
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.transactions })
      } catch (err: any) {
        setActionError(err.message || 'Erreur suppression')
      }
      setDeleteId(null)
    }
  }

  const sanitizeCsvCell = (val: string): string => {
    const str = String(val ?? '')
    const safeFormula = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str
    if (safeFormula.includes(';') || safeFormula.includes('"') || safeFormula.includes('\n')) {
      return `"${safeFormula.replace(/"/g, '""')}"`
    }
    return safeFormula
  }

  const exportCSV = () => {
    const rows = [
      ['Date', 'Libellé', 'Libellé opération', 'Catégorie', 'Type', 'Débit', 'Crédit'],
      ...monthTx.map(t => [
        sanitizeCsvCell(t.date),
        sanitizeCsvCell(t.libelle_simplifie),
        sanitizeCsvCell(t.libelle_operation),
        sanitizeCsvCell(t.categorie),
        sanitizeCsvCell(t.type),
        t.debit.toFixed(2).replace('.', ','),
        t.credit.toFixed(2).replace('.', ','),
      ]),
    ]
    const csv = rows.map(r => r.join(';')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `budget-${selectedMonth.replace('/', '-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCleanDuplicates = async () => {
    try {
      const cleaned = await deduplicateTransactionsPB(transactions)
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.transactions })
      setDedupNotice(t('tx.duplicatesCleaned', { count: cleaned }))
      setTimeout(() => setDedupNotice(null), 5000)
    } catch (err: any) {
      setActionError(err.message || t('common.pbSaveError'))
    }
  }

  return (
    <PocketBaseGuard
      error={error}
      isLoading={loading}
      loadingLabel={t('tx.loading')}
      onRetry={loadTransactions}
    >
    <div className="space-y-6 animate-fade-in">
      {/* Alerte doublons détectés */}
      {duplicatesCount > 0 && (
        <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="text-xs">
              {t('tx.duplicatesAlert', { count: duplicatesCount })}
            </div>
          </div>
          <button
            onClick={handleCleanDuplicates}
            className="btn-primary text-xs py-1 px-3 flex items-center gap-1.5 shrink-0 shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" /> {t('tx.cleanDuplicates')}
          </button>
        </div>
      )}

      {dedupNotice && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold animate-fade-in">
          ✓ {dedupNotice}
        </div>
      )}

      {/* Header avec sélecteur de mois compact */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white capitalize">
              {t('tx.title')}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {monthTx.length > 1
                ? t('tx.countPlural', { count: monthTx.length })
                : t('tx.countSingular', { count: monthTx.length })}
            </p>
          </div>

          {/* Sélecteur de mois compact */}
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="input text-sm font-semibold py-1.5 pl-3 pr-8 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl cursor-pointer shadow-sm appearance-none capitalize"
            >
              {availableMonths.map(m => (
                <option key={m} value={m}>
                  {moisToLabel(m)}
                </option>
              ))}
            </select>
            <Calendar className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={exportCSV} className="btn-secondary text-xs">
            <Download className="w-4 h-4" /> {t('tx.exportCsv')}
          </button>
          <button
            onClick={() => setShowAddRow(prev => !prev)}
            className="btn-primary text-xs"
          >
            <Plus className="w-4 h-4" /> {showAddRow ? t('common.cancel') : t('tx.newTx')}
          </button>
        </div>
      </div>

      {/* Table avec édition et ajout directs en ligne */}
      <TransactionTable
        transactions={monthTx}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onAdd={handleAdd}
        onToggleIgnoreDashboard={handleToggleIgnoreDashboard}
        showAddRow={showAddRow}
        onToggleAddRow={setShowAddRow}
      />

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title={t('tx.deleteTitle')}
        message={t('tx.deleteMessage')}
        confirmLabel={t('common.delete')}
        danger
      />
    </div>
    </PocketBaseGuard>
  )
}
