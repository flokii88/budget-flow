import pb, { COLLECTIONS } from './pocketbase'
import { DEFAULT_BUDGET_TYPES, DEFAULT_CATEGORIES } from './constants'
import { resolveTypeForCategory } from './utils'
import { Transaction, FixedExpense, BudgetRules, BudgetCategory, BudgetType, CategorizationRule } from './types'

export interface SyncStatus {
  isOnline: boolean
  isSyncing: boolean
  lastSyncTime: Date | null
  error: string | null
}

let syncStatus: SyncStatus = {
  isOnline: false,
  isSyncing: false,
  lastSyncTime: null,
  error: null,
}

const listeners = new Set<(status: SyncStatus) => void>()

export function subscribeSyncStatus(listener: (status: SyncStatus) => void) {
  listeners.add(listener)
  listener(syncStatus)
  return () => {
    listeners.delete(listener)
  }
}

function updateStatus(updates: Partial<SyncStatus>) {
  syncStatus = { ...syncStatus, ...updates }
  listeners.forEach(fn => fn(syncStatus))
}

const PB_HEALTH_TIMEOUT_MS = 4000
const PB_REQUEST_TIMEOUT_MS = 5000

function withTimeout<T>(promise: Promise<T>, ms = PB_REQUEST_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Délai d’attente dépassé (timeout)')), ms)
    ),
  ])
}

/**
 * Convertit les erreurs techniques du SDK PocketBase en messages clairs pour l'utilisateur.
 */
export function formatPocketBaseError(err: any): string {
  if (err?.status === 401 || err?.status === 403) {
    if (pb.authStore.isValid) {
      pb.authStore.clear()
    }
    return 'Session expirée ou accès non autorisé. Veuillez vous reconnecter.'
  }

  const raw = err?.message || ''
  const isNetworkError =
    err?.status === 0 ||
    err?.isAbort ||
    raw.includes('Something went wrong while processing your request') ||
    raw.includes('Failed to fetch') ||
    raw.includes('NetworkError') ||
    raw.includes('Load failed') ||
    raw.includes('timeout')

  if (isNetworkError) {
    return `Aucun serveur PocketBase n'est connecté (${pb.baseUrl}). Vérifiez que votre serveur est démarré.`
  }
  return raw || 'Erreur lors de la communication avec PocketBase.'
}

/**
 * Check if PocketBase is accessible (with timeout)
 */
export async function checkPocketBaseHealth(): Promise<boolean> {
  updateStatus({ isSyncing: true })
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Délai d’attente dépassé (timeout)')), PB_HEALTH_TIMEOUT_MS)
    )
    const res = await Promise.race([pb.health.check(), timeoutPromise])
    const ok = res.code === 200
    updateStatus({
      isSyncing: false,
      isOnline: ok,
      lastSyncTime: ok ? new Date() : syncStatus.lastSyncTime,
      error: ok ? null : 'Erreur santé PocketBase',
    })
    return ok
  } catch (err: any) {
    updateStatus({
      isSyncing: false,
      isOnline: false,
      error: formatPocketBaseError(err),
    })
    return false
  }
}

// ─── PocketBase-first CRUD Functions ──────────────────────────────────────────

function isPocketBaseId(id: string): boolean {
  return typeof id === 'string' && id.length === 15
}

// Transactions
export async function fetchTransactions(): Promise<Transaction[]> {
  updateStatus({ isSyncing: true })
  try {
    const records = await withTimeout(pb.collection(COLLECTIONS.TRANSACTIONS).getFullList({ sort: '-created' }))
    const mapped: Transaction[] = records.map((t: any) => ({
      id: t.id,
      date: t.date,
      mois: t.mois,
      libelle_simplifie: t.libelle_simplifie || '',
      libelle_operation: t.libelle_operation || '',
      categorie: t.categorie || '',
      type: t.type || '',
      debit: Number(t.debit) || 0,
      credit: Number(t.credit) || 0,
      ignore_dashboard: !!t.ignore_dashboard,
      fixed_expense_id: t.fixed_expense_id || '',
      created: t.created,
      updated: t.updated,
    }))
    updateStatus({ isSyncing: false, isOnline: true })
    return mapped
  } catch (err: any) {
    const msg = formatPocketBaseError(err)
    updateStatus({ isSyncing: false, isOnline: false, error: msg })
    throw new Error(msg)
  }
}

export async function createTransaction(data: Omit<Transaction, 'id' | 'created' | 'updated'>): Promise<Transaction> {
  updateStatus({ isSyncing: true })
  try {
    const rec = await pb.collection(COLLECTIONS.TRANSACTIONS).create({
      date: data.date,
      mois: data.mois,
      libelle_simplifie: data.libelle_simplifie || '',
      libelle_operation: data.libelle_operation || '',
      categorie: data.categorie || '',
      type: data.type || '',
      debit: data.debit || 0,
      credit: data.credit || 0,
      ignore_dashboard: !!data.ignore_dashboard,
      fixed_expense_id: data.fixed_expense_id || '',
    })
    updateStatus({ isSyncing: false, isOnline: true })
    return {
      id: rec.id,
      date: (rec as any).date,
      mois: (rec as any).mois,
      libelle_simplifie: (rec as any).libelle_simplifie || '',
      libelle_operation: (rec as any).libelle_operation || '',
      categorie: (rec as any).categorie || '',
      type: (rec as any).type || '',
      debit: Number((rec as any).debit) || 0,
      credit: Number((rec as any).credit) || 0,
      ignore_dashboard: !!(rec as any).ignore_dashboard,
      fixed_expense_id: (rec as any).fixed_expense_id || '',
      created: rec.created,
      updated: rec.updated,
    }
  } catch (err: any) {
    const msg = formatPocketBaseError(err)
    updateStatus({ isSyncing: false, isOnline: false, error: msg })
    throw new Error(msg)
  }
}

export async function updateTransactionPB(id: string, updates: Partial<Transaction>): Promise<Transaction> {
  updateStatus({ isSyncing: true })
  try {
    const rec = await pb.collection(COLLECTIONS.TRANSACTIONS).update(id, updates)
    updateStatus({ isSyncing: false, isOnline: true })
    return {
      id: rec.id,
      date: (rec as any).date,
      mois: (rec as any).mois,
      libelle_simplifie: (rec as any).libelle_simplifie || '',
      libelle_operation: (rec as any).libelle_operation || '',
      categorie: (rec as any).categorie || '',
      type: (rec as any).type || '',
      debit: Number((rec as any).debit) || 0,
      credit: Number((rec as any).credit) || 0,
      ignore_dashboard: !!(rec as any).ignore_dashboard,
      fixed_expense_id: (rec as any).fixed_expense_id || '',
      created: rec.created,
      updated: rec.updated,
    }
  } catch (err: any) {
    const msg = formatPocketBaseError(err)
    updateStatus({ isSyncing: false, isOnline: false, error: msg })
    throw new Error(msg)
  }
}

export async function deleteTransactionPB(id: string): Promise<void> {
  updateStatus({ isSyncing: true })
  try {
    await pb.collection(COLLECTIONS.TRANSACTIONS).delete(id)
    updateStatus({ isSyncing: false, isOnline: true })
  } catch (err: any) {
    const msg = formatPocketBaseError(err)
    updateStatus({ isSyncing: false, isOnline: false, error: msg })
    throw new Error(msg)
  }
}

export async function addTransactionsBatch(txs: Omit<Transaction, 'id' | 'created' | 'updated'>[]): Promise<Transaction[]> {
  updateStatus({ isSyncing: true })
  try {
    const results: Transaction[] = []
    for (const tx of txs) {
      const rec = await pb.collection(COLLECTIONS.TRANSACTIONS).create({
        date: tx.date,
        mois: tx.mois,
        libelle_simplifie: tx.libelle_simplifie || '',
        libelle_operation: tx.libelle_operation || '',
        categorie: tx.categorie || '',
        type: tx.type || '',
        debit: tx.debit || 0,
        credit: tx.credit || 0,
        ignore_dashboard: !!tx.ignore_dashboard,
      })
      results.push({
        id: rec.id,
        date: (rec as any).date,
        mois: (rec as any).mois,
        libelle_simplifie: (rec as any).libelle_simplifie || '',
        libelle_operation: (rec as any).libelle_operation || '',
        categorie: (rec as any).categorie || '',
        type: (rec as any).type || '',
        debit: Number((rec as any).debit) || 0,
        credit: Number((rec as any).credit) || 0,
        ignore_dashboard: !!(rec as any).ignore_dashboard,
        created: rec.created,
        updated: rec.updated,
      })
    }
    updateStatus({ isSyncing: false, isOnline: true })
    return results
  } catch (err: any) {
    const msg = formatPocketBaseError(err)
    updateStatus({ isSyncing: false, isOnline: false, error: msg })
    throw new Error(msg)
  }
}

// Fixed Expenses
export async function fetchFixedExpenses(): Promise<FixedExpense[]> {
  updateStatus({ isSyncing: true })
  try {
    const records = await pb.collection(COLLECTIONS.FIXED_EXPENSES).getFullList({ sort: 'ordre' })
    const mapped: FixedExpense[] = records.map((f: any) => ({
      id: f.id,
      libelle: f.libelle,
      pattern: f.pattern || '',
      categorie: f.categorie || '',
      type: f.type || '',
      montant: Number(f.montant) || 0,
      actif: !!f.actif,
      ordre: Number(f.ordre) || 0,
    }))
    updateStatus({ isSyncing: false, isOnline: true })
    return mapped
  } catch (err: any) {
    const msg = formatPocketBaseError(err)
    updateStatus({ isSyncing: false, isOnline: false, error: msg })
    throw new Error(msg)
  }
}

export async function saveFixedExpensePB(expense: FixedExpense): Promise<FixedExpense> {
  updateStatus({ isSyncing: true })
  try {
    const cleanPattern = (expense.pattern || '').trim()
    const payload = {
      libelle: expense.libelle,
      pattern: cleanPattern,
      categorie: expense.categorie || '',
      type: expense.type || '',
      montant: expense.montant,
      actif: expense.actif,
      ordre: expense.ordre,
    }
    let rec: any
    if (expense.id && isPocketBaseId(expense.id)) {
      rec = await pb.collection(COLLECTIONS.FIXED_EXPENSES).update(expense.id, payload)
    } else {
      rec = await pb.collection(COLLECTIONS.FIXED_EXPENSES).create(payload)
    }
    updateStatus({ isSyncing: false, isOnline: true })
    return {
      id: rec.id,
      libelle: rec.libelle,
      pattern: rec.pattern || '',
      categorie: rec.categorie || '',
      type: rec.type || '',
      montant: Number(rec.montant) || 0,
      actif: !!rec.actif,
      ordre: Number(rec.ordre) || 0,
    }
  } catch (err: any) {
    const msg = formatPocketBaseError(err)
    updateStatus({ isSyncing: false, isOnline: false, error: msg })
    throw new Error(msg)
  }
}

export async function deleteFixedExpensePB(id: string): Promise<void> {
  updateStatus({ isSyncing: true })
  try {
    await pb.collection(COLLECTIONS.FIXED_EXPENSES).delete(id)
    updateStatus({ isSyncing: false, isOnline: true })
  } catch (err: any) {
    const msg = formatPocketBaseError(err)
    updateStatus({ isSyncing: false, isOnline: false, error: msg })
    throw new Error(msg)
  }
}

// Categories
export async function fetchCategories(): Promise<BudgetCategory[]> {
  updateStatus({ isSyncing: true })
  try {
    const records = await pb.collection(COLLECTIONS.CATEGORIES).getFullList({ sort: 'nom' })
    const mapped: BudgetCategory[] = records.map((c: any) => ({
      id: c.id,
      nom: c.nom,
      types: Array.isArray(c.types) ? c.types : (c.type ? [c.type] : ['Essentielle']),
      couleur: c.couleur || '',
    }))
    updateStatus({ isSyncing: false, isOnline: true })
    return mapped
  } catch (err: any) {
    const msg = formatPocketBaseError(err)
    updateStatus({ isSyncing: false, isOnline: false, error: msg })
    throw new Error(msg)
  }
}

export async function saveCategoryPB(cat: BudgetCategory): Promise<BudgetCategory> {
  updateStatus({ isSyncing: true })
  try {
    const payload = {
      nom: cat.nom,
      types: cat.types,
      couleur: cat.couleur || '',
    }
    let rec: any
    if (cat.id && isPocketBaseId(cat.id)) {
      rec = await pb.collection(COLLECTIONS.CATEGORIES).update(cat.id, payload)
    } else {
      rec = await pb.collection(COLLECTIONS.CATEGORIES).create(payload)
    }
    updateStatus({ isSyncing: false, isOnline: true })
    return {
      id: rec.id,
      nom: rec.nom,
      types: Array.isArray(rec.types) ? rec.types : ['Essentielle'],
      couleur: rec.couleur || '',
    }
  } catch (err: any) {
    const msg = formatPocketBaseError(err)
    updateStatus({ isSyncing: false, isOnline: false, error: msg })
    throw new Error(msg)
  }
}

export async function deleteCategoryPB(id: string): Promise<void> {
  updateStatus({ isSyncing: true })
  try {
    await pb.collection(COLLECTIONS.CATEGORIES).delete(id)
    updateStatus({ isSyncing: false, isOnline: true })
  } catch (err: any) {
    const msg = formatPocketBaseError(err)
    updateStatus({ isSyncing: false, isOnline: false, error: msg })
    throw new Error(msg)
  }
}

// Budget Types
export async function fetchBudgetTypes(): Promise<BudgetType[]> {
  updateStatus({ isSyncing: true })
  try {
    const records = await pb.collection(COLLECTIONS.BUDGET_TYPES).getFullList({ sort: 'nom' })
    const mapped: BudgetType[] = records.map((bt: any) => ({
      id: bt.id,
      nom: bt.nom,
      couleur: bt.couleur || '',
      isSystem: !!bt.isSystem,
    }))
    updateStatus({ isSyncing: false, isOnline: true })
    return mapped
  } catch (err: any) {
    const msg = formatPocketBaseError(err)
    updateStatus({ isSyncing: false, isOnline: false, error: msg })
    throw new Error(msg)
  }
}

export async function saveBudgetTypePB(bt: BudgetType): Promise<BudgetType> {
  updateStatus({ isSyncing: true })
  try {
    const payload = {
      nom: bt.nom,
      couleur: bt.couleur || '',
      isSystem: !!bt.isSystem,
    }
    let rec: any
    if (bt.id && isPocketBaseId(bt.id)) {
      rec = await pb.collection(COLLECTIONS.BUDGET_TYPES).update(bt.id, payload)
    } else {
      rec = await pb.collection(COLLECTIONS.BUDGET_TYPES).create(payload)
    }
    updateStatus({ isSyncing: false, isOnline: true })
    return {
      id: rec.id,
      nom: rec.nom,
      couleur: rec.couleur || '',
      isSystem: !!rec.isSystem,
    }
  } catch (err: any) {
    const msg = formatPocketBaseError(err)
    updateStatus({ isSyncing: false, isOnline: false, error: msg })
    throw new Error(msg)
  }
}

export async function deleteBudgetTypePB(id: string): Promise<void> {
  updateStatus({ isSyncing: true })
  try {
    await pb.collection(COLLECTIONS.BUDGET_TYPES).delete(id)
    updateStatus({ isSyncing: false, isOnline: true })
  } catch (err: any) {
    const msg = formatPocketBaseError(err)
    updateStatus({ isSyncing: false, isOnline: false, error: msg })
    throw new Error(msg)
  }
}

// Categorization Rules
export async function fetchCategorizationRules(): Promise<CategorizationRule[]> {
  updateStatus({ isSyncing: true })
  try {
    const records = await pb.collection(COLLECTIONS.CATEGORIZATION_RULES).getFullList({ sort: '-created' })
    const mapped: CategorizationRule[] = records.map((r: any) => ({
      id: r.id,
      pattern: r.pattern,
      categorie: r.categorie,
      type: r.type || '',
    }))
    updateStatus({ isSyncing: false, isOnline: true })
    return mapped
  } catch (err: any) {
    const msg = formatPocketBaseError(err)
    updateStatus({ isSyncing: false, isOnline: false, error: msg })
    throw new Error(msg)
  }
}

export async function saveCategorizationRulePB(rule: CategorizationRule): Promise<CategorizationRule> {
  updateStatus({ isSyncing: true })
  try {
    const payload = {
      pattern: rule.pattern,
      categorie: rule.categorie,
      type: rule.type || '',
    }
    let rec: any
    if (rule.id && isPocketBaseId(rule.id)) {
      rec = await pb.collection(COLLECTIONS.CATEGORIZATION_RULES).update(rule.id, payload)
    } else {
      rec = await pb.collection(COLLECTIONS.CATEGORIZATION_RULES).create(payload)
    }
    updateStatus({ isSyncing: false, isOnline: true })
    return {
      id: rec.id,
      pattern: rec.pattern,
      categorie: rec.categorie,
      type: rec.type || '',
    }
  } catch (err: any) {
    const msg = formatPocketBaseError(err)
    updateStatus({ isSyncing: false, isOnline: false, error: msg })
    throw new Error(msg)
  }
}

export async function deleteCategorizationRulePB(id: string): Promise<void> {
  updateStatus({ isSyncing: true })
  try {
    await pb.collection(COLLECTIONS.CATEGORIZATION_RULES).delete(id)
    updateStatus({ isSyncing: false, isOnline: true })
  } catch (err: any) {
    const msg = formatPocketBaseError(err)
    updateStatus({ isSyncing: false, isOnline: false, error: msg })
    throw new Error(msg)
  }
}

// Budget Rules (1 record unique — upsert)
export async function fetchBudgetRulesPB(): Promise<BudgetRules | null> {
  updateStatus({ isSyncing: true })
  try {
    const records = await pb.collection(COLLECTIONS.BUDGET_RULES).getFullList()
    updateStatus({ isSyncing: false, isOnline: true })
    if (records.length === 0) return null
    const r = records[0] as any
    return {
      revenus_theoriques: Number(r.revenus_theoriques) || 0,
      taux_essentielle: Number(r.taux_essentielle) || 0.55,
      taux_loisirs: Number(r.taux_loisirs) || 0.25,
      taux_epargne: Number(r.taux_epargne) || 0.20,
      ventilation_epargne: Array.isArray(r.ventilation_epargne) ? r.ventilation_epargne : [],
      fixed_match_tolerance: Number(r.fixed_match_tolerance) || 0,
      devise: r.devise || undefined,
    }
  } catch (err: any) {
    const msg = formatPocketBaseError(err)
    updateStatus({ isSyncing: false, isOnline: false, error: msg })
    throw new Error(msg)
  }
}

export async function saveBudgetRulesPB(rules: BudgetRules): Promise<void> {
  updateStatus({ isSyncing: true })
  try {
    const payload = {
      revenus_theoriques: rules.revenus_theoriques,
      taux_essentielle: rules.taux_essentielle,
      taux_loisirs: rules.taux_loisirs,
      taux_epargne: rules.taux_epargne,
      ventilation_epargne: rules.ventilation_epargne,
      fixed_match_tolerance: Number(rules.fixed_match_tolerance) || 0,
      devise: rules.devise || 'EUR',
    }
    const existingList = await pb.collection(COLLECTIONS.BUDGET_RULES).getFullList()
    if (existingList.length > 0) {
      await pb.collection(COLLECTIONS.BUDGET_RULES).update(existingList[0].id, payload)
    } else {
      await pb.collection(COLLECTIONS.BUDGET_RULES).create(payload)
    }
    updateStatus({ isSyncing: false, isOnline: true })
  } catch (err: any) {
    const msg = formatPocketBaseError(err)
    updateStatus({ isSyncing: false, isOnline: false, error: msg })
    throw new Error(msg)
  }
}

// ─── PocketBase Helpers (On-the-fly creation, Rules, Dedup, Onboarding) ──────

/**
 * Crée une catégorie si elle n'existe pas encore dans PocketBase.
 */
export async function addCategoryPB(nom: string, types?: string[] | string): Promise<BudgetCategory> {
  const trimmed = nom.trim()
  const existing = await fetchCategories()
  const found = existing.find(c => c.nom.toLowerCase() === trimmed.toLowerCase())
  if (found) return found

  const resolvedTypes = Array.isArray(types) ? types : (types ? [types] : ['Essentielle'])
  return saveCategoryPB({ id: '', nom: trimmed, types: resolvedTypes })
}

/**
 * Crée ou met à jour une règle de catégorisation par son pattern dans PocketBase.
 */
export async function addCategorizationRulePB(
  pattern: string,
  categorie: string,
  type?: string
): Promise<CategorizationRule> {
  const cleanPattern = pattern.trim().toUpperCase()
  const [rules, categories] = await Promise.all([
    fetchCategorizationRules(),
    fetchCategories(),
  ])
  const resolvedType = type || resolveTypeForCategory(categories, categorie)
  const existing = rules.find(r => r.pattern.toUpperCase() === cleanPattern)
  return saveCategorizationRulePB({
    id: existing?.id || '',
    pattern: cleanPattern,
    categorie,
    type: resolvedType,
  })
}

/**
 * Ré-applique l'ensemble des règles de swimlanes globales à TOUTES les transactions dans PocketBase.
 */
export async function applyCategorizationRulesToAllTransactionsPB(): Promise<number> {
  const [rules, categories, transactions] = await Promise.all([
    fetchCategorizationRules(),
    fetchCategories(),
    fetchTransactions(),
  ])

  let modifiedCount = 0
  const updates: Promise<Transaction>[] = []

  for (const tx of transactions) {
    if (tx.credit > 0) continue

    const fullStr = (tx.libelle_simplifie + ' ' + tx.libelle_operation).toUpperCase()
    for (const rule of rules) {
      if (rule.pattern && fullStr.includes(rule.pattern.toUpperCase())) {
        const targetType = rule.type || resolveTypeForCategory(categories, rule.categorie)
        if (tx.categorie !== rule.categorie || tx.type !== targetType) {
          modifiedCount++
          updates.push(updateTransactionPB(tx.id, { categorie: rule.categorie, type: targetType }))
        }
        break
      }
    }
  }

  if (updates.length > 0) {
    await Promise.all(updates)
  }
  return modifiedCount
}

/**
 * Supprime les doublons stricts directement dans PocketBase.
 */
export async function deduplicateTransactionsPB(transactions: Transaction[]): Promise<number> {
  const seen = new Set<string>()
  const duplicateIds: string[] = []

  for (const tx of transactions) {
    const key = `${tx.date}_${tx.debit}_${tx.credit}_${(tx.libelle_operation || tx.libelle_simplifie || '').trim().toUpperCase()}`
    if (seen.has(key)) {
      duplicateIds.push(tx.id)
    } else {
      seen.add(key)
    }
  }

  const CHUNK_SIZE = 20
  for (let i = 0; i < duplicateIds.length; i += CHUNK_SIZE) {
    const chunk = duplicateIds.slice(i, i + CHUNK_SIZE)
    await Promise.all(chunk.map(id => deleteTransactionPB(id)))
  }

  return duplicateIds.length
}

/**
 * Vérifie dans PocketBase si l'onboarding initial a déjà été effectué.
 */
export async function checkOnboardingCompletedPB(): Promise<boolean> {
  try {
    const [rules, txList] = await Promise.all([
      fetchBudgetRulesPB(),
      pb.collection(COLLECTIONS.TRANSACTIONS).getList(1, 1),
    ])
    if (rules && rules.revenus_theoriques > 0) return true
    if (txList.totalItems > 0) return true
    return false
  } catch {
    return true // Ne bloque pas si PocketBase est hors ligne
  }
}

/**
 * Initialise les types de budget et catégories par défaut dans PocketBase s'ils sont vides.
 */
export async function seedDefaultCategoriesAndTypesPB(): Promise<void> {
  try {
    const [existingTypes, existingCats] = await Promise.all([
      fetchBudgetTypes(),
      fetchCategories(),
    ])

    if (existingTypes.length === 0) {
      for (const bt of DEFAULT_BUDGET_TYPES) {
        await saveBudgetTypePB({ ...bt, id: '' }).catch(() => null)
      }
    }

    if (existingCats.length === 0) {
      for (const cat of DEFAULT_CATEGORIES) {
        await saveCategoryPB({ ...cat, id: '' }).catch(() => null)
      }
    }
  } catch (err) {
    console.warn('Erreur seed défaut PocketBase:', err)
  }
}

// ─── PocketBase Remote Data Reset & Clearing ─────────────────────────────────

/**
 * Supprime tous les enregistrements d'une collection PocketBase sans toucher
 * à la collection elle-même ni à ses champs/schémas.
 */
async function clearCollectionRecords(
  collectionName: string,
  onProgress?: (done: number, total: number) => void
): Promise<number> {
  try {
    const records = await pb.collection(collectionName).getFullList<{ id: string }>({
      fields: 'id',
      sort: '-created',
    }).catch(() => [] as { id: string }[])

    if (!records || records.length === 0) return 0

    const CHUNK_SIZE = 25
    let deletedCount = 0

    for (let i = 0; i < records.length; i += CHUNK_SIZE) {
      const chunk = records.slice(i, i + CHUNK_SIZE)
      await Promise.all(
        chunk.map(record =>
          pb.collection(collectionName).delete(record.id).catch(err => {
            console.warn(`Erreur lors de la suppression de ${record.id} dans ${collectionName}:`, err)
            return false
          })
        )
      )
      deletedCount += chunk.length
      onProgress?.(Math.min(deletedCount, records.length), records.length)
    }

    return records.length
  } catch (e) {
    console.warn(`Impossible de vider la collection ${collectionName}:`, e)
    return 0
  }
}

/**
 * Récupère le décompte réel des enregistrements par collection dans PocketBase.
 */
export async function getPocketBaseStats(): Promise<{
  isOnline: boolean
  counts: {
    transactions: number
    fixedExpenses: number
    categories: number
    types: number
    rules: number
    budgetRules: number
  }
}> {
  const online = await checkPocketBaseHealth()
  if (!online) {
    return {
      isOnline: false,
      counts: { transactions: 0, fixedExpenses: 0, categories: 0, types: 0, rules: 0, budgetRules: 0 },
    }
  }

  try {
    const [txList, feList, catList, btList, rList, brList] = await Promise.all([
      pb.collection(COLLECTIONS.TRANSACTIONS).getList(1, 1).catch(() => ({ totalItems: 0 })),
      pb.collection(COLLECTIONS.FIXED_EXPENSES).getList(1, 1).catch(() => ({ totalItems: 0 })),
      pb.collection(COLLECTIONS.CATEGORIES).getList(1, 1).catch(() => ({ totalItems: 0 })),
      pb.collection(COLLECTIONS.BUDGET_TYPES).getList(1, 1).catch(() => ({ totalItems: 0 })),
      pb.collection(COLLECTIONS.CATEGORIZATION_RULES).getList(1, 1).catch(() => ({ totalItems: 0 })),
      pb.collection(COLLECTIONS.BUDGET_RULES).getList(1, 1).catch(() => ({ totalItems: 0 })),
    ])

    return {
      isOnline: true,
      counts: {
        transactions: txList.totalItems || 0,
        fixedExpenses: feList.totalItems || 0,
        categories: catList.totalItems || 0,
        types: btList.totalItems || 0,
        rules: rList.totalItems || 0,
        budgetRules: brList.totalItems || 0,
      },
    }
  } catch {
    return {
      isOnline: true,
      counts: { transactions: 0, fixedExpenses: 0, categories: 0, types: 0, rules: 0, budgetRules: 0 },
    }
  }
}

/**
 * Supprime uniquement les transactions stockées dans PocketBase.
 */
export async function clearPocketBaseTransactions(
  onProgress?: (msg: string) => void
): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  const online = await checkPocketBaseHealth()
  if (!online) {
    return { success: false, deletedCount: 0, error: 'PocketBase est hors-ligne' }
  }

  updateStatus({ isSyncing: true })
  try {
    onProgress?.('Suppression des transactions distantes...')
    const deleted = await clearCollectionRecords(COLLECTIONS.TRANSACTIONS, (done, total) => {
      onProgress?.(`Suppression des transactions : ${done} / ${total}`)
    })
    updateStatus({ isSyncing: false, lastSyncTime: new Date(), error: null })
    return { success: true, deletedCount: deleted }
  } catch (err: any) {
    updateStatus({ isSyncing: false, error: err.message })
    return { success: false, deletedCount: 0, error: err.message || 'Erreur lors de la suppression' }
  }
}

/**
 * Réinitialise les configurations stockées dans PocketBase (catégories, types, règles, dépenses fixes).
 */
export async function clearPocketBaseConfigurations(
  onProgress?: (msg: string) => void
): Promise<{ success: boolean; error?: string }> {
  const online = await checkPocketBaseHealth()
  if (!online) {
    return { success: false, error: 'PocketBase est hors-ligne' }
  }

  updateStatus({ isSyncing: true })
  try {
    const configCollections = [
      { name: COLLECTIONS.CATEGORIZATION_RULES, label: 'règles de catégorisation' },
      { name: COLLECTIONS.FIXED_EXPENSES, label: 'dépenses fixes' },
      { name: COLLECTIONS.BUDGET_RULES, label: 'règles 55/25/20' },
      { name: COLLECTIONS.CATEGORIES, label: 'catégories' },
      { name: COLLECTIONS.BUDGET_TYPES, label: 'types de budget' },
    ]

    for (const col of configCollections) {
      onProgress?.(`Nettoyage des ${col.label} sur PocketBase...`)
      await clearCollectionRecords(col.name)
    }

    updateStatus({ isSyncing: false, lastSyncTime: new Date(), error: null })
    return { success: true }
  } catch (err: any) {
    updateStatus({ isSyncing: false, error: err.message })
    return { success: false, error: err.message || 'Erreur lors de la suppression' }
  }
}

/**
 * Supprime TOUS les enregistrements de TOUTES les collections applicatives dans PocketBase
 * (Remise à zéro complète / Factory Reset distant), sans supprimer les schémas ni les champs.
 */
export async function resetPocketBaseAllData(
  onProgress?: (msg: string, percent: number) => void
): Promise<{ success: boolean; totalDeleted: number; error?: string }> {
  const online = await checkPocketBaseHealth()
  if (!online) {
    return { success: false, totalDeleted: 0, error: 'Serveur PocketBase injoignable' }
  }

  updateStatus({ isSyncing: true })
  try {
    let total = 0
    const collectionsToPurge = [
      { name: COLLECTIONS.TRANSACTIONS, label: 'Transactions bancaires', pct: 20 },
      { name: COLLECTIONS.FIXED_EXPENSES, label: 'Dépenses fixes', pct: 40 },
      { name: COLLECTIONS.CATEGORIZATION_RULES, label: 'Règles de catégorisation', pct: 60 },
      { name: COLLECTIONS.BUDGET_RULES, label: 'Règles 55/25/20', pct: 75 },
      { name: COLLECTIONS.CATEGORIES, label: 'Catégories', pct: 90 },
      { name: COLLECTIONS.BUDGET_TYPES, label: 'Types de budget', pct: 100 },
    ]

    for (const item of collectionsToPurge) {
      onProgress?.(`Suppression des ${item.label.toLowerCase()} sur PocketBase...`, item.pct)
      const count = await clearCollectionRecords(item.name)
      total += count
    }

    onProgress?.('Nettoyage complet de PocketBase terminé.', 100)
    updateStatus({ isSyncing: false, lastSyncTime: new Date(), error: null })
    return { success: true, totalDeleted: total }
  } catch (err: any) {
    updateStatus({ isSyncing: false, error: err.message })
    return { success: false, totalDeleted: 0, error: err.message || 'Erreur inconnue' }
  }
}
