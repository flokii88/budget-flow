import { useState, useRef, useMemo } from 'react'
import Papa from 'papaparse'
import { Transaction, CSVFieldMapping } from '@/lib/types'
import {
  autoCategorize,
  dateToMois,
  parseCSVAmount,
  formatCurrency,
  getCurrencySymbol,
  parseDateToTimestamp,
  resolveTypeForCategory,
} from '@/lib/utils'
import {
  addCategorizationRulePB,
  updateTransactionPB,
  addTransactionsBatch,
} from '@/lib/sync'
import { useCategories, useCategorizationRules, useTransactions, QUERY_KEYS } from '@/lib/queries'
import {
  RECONCILIATION_LABEL,
  RECONCILIATION_TYPE,
  RECONCILIATION_CATEGORY,
} from '@/lib/constants'
import { useQueryClient } from '@tanstack/react-query'
import FieldMapper from './FieldMapper'
import { useTranslation, translateType } from '@/i18n'
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Columns3,
  List,
  Zap,
  Tag,
  Check,
  Search,
  ArrowRight,
  Database,
  FileSpreadsheet,
  Scale,
  Wallet,
  ShieldCheck,
  HelpCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import CategoryBadge from '@/components/transactions/CategoryBadge'

interface CSVImporterProps {
  onImport?: (transactions: Omit<Transaction, 'id' | 'created' | 'updated'>[]) => void
}

type Step = 'upload' | 'map' | 'preview' | 'conflicts' | 'reconciliation' | 'done'
type PreviewViewMode = 'swimlanes' | 'table'
type ConflictChoice = 'keep_existing' | 'replace_with_incoming' | 'keep_both'

interface DuplicateConflict {
  id: string
  incoming: Omit<Transaction, 'id' | 'created' | 'updated'>
  existing: Transaction
  choice: ConflictChoice
}

const getLatestDate = (txs: { date: string }[]): string => {
  if (!txs || txs.length === 0) {
    const d = new Date()
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  }
  let maxTs = 0
  let maxDate = txs[0].date
  for (const t of txs) {
    const ts = parseDateToTimestamp(t.date)
    if (ts > maxTs) {
      maxTs = ts
      maxDate = t.date
    }
  }
  return maxDate
}

export default function CSVImporter({ onImport }: CSVImporterProps) {
  const { t, language } = useTranslation()
  const [step, setStep] = useState<Step>('upload')
  const [columns, setColumns] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([])
  const [parsedTx, setParsedTx] = useState<Omit<Transaction, 'id' | 'created' | 'updated'>[]>([])
  const [dragging, setDragging] = useState(false)
  const [filename, setFilename] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // View mode during preview/categorization step
  const [viewMode, setViewMode] = useState<PreviewViewMode>('swimlanes')

  // Rule automation state
  const [rulePattern, setRulePattern] = useState('')
  const [ruleCategory, setRuleCategory] = useState('')
  const [ruleRemember, setRuleRemember] = useState(true)
  const [ruleFeedback, setRuleFeedback] = useState<string | null>(null)

  // Search filter inside preview
  const [filterQuery, setFilterQuery] = useState('')

  // Conflicts state
  const [conflicts, setConflicts] = useState<DuplicateConflict[]>([])
  const [nonConflictingTx, setNonConflictingTx] = useState<
    Omit<Transaction, 'id' | 'created' | 'updated'>[]
  >([])

  // Prepared pending changes before reconciliation
  const [pendingToAdd, setPendingToAdd] = useState<
    Omit<Transaction, 'id' | 'created' | 'updated'>[]
  >([])
  const [pendingToReplace, setPendingToReplace] = useState<
    { existing: Transaction; incoming: Omit<Transaction, 'id' | 'created' | 'updated'> }[]
  >([])
  const [ignoredCount, setIgnoredCount] = useState<number>(0)

  // Reconciliation state
  const [bankBalanceInput, setBankBalanceInput] = useState<string>('')
  const [enableReconciliation, setEnableReconciliation] = useState<boolean>(true)
  const [reconcilDate, setReconcilDate] = useState<string>('')

  const [importSummary, setImportSummary] = useState({
    added: 0,
    replaced: 0,
    ignored: 0,
    reconciliationAdded: false,
    reconciliationAmount: 0,
    finalTargetBalance: null as number | null,
  })

  const queryClient = useQueryClient()
  const { data: categories = [] } = useCategories()
  const { data: categorizationRules = [] } = useCategorizationRules()
  const { data: existingTransactions = [] } = useTransactions()
  const existingCredits = useMemo(
    () => existingTransactions.reduce((acc, t) => acc + (t.credit || 0), 0),
    [existingTransactions]
  )
  const existingDebits = useMemo(
    () => existingTransactions.reduce((acc, t) => acc + (t.debit || 0), 0),
    [existingTransactions]
  )
  const existingBalance = existingCredits - existingDebits

  const handleFile = (file: File) => {
    setFilename(file.name)
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: '', // auto-detect
      complete: result => {
        if (result.data.length > 0) {
          setColumns(Object.keys(result.data[0]))
          setRawRows(result.data)
          setStep('map')
        }
      },
    })
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
      handleFile(file)
    }
  }

  const handleMapping = (mapping: CSVFieldMapping) => {
    const txs: Omit<Transaction, 'id' | 'created' | 'updated'>[] = []

    for (const row of rawRows) {
      const libelleOp = row[mapping.libelle_operation] || ''
      const libelleSimplifie = mapping.libelle_simplifie
        ? row[mapping.libelle_simplifie] || libelleOp
        : libelleOp

      let debit = 0
      let credit = 0

      if (mapping.debit && mapping.credit && mapping.debit === mapping.credit) {
        // Colonne unique de montant avec signe (+ / -)
        const raw = row[mapping.debit] || '0'
        const cleaned = raw.replace(/\s/g, '').replace(',', '.').replace(/[^0-9.\-]/g, '')
        const val = parseFloat(cleaned) || 0
        if (val < 0) {
          debit = Math.abs(val)
          credit = 0
        } else if (val > 0) {
          credit = val
          debit = 0
        }
      } else {
        const debitRaw = row[mapping.debit] || '0'
        const creditRaw = row[mapping.credit] || '0'
        debit = parseCSVAmount(debitRaw)
        credit = parseCSVAmount(creditRaw)
      }

      if (debit === 0 && credit === 0) continue

      let dateStr = row[mapping.date] || ''
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
        const [y, m, d] = dateStr.split('-')
        dateStr = `${d}/${m}/${y}`
      }

      const isCredit = credit > 0
      const auto = autoCategorize(libelleSimplifie || libelleOp, categorizationRules, categories)
      const catFromFile = mapping.categorie ? row[mapping.categorie] : null

      const finalCategory = isCredit ? (catFromFile || 'Revenus') : (catFromFile || auto.categorie)
      const finalType = isCredit ? 'Revenu' : (resolveTypeForCategory(categories, finalCategory) || auto.type)

      txs.push({
        date: dateStr,
        mois: dateToMois(dateStr),
        libelle_simplifie: libelleSimplifie,
        libelle_operation: libelleOp,
        categorie: finalCategory,
        type: finalType,
        debit: isCredit ? 0 : debit,
        credit: isCredit ? credit : 0,
      })
    }

    setParsedTx(txs)
    if (categories.length > 0) {
      setRuleCategory(categories[0].nom)
    }
    setStep('preview')
  }

  // ─── Swimlane Pattern Matching Rule Application ───────────────────────────

  const handleApplyRule = async () => {
    if (!rulePattern.trim() || !ruleCategory) return
    const patternUpper = rulePattern.trim().toUpperCase()

    let affectedCount = 0
    const updated = parsedTx.map(tx => {
      const targetStr = (tx.libelle_simplifie + ' ' + tx.libelle_operation).toUpperCase()
      if (targetStr.includes(patternUpper)) {
        affectedCount++
        const isCredit = tx.credit > 0
        return {
          ...tx,
          categorie: ruleCategory,
          type: isCredit ? 'Revenu' : resolveTypeForCategory(categories, ruleCategory),
        }
      }
      return tx
    })

    setParsedTx(updated)

    if (ruleRemember) {
      await addCategorizationRulePB(rulePattern.trim(), ruleCategory)
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.categorizationRules })
    }

    setRuleFeedback(t('csv.ruleFeedback', { count: affectedCount, cat: ruleCategory }))
    setTimeout(() => setRuleFeedback(null), 3500)
    setRulePattern('')
  }

  // Pre-fill rule from a transaction card
  const handlePreFillRule = (libelle: string) => {
    const cleanWord = libelle.replace(/[^a-zA-Z0-9\s]/g, '').trim().split(' ')[0]
    setRulePattern(cleanWord || libelle)
  }

  // Single transaction category update
  const handleUpdateTxCategory = (index: number, newCat: string) => {
    setParsedTx(prev => {
      const next = [...prev]
      const tx = next[index]
      const isCredit = tx.credit > 0
      next[index] = {
        ...tx,
        categorie: newCat,
        type: isCredit ? 'Revenu' : resolveTypeForCategory(categories, newCat),
      }
      return next
    })
  }

  // ─── Transition vers la Réconciliation ────────────────────────────────────

  const initReconciliationState = (
    toAddList: Omit<Transaction, 'id' | 'created' | 'updated'>[],
    toReplaceList: { existing: Transaction; incoming: Omit<Transaction, 'id' | 'created' | 'updated'> }[],
    ignoredNum: number
  ) => {
    setPendingToAdd(toAddList)
    setPendingToReplace(toReplaceList)
    setIgnoredCount(ignoredNum)

    const latest = getLatestDate(parsedTx)
    setReconcilDate(latest)
    setEnableReconciliation(true)
  }

  // ─── Détection de Doublons (Comparaison sur Date et Montant) ───────────────

  const handleStartImportValidation = () => {
    const currentExisting = existingTransactions
    const detectedConflicts: DuplicateConflict[] = []
    const safeTx: Omit<Transaction, 'id' | 'created' | 'updated'>[] = []

    const alreadyMatchedExistingIds = new Set<string>()

    for (const incoming of parsedTx) {
      const incomingTimestamp = parseDateToTimestamp(incoming.date)

      const match = currentExisting.find(existing => {
        if (alreadyMatchedExistingIds.has(existing.id)) return false

        const existingTimestamp = parseDateToTimestamp(existing.date)
        const isSameDate = incomingTimestamp > 0 && incomingTimestamp === existingTimestamp

        const sameDebit = incoming.debit > 0 && Math.abs(incoming.debit - existing.debit) < 0.005
        const sameCredit = incoming.credit > 0 && Math.abs(incoming.credit - existing.credit) < 0.005
        const isSameAmount = sameDebit || sameCredit

        return isSameDate && isSameAmount
      })

      if (match) {
        alreadyMatchedExistingIds.add(match.id)
        detectedConflicts.push({
          id: Math.random().toString(36).substring(2),
          incoming,
          existing: match,
          choice: 'keep_existing',
        })
      } else {
        safeTx.push(incoming)
      }
    }

    if (detectedConflicts.length > 0) {
      setConflicts(detectedConflicts)
      setNonConflictingTx(safeTx)
      setStep('conflicts')
    } else {
      setConflicts([])
      setNonConflictingTx(safeTx)
      initReconciliationState(safeTx, [], 0)
      setStep('reconciliation')
    }
  }

  // Batch actions on conflicts
  const setAllConflictChoices = (choice: ConflictChoice) => {
    setConflicts(prev => prev.map(c => ({ ...c, choice })))
  }

  const setSingleConflictChoice = (id: string, choice: ConflictChoice) => {
    setConflicts(prev => prev.map(c => (c.id === id ? { ...c, choice } : c)))
  }

  // Transition de la résolution des doublons vers la réconciliation
  const handleProceedToReconciliationFromConflicts = () => {
    const toAdd: Omit<Transaction, 'id' | 'created' | 'updated'>[] = [...nonConflictingTx]
    const toReplace: { existing: Transaction; incoming: Omit<Transaction, 'id' | 'created' | 'updated'> }[] = []
    let ignored = 0

    for (const conflict of conflicts) {
      if (conflict.choice === 'replace_with_incoming') {
        toReplace.push({ existing: conflict.existing, incoming: conflict.incoming })
      } else if (conflict.choice === 'keep_both') {
        toAdd.push(conflict.incoming)
      } else if (conflict.choice === 'keep_existing') {
        ignored++
      }
    }

    initReconciliationState(toAdd, toReplace, ignored)
    setStep('reconciliation')
  }

  // ─── Calculs de Réconciliation ────────────────────────────────────────────

  const netImportImpact = useMemo(() => {
    const addedCredits = pendingToAdd.reduce((s, t) => s + (t.credit || 0), 0)
    const addedDebits = pendingToAdd.reduce((s, t) => s + (t.debit || 0), 0)
    const addedNet = addedCredits - addedDebits

    const replacedDelta = pendingToReplace.reduce((acc, item) => {
      const oldNet = (item.existing.credit || 0) - (item.existing.debit || 0)
      const newNet = (item.incoming.credit || 0) - (item.incoming.debit || 0)
      return acc + (newNet - oldNet)
    }, 0)

    return addedNet + replacedDelta
  }, [pendingToAdd, pendingToReplace])

  const theoreticalTotal = useMemo(() => {
    return existingBalance + netImportImpact
  }, [existingBalance, netImportImpact])

  const cleanedBankInput = bankBalanceInput.replace(/\s/g, '').replace(',', '.')
  const parsedBankBalance = parseFloat(cleanedBankInput)
  const hasEnteredBalance = !isNaN(parsedBankBalance) && bankBalanceInput.trim() !== ''

  const discrepancy = hasEnteredBalance
    ? Math.round((parsedBankBalance - theoreticalTotal) * 100) / 100
    : 0
  const isSynchronized = hasEnteredBalance && Math.abs(discrepancy) < 0.005

  // ─── Exécution Finale de l'Importation ────────────────────────────────────

  const handleFinalizeImport = async (applyReconcil: boolean) => {
    let replacedCount = 0
    for (const item of pendingToReplace) {
      await updateTransactionPB(item.existing.id, {
        date: item.incoming.date,
        mois: item.incoming.mois,
        libelle_simplifie: item.incoming.libelle_simplifie,
        libelle_operation: item.incoming.libelle_operation,
        categorie: item.incoming.categorie,
        type: item.incoming.type,
        debit: item.incoming.debit,
        credit: item.incoming.credit,
      })
      replacedCount++
    }

    const finalToAdd = [...pendingToAdd]
    let reconcilCreated = false

    if (applyReconcil && hasEnteredBalance && !isSynchronized) {
      const isPositive = discrepancy > 0
      const d = reconcilDate.trim() || getLatestDate(parsedTx)

      const reconcilTx: Omit<Transaction, 'id' | 'created' | 'updated'> = {
        date: d,
        mois: dateToMois(d),
        libelle_simplifie: RECONCILIATION_LABEL,
        libelle_operation: RECONCILIATION_LABEL,
        categorie: RECONCILIATION_CATEGORY,
        type: RECONCILIATION_TYPE,
        debit: isPositive ? 0 : Math.abs(discrepancy),
        credit: isPositive ? discrepancy : 0,
      }
      finalToAdd.push(reconcilTx)
      reconcilCreated = true
    }

    if (finalToAdd.length > 0) {
      await addTransactionsBatch(finalToAdd)
      onImport?.(finalToAdd)
    }

    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.transactions })

    setImportSummary({
      added: finalToAdd.length,
      replaced: replacedCount,
      ignored: ignoredCount,
      reconciliationAdded: reconcilCreated,
      reconciliationAmount: discrepancy,
      finalTargetBalance: hasEnteredBalance ? parsedBankBalance : null,
    })

    setStep('done')
  }

  // ─── Group Transactions by Swimlanes ──────────────────────────────────────

  const swimlanes = useMemo(() => {
    const groups: Record<
      string,
      { tx: Omit<Transaction, 'id' | 'created' | 'updated'>; originalIndex: number }[]
    > = {}

    categories.forEach(c => {
      groups[c.nom] = []
    })
    groups['Divers'] = []
    groups['Revenus'] = []

    parsedTx.forEach((tx, idx) => {
      if (
        filterQuery &&
        !tx.libelle_simplifie.toLowerCase().includes(filterQuery.toLowerCase()) &&
        !tx.libelle_operation.toLowerCase().includes(filterQuery.toLowerCase())
      ) {
        return
      }

      const cat = tx.categorie || 'Divers'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push({ tx, originalIndex: idx })
    })

    const keys = Object.keys(groups).sort((a, b) => {
      if (a === 'Divers') return -1
      if (b === 'Divers') return 1
      const countA = groups[a].length
      const countB = groups[b].length
      if (countA > 0 && countB === 0) return -1
      if (countB > 0 && countA === 0) return 1
      return countB - countA
    })

    return keys.map(key => ({
      categorie: key,
      items: groups[key],
      totalDebit: groups[key].reduce((s, i) => s + i.tx.debit, 0),
      totalCredit: groups[key].reduce((s, i) => s + i.tx.credit, 0),
    }))
  }, [parsedTx, categories, filterQuery])

  const uncategorizedCount = parsedTx.filter(t => t.categorie === 'Divers' || !t.categorie).length

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { key: 'upload', label: t('csv.step1') },
          { key: 'map', label: t('csv.step2') },
          { key: 'preview', label: t('csv.step3') },
          ...(conflicts.length > 0 ? [{ key: 'conflicts', label: t('csv.step4Conflicts') }] : []),
          { key: 'reconciliation', label: t('csv.stepReconcil', { num: conflicts.length > 0 ? '5' : '4' }) },
        ].map((s, i, arr) => {
          const stepOrder = ['upload', 'map', 'preview', 'conflicts', 'reconciliation', 'done']
          const currentIdx = stepOrder.indexOf(step)
          const thisIdx = stepOrder.indexOf(s.key)
          const isDone = currentIdx > thisIdx
          const isCurrent = step === s.key

          return (
            <div key={s.key} className="flex items-center gap-2">
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                  isCurrent
                    ? 'bg-primary-600 text-white shadow-sm ring-2 ring-primary-500/20'
                    : isDone
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                )}
              >
                {isDone ? '✓' : i + 1}
              </div>
              <span
                className={cn(
                  'text-xs font-semibold hidden sm:block',
                  isCurrent
                    ? 'text-primary-600 dark:text-primary-400 font-bold'
                    : isDone
                      ? 'text-gray-700 dark:text-gray-300'
                      : 'text-gray-400'
                )}
              >
                {s.label}
              </span>
              {i < arr.length - 1 && <div className="w-6 h-px bg-gray-200 dark:bg-gray-700" />}
            </div>
          )
        })}
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div
          onDragOver={e => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200',
            dragging
              ? 'border-primary-400 bg-primary-50 dark:bg-primary-950/20'
              : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <Upload className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">
            {t('csv.dropTitle')}
          </p>
          <p className="text-sm text-gray-400">{t('csv.dropSub')}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            {t('csv.dropSep')}
          </p>
        </div>
      )}

      {/* Step 2: Map */}
      {step === 'map' && (
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-primary-500" />
            <p className="text-sm font-semibold">{filename}</p>
            <span className="text-xs text-gray-400">{t('csv.rowsDetected', { count: rawRows.length })}</span>
          </div>
          <FieldMapper
            columns={columns}
            onConfirm={handleMapping}
            onCancel={() => setStep('upload')}
          />
        </div>
      )}

      {/* Step 3: Preview & Swimlanes Categorization */}
      {step === 'preview' && (
        <div className="space-y-5 animate-fade-in">
          {/* Top Bar with KPI and Confirm */}
          <div className="flex items-center justify-between flex-wrap gap-3 card p-4">
            <div>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-primary-500" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  {t('csv.txReady', { count: parsedTx.length })}
                </h3>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {uncategorizedCount > 0 ? (
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">
                    {t('csv.uncategorizedWarn', { count: uncategorizedCount })}
                  </span>
                ) : (
                  <span className="text-emerald-600 font-semibold">
                    {t('csv.allCategorized')}
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-gray-100 dark:bg-gray-800 p-0.5 rounded-xl">
                <button
                  onClick={() => setViewMode('swimlanes')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                    viewMode === 'swimlanes'
                      ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
                  )}
                >
                  <Columns3 className="w-3.5 h-3.5" />
                  {t('csv.viewSwimlanes')}
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                    viewMode === 'table'
                      ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
                  )}
                >
                  <List className="w-3.5 h-3.5" />
                  {t('csv.viewTable')}
                </button>
              </div>

              <button onClick={() => setStep('map')} className="btn-secondary text-xs">
                {t('common.back')}
              </button>
              <button
                onClick={handleStartImportValidation}
                className="btn-primary text-xs shadow-md"
              >
                {t('csv.continueImport')} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* BANDEAU DE RÈGLE RAPIDE / PATTERN MATCHING */}
          <div className="card p-4 bg-gradient-to-r from-primary-50/60 to-indigo-50/60 dark:from-primary-950/20 dark:to-indigo-950/20 border border-primary-100 dark:border-primary-900/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-primary-600 text-white rounded-lg">
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                  {t('csv.ruleBannerTitle')}
                </h4>
              </div>

              {ruleFeedback && (
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-lg animate-fade-in">
                  ✓ {ruleFeedback}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                {t('csv.ifLabelContains')}
              </span>
              <input
                className="input text-xs py-1.5 px-3 flex-1 min-w-[160px] bg-white dark:bg-gray-900"
                placeholder={t('csv.rulePlaceholder')}
                value={rulePattern}
                onChange={e => setRulePattern(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleApplyRule()}
              />

              <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                {t('csv.applyCategory')}
              </span>
              <select
                className="input text-xs py-1.5 px-3 w-auto cursor-pointer bg-white dark:bg-gray-900 font-medium"
                value={ruleCategory}
                onChange={e => setRuleCategory(e.target.value)}
              >
                {categories.map(c => (
                  <option key={c.id} value={c.nom}>
                    {c.nom} ({c.types.map(tp => translateType(tp, language)).join(', ')})
                  </option>
                ))}
              </select>

              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={ruleRemember}
                  onChange={e => setRuleRemember(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                {t('csv.rememberRule')}
              </label>

              <button
                onClick={handleApplyRule}
                disabled={!rulePattern.trim() || !ruleCategory}
                className="btn-primary text-xs py-1.5 px-3.5 disabled:opacity-40 shadow-sm"
              >
                <Zap className="w-3.5 h-3.5" /> {t('csv.applyToImport')}
              </button>
            </div>
          </div>

          {/* Search bar inside categorization */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="input pl-9 text-xs py-2 bg-white dark:bg-gray-900"
              placeholder={t('csv.filterPlaceholder')}
              value={filterQuery}
              onChange={e => setFilterQuery(e.target.value)}
            />
          </div>

          {/* VUE 1: SWIMLANES PAR CATÉGORIES */}
          {viewMode === 'swimlanes' && (
            <div className="flex gap-4 overflow-x-auto pb-4 pt-1 items-start min-h-[420px]">
              {swimlanes
                .filter(lane => lane.items.length > 0 || lane.categorie === 'Divers')
                .map(lane => {
                  const isDivers = lane.categorie === 'Divers'
                  return (
                    <div
                      key={lane.categorie}
                      className={cn(
                        'w-72 flex-shrink-0 flex flex-col rounded-2xl border transition-all',
                        isDivers
                          ? 'bg-amber-50/50 dark:bg-amber-950/10 border-amber-300 dark:border-amber-800'
                          : 'bg-gray-50/70 dark:bg-gray-900/40 border-gray-200 dark:border-gray-800'
                      )}
                    >
                      <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 truncate">
                          <Tag className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">
                            {lane.categorie}
                          </h4>
                        </div>
                        <span
                          className={cn(
                            'badge text-[11px] font-bold px-2 py-0.5',
                            isDivers && lane.items.length > 0
                              ? 'bg-amber-200 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border'
                          )}
                        >
                          {lane.items.length}
                        </span>
                      </div>

                      <div className="p-2 space-y-2 max-h-[500px] overflow-y-auto">
                        {lane.items.length === 0 ? (
                          <div className="p-6 text-center text-xs text-gray-400 italic">
                            {t('csv.emptySwimlane')}
                          </div>
                        ) : (
                          lane.items.map(({ tx, originalIndex }) => (
                            <div
                              key={originalIndex}
                              className="card p-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow space-y-2"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                                    {tx.libelle_simplifie}
                                  </p>
                                  <p
                                    className="text-[10px] text-gray-400 truncate"
                                    title={tx.libelle_operation}
                                  >
                                    {tx.libelle_operation}
                                  </p>
                                </div>
                                <span className="text-[11px] font-bold whitespace-nowrap">
                                  {tx.credit > 0 ? (
                                    <span className="text-emerald-600">
                                      +{formatCurrency(tx.credit)}
                                    </span>
                                  ) : (
                                    <span className="text-red-600">
                                      -{formatCurrency(tx.debit)}
                                    </span>
                                  )}
                                </span>
                              </div>

                              <div className="flex items-center justify-between pt-1 border-t border-gray-50 dark:border-gray-800/80 text-[10px]">
                                <span className="text-gray-400">{tx.date}</span>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handlePreFillRule(
                                        tx.libelle_simplifie || tx.libelle_operation
                                      )
                                    }
                                    className="text-primary-600 dark:text-primary-400 hover:underline font-semibold"
                                    title={t('csv.createRuleTitle')}
                                  >
                                    {t('csv.ruleShort')}
                                  </button>

                                  <select
                                    className="bg-gray-50 dark:bg-gray-800 text-[10px] py-0.5 px-1 rounded border border-gray-200 dark:border-gray-700 cursor-pointer"
                                    value={tx.categorie}
                                    onChange={e =>
                                      handleUpdateTxCategory(originalIndex, e.target.value)
                                    }
                                  >
                                    {categories.map(c => (
                                      <option key={c.id} value={c.nom}>
                                        ➔ {c.nom}
                                      </option>
                                    ))}
                                    <option value="Divers">➔ Divers</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
          )}

          {/* VUE 2: TABLEAU CLASSIQUE */}
          {viewMode === 'table' && (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 z-10">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500">{t('csv.colDate')}</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500">{t('csv.colLabel')}</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 w-32">{t('csv.colType')}</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 w-48">{t('csv.colCategory')}</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-500">{t('csv.colDebit')}</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-500">{t('csv.colCredit')}</th>
                      <th className="px-3 py-2 text-center font-semibold text-gray-500">{t('csv.colRule')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                    {parsedTx.map((tx, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-3 py-2 text-gray-500">{tx.date}</td>
                        <td
                          className="px-3 py-2 font-medium truncate max-w-[200px]"
                          title={tx.libelle_operation}
                        >
                          {tx.libelle_simplifie}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={cn(
                              'badge text-[10px]',
                              tx.type === 'Revenu'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                            )}
                          >
                            {translateType(tx.type, language)}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            className="input text-xs py-1 px-2 cursor-pointer w-full"
                            value={tx.categorie}
                            onChange={e => handleUpdateTxCategory(i, e.target.value)}
                          >
                            {categories.map(c => (
                              <option key={c.id} value={c.nom}>
                                {c.nom}
                              </option>
                            ))}
                            <option value="Divers">Divers</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 text-right text-red-500 font-semibold">
                          {tx.debit > 0 && `-${formatCurrency(tx.debit)}`}
                        </td>
                        <td className="px-3 py-2 text-right text-emerald-500 font-semibold">
                          {tx.credit > 0 && `+${formatCurrency(tx.credit)}`}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              handlePreFillRule(tx.libelle_simplifie || tx.libelle_operation)
                            }
                            className="p-1 rounded hover:bg-primary-50 text-primary-600"
                            title={t('csv.createRuleBtnTitle')}
                          >
                            <Zap className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Step 4: Résolution des Doublons (Date & Montant identiques) ──── */}
      {step === 'conflicts' && (
        <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
          <div className="card p-5 border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500 text-white rounded-xl">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    {t('csv.conflictsTitle', { count: conflicts.length })}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('csv.conflictsSub')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setAllConflictChoices('keep_existing')}
                  className="btn-secondary text-xs"
                >
                  {t('csv.keepAllBase')}
                </button>
                <button
                  onClick={() => setAllConflictChoices('replace_with_incoming')}
                  className="btn-secondary text-xs"
                >
                  {t('csv.replaceAllFile')}
                </button>
                <button
                  onClick={() => setAllConflictChoices('keep_both')}
                  className="btn-secondary text-xs"
                >
                  {t('csv.keepBothAll')}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {conflicts.map(conflict => {
              const amount =
                conflict.incoming.credit > 0
                  ? conflict.incoming.credit
                  : conflict.incoming.debit
              const isCredit = conflict.incoming.credit > 0

              return (
                <div
                  key={conflict.id}
                  className="card p-4 space-y-3 border-gray-200 dark:border-gray-800 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                      {t('csv.datePrefix')} {conflict.incoming.date}
                    </span>
                    <span
                      className={cn(
                        'text-sm font-bold',
                        isCredit ? 'text-emerald-600' : 'text-red-600'
                      )}
                    >
                      {isCredit ? '+' : '-'}
                      {formatCurrency(amount)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* Option Base existante */}
                    <div
                      onClick={() => setSingleConflictChoice(conflict.id, 'keep_existing')}
                      className={cn(
                        'p-3 rounded-xl border transition-all cursor-pointer',
                        conflict.choice === 'keep_existing'
                          ? 'border-primary-500 bg-primary-50/40 dark:bg-primary-950/20 ring-1 ring-primary-500'
                          : 'border-gray-100 dark:border-gray-800 hover:bg-gray-50/60 dark:hover:bg-gray-800/40'
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="flex items-center gap-1.5 font-bold text-gray-700 dark:text-gray-300">
                          <Database className="w-3.5 h-3.5 text-primary-600" />
                          {t('csv.baseRow')}
                        </span>
                        {conflict.choice === 'keep_existing' && (
                          <span className="badge text-[10px] bg-primary-600 text-white font-bold">
                            {t('csv.selectedBadge')}
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-gray-900 dark:text-white truncate">
                        {conflict.existing.libelle_simplifie}
                      </p>
                      <p className="text-[11px] text-gray-400 truncate">
                        {conflict.existing.libelle_operation}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge type={conflict.existing.type} />
                        <CategoryBadge categorie={conflict.existing.categorie} />
                      </div>
                    </div>

                    {/* Option Fichier CSV importé */}
                    <div
                      onClick={() =>
                        setSingleConflictChoice(conflict.id, 'replace_with_incoming')
                      }
                      className={cn(
                        'p-3 rounded-xl border transition-all cursor-pointer',
                        conflict.choice === 'replace_with_incoming'
                          ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 ring-1 ring-emerald-500'
                          : 'border-gray-100 dark:border-gray-800 hover:bg-gray-50/60 dark:hover:bg-gray-800/40'
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="flex items-center gap-1.5 font-bold text-gray-700 dark:text-gray-300">
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                          {t('csv.csvRow')}
                        </span>
                        {conflict.choice === 'replace_with_incoming' && (
                          <span className="badge text-[10px] bg-emerald-600 text-white font-bold">
                            {t('csv.selectedBadge')}
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-gray-900 dark:text-white truncate">
                        {conflict.incoming.libelle_simplifie}
                      </p>
                      <p className="text-[11px] text-gray-400 truncate">
                        {conflict.incoming.libelle_operation}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge type={conflict.incoming.type} />
                        <CategoryBadge categorie={conflict.incoming.categorie} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setSingleConflictChoice(conflict.id, 'keep_existing')}
                      className={cn(
                        'px-2.5 py-1 rounded-lg font-medium transition-all',
                        conflict.choice === 'keep_existing'
                          ? 'bg-primary-600 text-white font-semibold'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                      )}
                    >
                      {t('csv.keepBase')}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSingleConflictChoice(conflict.id, 'replace_with_incoming')
                      }
                      className={cn(
                        'px-2.5 py-1 rounded-lg font-medium transition-all',
                        conflict.choice === 'replace_with_incoming'
                          ? 'bg-emerald-600 text-white font-semibold'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                      )}
                    >
                      {t('csv.replaceFile')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSingleConflictChoice(conflict.id, 'keep_both')}
                      className={cn(
                        'px-2.5 py-1 rounded-lg font-medium transition-all',
                        conflict.choice === 'keep_both'
                          ? 'bg-purple-600 text-white font-semibold'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                      )}
                    >
                      {t('csv.keepBoth')}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
            <button onClick={() => setStep('preview')} className="btn-secondary text-xs">
              {t('csv.backToPreview')}
            </button>

            <button
              onClick={handleProceedToReconciliationFromConflicts}
              className="btn-primary text-xs shadow-md"
            >
              {t('csv.nextReconcil')} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 5: Réconciliation & Contrôle du Solde Bancaire ─────────── */}
      {step === 'reconciliation' && (
        <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
          {/* Header Card */}
          <div className="card p-6 border-indigo-100 dark:border-indigo-900/40 bg-gradient-to-br from-indigo-50/50 via-white to-primary-50/30 dark:from-indigo-950/20 dark:via-gray-900 dark:to-primary-950/20 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-sm">
                <Scale className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  {t('csv.reconcilTitle')}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {t('csv.reconcilSub')}
                </p>
              </div>
            </div>

            {/* Input Solde Actuel */}
            <div className="p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-2">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                {t('csv.bankBalanceQuestion')}
              </label>
              <div className="relative max-w-sm">
                <input
                  type="text"
                  autoFocus
                  className="input text-lg font-bold py-2.5 pl-3 pr-10 bg-gray-50/60 dark:bg-gray-800/60"
                  placeholder={t('csv.bankBalancePlaceholder')}
                  value={bankBalanceInput}
                  onChange={e => setBankBalanceInput(e.target.value)}
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">
                  {getCurrencySymbol()}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {t('csv.bankBalanceOptional')}
              </p>
            </div>

            {/* 3 Cartes de Calcul en Direct */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {/* Carte 1 : Base existante */}
              <div className="p-3.5 rounded-xl bg-gray-50/80 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                  <Database className="w-3.5 h-3.5" />
                  <span className="font-semibold uppercase tracking-wider text-[10px]">
                    {t('csv.baseBalance')}
                  </span>
                </div>
                <p className="text-base font-bold text-gray-800 dark:text-gray-200">
                  {formatCurrency(existingBalance)}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {t('csv.baseOpsCount', { count: existingTransactions.length })}
                </p>
              </div>

              {/* Carte 2 : Impact Import */}
              <div className="p-3.5 rounded-xl bg-gray-50/80 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span className="font-semibold uppercase tracking-wider text-[10px]">
                    {t('csv.netImpact')}
                  </span>
                </div>
                <p
                  className={cn(
                    'text-base font-bold',
                    netImportImpact >= 0 ? 'text-emerald-600' : 'text-red-600'
                  )}
                >
                  {netImportImpact >= 0 ? '+' : ''}
                  {formatCurrency(netImportImpact)}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {t('csv.impactBreakdown', { add: pendingToAdd.length, replace: pendingToReplace.length })}
                </p>
              </div>

              {/* Carte 3 : Solde Théorique Total */}
              <div className="p-3.5 rounded-xl bg-primary-50/70 dark:bg-primary-950/30 border border-primary-200 dark:border-primary-800">
                <div className="flex items-center gap-1.5 text-primary-700 dark:text-primary-300 mb-1">
                  <Wallet className="w-3.5 h-3.5" />
                  <span className="font-semibold uppercase tracking-wider text-[10px]">
                    {t('csv.newCalcBalance')}
                  </span>
                </div>
                <p className="text-base font-bold text-primary-700 dark:text-primary-300">
                  {formatCurrency(theoreticalTotal)}
                </p>
                <p className="text-[10px] text-primary-600/80 dark:text-primary-400/80 mt-0.5">
                  {t('csv.cumulHistory')}
                </p>
              </div>
            </div>

            {/* Analyse de l'Écart */}
            {hasEnteredBalance && (
              <div className="pt-2 animate-fade-in space-y-3">
                {isSynchronized ? (
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center gap-3">
                    <ShieldCheck className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">
                        {t('csv.syncedTitle')}
                      </p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                        {t('csv.syncedDesc', { amount: formatCurrency(parsedBankBalance) })}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="card p-4 border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 space-y-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-start gap-2.5">
                        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-amber-900 dark:text-amber-100">
                            {t('csv.discrepancyTitle', { amount: `${discrepancy > 0 ? '+' : ''}${formatCurrency(discrepancy)}` })}
                          </p>
                          <p className="text-xs text-amber-800 dark:text-amber-200 mt-0.5">
                            {discrepancy > 0
                              ? t('csv.discrepancyMore', { amount: formatCurrency(discrepancy) })
                              : t('csv.discrepancyLess', { amount: formatCurrency(Math.abs(discrepancy)) })}
                          </p>
                        </div>
                      </div>

                      <label className="flex items-center gap-2 text-xs font-bold text-gray-800 dark:text-gray-200 cursor-pointer bg-white dark:bg-gray-900 px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800 shadow-sm">
                        <input
                          type="checkbox"
                          checked={enableReconciliation}
                          onChange={e => setEnableReconciliation(e.target.checked)}
                          className="rounded text-primary-600 focus:ring-primary-500"
                        />
                        <span>{t('csv.createAdjustTx')}</span>
                      </label>
                    </div>

                    {/* Détails éditables de la transaction d'ajustement */}
                    {enableReconciliation && (
                      <div className="p-3.5 bg-white dark:bg-gray-900 rounded-xl border border-amber-200/80 dark:border-amber-800/80 space-y-3">
                        <p className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          {t('csv.adjustDetailsTitle')}
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                          <div>
                            <label className="text-[10px] text-gray-400 font-semibold block mb-1">
                              {t('csv.adjustLabel')}
                            </label>
                            <input
                              className="input text-xs py-1.5 px-2.5 bg-gray-100 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                              value={RECONCILIATION_LABEL}
                              readOnly
                              disabled
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-gray-400 font-semibold block mb-1">
                              {t('csv.adjustDate')}
                            </label>
                            <input
                              className="input text-xs py-1.5 px-2.5"
                              value={reconcilDate}
                              onChange={e => setReconcilDate(e.target.value)}
                              placeholder={t('csv.adjustDatePlaceholder')}
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-gray-400 font-semibold block mb-1">
                              {t('csv.adjustAmountType')}
                            </label>
                            <div className="flex items-center gap-1.5 h-8">
                              <span
                                className={cn(
                                  'font-bold text-xs px-2 py-1 rounded-lg',
                                  discrepancy > 0
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                    : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                                )}
                              >
                                {discrepancy > 0 ? '+' : '-'}
                                {formatCurrency(Math.abs(discrepancy))}
                              </span>
                              <Badge type={RECONCILIATION_TYPE} />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Boutons d'Action */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => (conflicts.length > 0 ? setStep('conflicts') : setStep('preview'))}
              className="btn-secondary text-xs"
            >
              {t('common.back')}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleFinalizeImport(false)}
                className="btn-secondary text-xs"
              >
                {t('csv.finalizeNoReconcil')}
              </button>

              <button
                type="button"
                onClick={() => handleFinalizeImport(enableReconciliation)}
                className="btn-primary text-xs shadow-md"
              >
                <Check className="w-4 h-4" />
                {enableReconciliation && hasEnteredBalance && !isSynchronized
                  ? t('csv.validateWithReconcil')
                  : t('csv.finalizeImport')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 6: Done */}
      {step === 'done' && (
        <div className="card p-12 text-center max-w-lg mx-auto space-y-4">
          <CheckCircle className="w-14 h-14 mx-auto text-emerald-500 animate-fade-in" />
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {t('csv.doneTitle')}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {t('csv.doneSub')}
            </p>
          </div>

          {/* Summary Box */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700/60 text-xs space-y-2 text-left">
            <p className="flex justify-between font-medium">
              <span className="text-emerald-600 font-semibold">{t('csv.summaryAdded')}</span>
              <span className="font-bold text-gray-900 dark:text-white">
                {importSummary.added}
              </span>
            </p>
            {importSummary.replaced > 0 && (
              <p className="flex justify-between font-medium">
                <span className="text-blue-600 font-semibold">{t('csv.summaryReplaced')}</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {importSummary.replaced}
                </span>
              </p>
            )}
            {importSummary.ignored > 0 && (
              <p className="flex justify-between font-medium">
                <span className="text-gray-500">{t('csv.summaryIgnored')}</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {importSummary.ignored}
                </span>
              </p>
            )}
            {importSummary.reconciliationAdded && (
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700/80 space-y-1">
                <p className="flex justify-between font-bold text-indigo-600 dark:text-indigo-400">
                  <span>{t('csv.summaryReconcil')}</span>
                  <span>
                    {importSummary.reconciliationAmount > 0 ? '+' : ''}
                    {formatCurrency(importSummary.reconciliationAmount)}
                  </span>
                </p>
                {importSummary.finalTargetBalance !== null && (
                  <p className="flex justify-between text-gray-600 dark:text-gray-300 text-[11px]">
                    <span>{t('csv.summaryTargetBalance')}</span>
                    <span className="font-semibold">
                      {formatCurrency(importSummary.finalTargetBalance)}
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => {
              setStep('upload')
              setFilename('')
              setRawRows([])
              setParsedTx([])
              setConflicts([])
              setNonConflictingTx([])
              setBankBalanceInput('')
            }}
            className="btn-primary text-xs w-full justify-center"
          >
            {t('csv.importAnother')}
          </button>
        </div>
      )}
    </div>
  )
}
