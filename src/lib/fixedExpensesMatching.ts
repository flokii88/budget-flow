import { FixedExpense, Transaction } from './types'
import { RECONCILIATION_TYPE } from './constants'

export type FixedMatchType = 'auto' | 'manual' | 'none'

export interface FixedExpenseStatusItem {
  expense: FixedExpense
  status: 'paid' | 'pending'
  matchType: FixedMatchType
  matchedTransaction?: Transaction
}

export interface FixedExpensesMonthlySummary {
  month: string
  items: FixedExpenseStatusItem[]
  totalExpected: number
  totalPaid: number
  totalPending: number
  paidCount: number
  pendingCount: number
}

/**
 * Calcule le statut (passée / en attente) de chaque dépense fixe active sur un mois donné.
 * 1. Rapprochement manuel prioritaire (via `transaction.fixed_expense_id` stocké dans PocketBase).
 * 2. Rapprochement automatique : montant exact (ou dans `toleranceEuro`) + mot-clé `pattern` présent dans le libellé.
 */
export function computeFixedExpensesStatus(
  expenses: FixedExpense[],
  transactions: Transaction[],
  month: string,
  toleranceEuro: number = 0
): FixedExpensesMonthlySummary {
  const activeExpenses = expenses
    .filter(e => e.actif)
    .sort((a, b) => (a.ordre || 0) - (b.ordre || 0))

  const monthDebits = transactions.filter(
    t => t.mois === month && !t.ignore_dashboard && t.type !== RECONCILIATION_TYPE && Number(t.debit) > 0
  )

  const usedTxIds = new Set<string>()
  const matchedByExpenseId = new Map<string, { tx: Transaction; matchType: FixedMatchType }>()

  // Passe 1 : rapprochement manuel (persisté sur la transaction dans PocketBase)
  for (const exp of activeExpenses) {
    const manualTx = monthDebits.find(
      t => !usedTxIds.has(t.id) && t.fixed_expense_id === exp.id
    )
    if (manualTx) {
      usedTxIds.add(manualTx.id)
      matchedByExpenseId.set(exp.id, { tx: manualTx, matchType: 'manual' })
    }
  }

  // Passe 2 : rapprochement automatique (montant exact ou dans la tolérance + mot-clé dans le libellé)
  const maxDiff = Math.max(0.009, (Number(toleranceEuro) || 0) + 0.001)
  for (const exp of activeExpenses) {
    if (matchedByExpenseId.has(exp.id)) continue
    const keyword = (exp.pattern || '').trim().toLowerCase()
    if (!keyword) continue

    const candidates = monthDebits.filter(t => {
      if (usedTxIds.has(t.id)) return false
      const diff = Math.abs(Number(t.debit) - Number(exp.montant))
      if (diff > maxDiff) return false
      const fullLabel = `${t.libelle_operation || ''} ${t.libelle_simplifie || ''}`.toLowerCase()
      return fullLabel.includes(keyword)
    })

    if (candidates.length > 0) {
      // Si plusieurs transactions correspondent dans la marge, prendre la plus proche en montant
      candidates.sort(
        (a, b) =>
          Math.abs(Number(a.debit) - Number(exp.montant)) -
          Math.abs(Number(b.debit) - Number(exp.montant))
      )
      const autoTx = candidates[0]
      usedTxIds.add(autoTx.id)
      matchedByExpenseId.set(exp.id, { tx: autoTx, matchType: 'auto' })
    }
  }

  const items: FixedExpenseStatusItem[] = activeExpenses.map(exp => {
    const match = matchedByExpenseId.get(exp.id)
    if (match) {
      return {
        expense: exp,
        status: 'paid',
        matchType: match.matchType,
        matchedTransaction: match.tx,
      }
    }
    return {
      expense: exp,
      status: 'pending',
      matchType: 'none',
    }
  })

  const totalExpected = activeExpenses.reduce((s, e) => s + (Number(e.montant) || 0), 0)
  const paidItems = items.filter(i => i.status === 'paid')
  const pendingItems = items.filter(i => i.status === 'pending')
  const totalPaid = paidItems.reduce((s, i) => s + (Number(i.expense.montant) || 0), 0)
  const totalPending = pendingItems.reduce((s, i) => s + (Number(i.expense.montant) || 0), 0)

  return {
    month,
    items,
    totalExpected,
    totalPaid,
    totalPending,
    paidCount: paidItems.length,
    pendingCount: pendingItems.length,
  }
}
