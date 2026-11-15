import { useState, useMemo, useEffect, KeyboardEvent } from 'react'
import { Transaction } from '@/lib/types'
import { formatDate, formatCurrency, getCurrencySymbol, cn, dateToMois, parseDateToTimestamp, resolveTypeForCategory } from '@/lib/utils'
import {
  Pencil,
  Trash2,
  Search,
  Filter,
  X,
  Check,
  Plus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FolderPlus,
  EyeOff,
  Eye,
} from 'lucide-react'
import CategoryBadge from './CategoryBadge'
import Badge from '@/components/ui/Badge'
import { useCategories, useBudgetTypes, QUERY_KEYS } from '@/lib/queries'
import { RECONCILIATION_TYPE, RECONCILIATION_CATEGORY } from '@/lib/constants'
import { addCategoryPB } from '@/lib/sync'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation, translateType } from '@/i18n'

interface TransactionTableProps {
  transactions: Transaction[]
  onUpdate: (id: string, updates: Partial<Transaction>) => void
  onDelete: (id: string) => void
  onAdd: (tx: Omit<Transaction, 'id' | 'created' | 'updated'>) => void
  onToggleIgnoreDashboard?: (id: string) => void
  showAddRow?: boolean
  onToggleAddRow?: (show: boolean) => void
}

type SortKey = 'date' | 'libelle_simplifie' | 'type' | 'categorie' | 'debit' | 'credit' | null

const getTodayString = () => {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export default function TransactionTable({
  transactions,
  onUpdate,
  onDelete,
  onAdd,
  onToggleIgnoreDashboard,
  showAddRow = false,
  onToggleAddRow,
}: TransactionTableProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [catFilter, setCatFilter] = useState('')

  // Sorting state
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Inline row editing state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Transaction>>({})

  const queryClient = useQueryClient()
  // Categories & Types lists (already sorted alphabetically by queries.ts)
  const { data: categoriesList = [] } = useCategories()
  const { data: types = [] } = useBudgetTypes()

  // Inline new transaction row state
  const [isAdding, setIsAdding] = useState(showAddRow)
  const [newTx, setNewTx] = useState({
    date: getTodayString(),
    libelle_simplifie: '',
    libelle_operation: '',
    type: types[0]?.nom || 'Essentielle',
    categorie: '',
    debit: '',
    credit: '',
  })

  // Quick creation of new category dialog/input
  const [isCreatingCategory, setIsCreatingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')

  useEffect(() => {
    if (showAddRow !== undefined) {
      setIsAdding(showAddRow)
    }
  }, [showAddRow])

  // Initialise la catégorie par défaut de la ligne d'ajout si vide
  useEffect(() => {
    if (!newTx.categorie && categoriesList.length > 0) {
      const allowed = categoriesList.filter(c => c.types.includes(newTx.type))
      setNewTx(prev => ({
        ...prev,
        categorie: allowed[0]?.nom || categoriesList[0].nom,
      }))
    }
  }, [categoriesList, newTx.type])

  // Handle quick on-the-fly category creation (with multi-types)
  const handleCreateCategoryOnTheFly = async (target: 'edit' | 'new') => {
    if (!newCategoryName.trim()) {
      setIsCreatingCategory(false)
      return
    }
    const currentType = target === 'edit' ? (editForm.type as string) : newTx.type
    const created = await addCategoryPB(newCategoryName.trim(), [currentType || 'Essentielle'])
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.categories })
    if (target === 'edit') {
      setEditForm(p => ({
        ...p,
        categorie: created.nom,
      }))
    } else {
      setNewTx(p => ({
        ...p,
        categorie: created.nom,
      }))
    }
    setNewCategoryName('')
    setIsCreatingCategory(false)
  }

  // Sorting handler
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortOrder(key === 'date' || key === 'debit' || key === 'credit' ? 'desc' : 'asc')
    }
  }

  // Filtered & Sorted transactions
  const processedTransactions = useMemo(() => {
    let result = transactions.filter(tx => {
      const matchSearch =
        !search ||
        tx.libelle_simplifie.toLowerCase().includes(search.toLowerCase()) ||
        tx.libelle_operation.toLowerCase().includes(search.toLowerCase()) ||
        tx.categorie.toLowerCase().includes(search.toLowerCase()) ||
        tx.type.toLowerCase().includes(search.toLowerCase())
      const matchType = !typeFilter || tx.type === typeFilter
      const matchCat = !catFilter || tx.categorie === catFilter
      return matchSearch && matchType && matchCat
    })

    if (sortKey) {
      result = [...result].sort((a, b) => {
        let valA: any = a[sortKey as keyof Transaction]
        let valB: any = b[sortKey as keyof Transaction]

        if (sortKey === 'date') {
          valA = parseDateToTimestamp(a.date)
          valB = parseDateToTimestamp(b.date)
        } else if (sortKey === 'debit' || sortKey === 'credit') {
          valA = Number(valA || 0)
          valB = Number(valB || 0)
        } else {
          valA = String(valA || '').toLowerCase()
          valB = String(valB || '').toLowerCase()
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1
        return 0
      })
    }

    return result
  }, [transactions, search, typeFilter, catFilter, sortKey, sortOrder])

  const totals = useMemo(
    () => ({
      debit: processedTransactions.reduce((s, t) => s + t.debit, 0),
      credit: processedTransactions.reduce((s, t) => s + t.credit, 0),
    }),
    [processedTransactions]
  )

  const startEdit = (tx: Transaction) => {
    setEditingId(tx.id)
    setEditForm({
      date: tx.date,
      libelle_simplifie: tx.libelle_simplifie,
      libelle_operation: tx.libelle_operation,
      type: tx.type,
      categorie: tx.categorie,
      debit: tx.debit,
      credit: tx.credit,
      ignore_dashboard: tx.ignore_dashboard,
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({})
    setIsCreatingCategory(false)
  }

  // RÈGLE MÉTIER: Lorsque le type change en édition, filtrer les catégories liées et ajuster la sélection
  const handleEditTypeChange = (newType: string) => {
    const allowed = categoriesList.filter(c => c.types.includes(newType))
    const currentCatStillValid = allowed.some(c => c.nom === editForm.categorie)

    setEditForm(prev => ({
      ...prev,
      type: newType,
      categorie: currentCatStillValid ? prev.categorie : allowed[0]?.nom || '',
    }))
  }

  const handleEditCategorySelect = (value: string) => {
    if (value === '__NEW__') {
      setIsCreatingCategory(true)
      return
    }
    setEditForm(prev => {
      const linkedType = resolveTypeForCategory(categoriesList, value, prev.type as string)
      return {
        ...prev,
        categorie: value,
        type: prev.credit && prev.credit > 0 ? 'Revenu' : (linkedType || prev.type),
      }
    })
  }

  const handleEditDebitChange = (val: string) => {
    const debitNum = parseFloat(val) || 0
    setEditForm(prev => {
      if (prev.type === RECONCILIATION_TYPE) {
        return {
          ...prev,
          debit: debitNum,
          credit: debitNum > 0 ? 0 : prev.credit,
        }
      }
      const currentCat = prev.categorie || 'Divers'
      const linkedType = resolveTypeForCategory(categoriesList, currentCat, prev.type as string)
      return {
        ...prev,
        debit: debitNum,
        credit: debitNum > 0 ? 0 : prev.credit,
        type: debitNum > 0 ? (linkedType || 'Essentielle') : prev.type,
      }
    })
  }

  const handleEditCreditChange = (val: string) => {
    const creditNum = parseFloat(val) || 0
    setEditForm(prev => {
      if (prev.type === RECONCILIATION_TYPE) {
        return {
          ...prev,
          credit: creditNum,
          debit: creditNum > 0 ? 0 : prev.debit,
        }
      }
      return {
        ...prev,
        credit: creditNum,
        debit: creditNum > 0 ? 0 : prev.debit,
        type: creditNum > 0 ? 'Revenu' : (prev.type === 'Revenu' ? resolveTypeForCategory(categoriesList, prev.categorie || '') : prev.type),
      }
    })
  }

  const saveEdit = (id: string) => {
    if (!editForm.libelle_simplifie?.trim()) return
    const date = editForm.date || getTodayString()
    onUpdate(id, {
      ...editForm,
      mois: dateToMois(date),
    })
    setEditingId(null)
    setEditForm({})
    setIsCreatingCategory(false)
  }

  const handleEditKeyDown = (e: KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveEdit(id)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEdit()
    }
  }

  // RÈGLE MÉTIER: Lorsque le type change en ajout, filtrer les catégories liées et ajuster la sélection
  const handleNewTypeChange = (newType: string) => {
    const allowed = categoriesList.filter(c => c.types.includes(newType))
    const currentCatStillValid = allowed.some(c => c.nom === newTx.categorie)

    setNewTx(prev => ({
      ...prev,
      type: newType,
      categorie: currentCatStillValid ? prev.categorie : allowed[0]?.nom || '',
    }))
  }

  const handleNewCategorySelect = (value: string) => {
    if (value === '__NEW__') {
      setIsCreatingCategory(true)
      return
    }
    setNewTx(prev => {
      const linkedType = resolveTypeForCategory(categoriesList, value, prev.type)
      return {
        ...prev,
        categorie: value,
        type: prev.credit && parseFloat(prev.credit) > 0 ? 'Revenu' : (linkedType || prev.type),
      }
    })
  }

  const handleNewDebitChange = (val: string) => {
    const debitNum = parseFloat(val) || 0
    setNewTx(prev => {
      const linkedType = resolveTypeForCategory(categoriesList, prev.categorie, prev.type)
      return {
        ...prev,
        debit: val,
        credit: debitNum > 0 ? '' : prev.credit,
        type: debitNum > 0 ? (linkedType || 'Essentielle') : prev.type,
      }
    })
  }

  const handleNewCreditChange = (val: string) => {
    const creditNum = parseFloat(val) || 0
    setNewTx(prev => ({
      ...prev,
      credit: val,
      debit: creditNum > 0 ? '' : prev.debit,
      type: creditNum > 0 ? 'Revenu' : resolveTypeForCategory(categoriesList, prev.categorie, prev.type),
    }))
  }

  const submitNewTx = () => {
    if (!newTx.libelle_simplifie.trim()) return
    const debitVal = parseFloat(newTx.debit) || 0
    const creditVal = parseFloat(newTx.credit) || 0
    if (debitVal === 0 && creditVal === 0) return

    onAdd({
      date: newTx.date || getTodayString(),
      mois: dateToMois(newTx.date || getTodayString()),
      libelle_simplifie: newTx.libelle_simplifie.trim(),
      libelle_operation: newTx.libelle_operation.trim() || newTx.libelle_simplifie.trim(),
      type: creditVal > 0 ? 'Revenu' : newTx.type,
      categorie: newTx.categorie,
      debit: creditVal > 0 ? 0 : debitVal,
      credit: creditVal > 0 ? creditVal : 0,
      ignore_dashboard: false,
    })

    setNewTx({
      date: getTodayString(),
      libelle_simplifie: '',
      libelle_operation: '',
      type: types[0]?.nom || 'Essentielle',
      categorie: categoriesList.filter(c => c.types.includes(types[0]?.nom || 'Essentielle'))[0]?.nom || '',
      debit: '',
      credit: '',
    })

    if (onToggleAddRow) {
      onToggleAddRow(false)
    } else {
      setIsAdding(false)
    }
  }

  const handleNewKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      submitNewTx()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsAdding(false)
      if (onToggleAddRow) onToggleAddRow(false)
    }
  }

  // Catégories filtrées selon le type sélectionné en mode édition ou ajout
  const allowedEditCategories = useMemo(() => {
    const currentType = editForm.type || 'Essentielle'
    return categoriesList.filter(c => c.types.includes(currentType))
  }, [categoriesList, editForm.type])

  const allowedNewCategories = useMemo(() => {
    const currentType = newTx.type || 'Essentielle'
    return categoriesList.filter(c => c.types.includes(currentType))
  }, [categoriesList, newTx.type])

  const renderSortHeader = (label: string, key: SortKey, align: 'left' | 'right' = 'left') => {
    const isActive = sortKey === key
    return (
      <button
        type="button"
        onClick={() => handleSort(key)}
        className={cn(
          'inline-flex items-center gap-1.5 font-semibold text-xs uppercase tracking-wider transition-colors hover:text-gray-900 dark:hover:text-white',
          isActive ? 'text-primary-600 dark:text-primary-400 font-bold' : 'text-gray-500',
          align === 'right' ? 'ml-auto' : ''
        )}
      >
        <span>{label}</span>
        {isActive ? (
          sortOrder === 'asc' ? (
            <ArrowUp className="w-3.5 h-3.5 text-primary-600" />
          ) : (
            <ArrowDown className="w-3.5 h-3.5 text-primary-600" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40 hover:opacity-100" />
        )}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filters & Actions (Type est placé avant Catégorie) */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9"
            placeholder={t('tx.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-3 h-3 text-gray-400" />
            </button>
          )}
        </div>

        {/* 1. FILTRE TYPE PLACÉ AVANT CATÉGORIE (Trié Alphabétiquement) */}
        <select
          className="input w-auto min-w-[130px]"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
        >
          <option value="">{t('tx.allTypes')}</option>
          {types.map(tp => (
            <option key={tp.id} value={tp.nom}>
              {translateType(tp.nom)}
            </option>
          ))}
        </select>

        {/* 2. FILTRE CATÉGORIE (Lié au type filtré et trié alphabétiquement) */}
        <select
          className="input w-auto min-w-[160px]"
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
        >
          <option value="">{t('tx.allCategories')}</option>
          {categoriesList
            .filter(c => !typeFilter || c.types.includes(typeFilter))
            .map(c => (
              <option key={c.id} value={c.nom}>
                {c.nom}
              </option>
            ))}
        </select>

        {(typeFilter || catFilter || search) && (
          <button
            onClick={() => {
              setSearch('')
              setTypeFilter('')
              setCatFilter('')
            }}
            className="btn-secondary text-xs"
          >
            <Filter className="w-3 h-3" /> {t('tx.clearFilters')}
          </button>
        )}

        <button
          onClick={() => {
            const next = !isAdding
            setIsAdding(next)
            if (onToggleAddRow) onToggleAddRow(next)
          }}
          className={cn(isAdding ? 'btn-secondary' : 'btn-primary', 'text-xs')}
        >
          {isAdding ? (
            <>
              <X className="w-3.5 h-3.5" /> {t('tx.closeQuickAdd')}
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" /> {t('tx.quickAdd')}
            </>
          )}
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {/* EN-TÊTE : TYPE EST PLACÉ AVANT CATÉGORIE */}
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/30">
                <th className="text-left px-3 py-3 w-32">
                  {renderSortHeader(t('tx.colDate'), 'date')}
                </th>
                <th className="text-left px-3 py-3">
                  {renderSortHeader(t('tx.colLabel'), 'libelle_simplifie')}
                </th>
                <th className="text-left px-3 py-3 w-36">
                  {renderSortHeader(t('tx.colType'), 'type')}
                </th>
                <th className="text-left px-3 py-3 w-48">
                  {renderSortHeader(t('tx.colCategory'), 'categorie')}
                </th>
                <th className="text-right px-3 py-3 w-32">
                  {renderSortHeader(`${t('tx.colDebit')} (${getCurrencySymbol()})`, 'debit', 'right')}
                </th>
                <th className="text-right px-3 py-3 w-32">
                  {renderSortHeader(`${t('tx.colCredit')} (${getCurrencySymbol()})`, 'credit', 'right')}
                </th>
                <th className="text-right px-3 py-3 w-32 text-xs font-semibold text-gray-500 uppercase">
                  {t('tx.colActions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
              {/* LIGNE D'AJOUT RAPIDE DIRECTEMENT DANS LE TABLEAU (TYPE AVANT CATÉGORIE) */}
              {isAdding && (
                <tr className="bg-primary-50/40 dark:bg-primary-950/20 border-b-2 border-primary-400">
                  <td className="px-2 py-2">
                    <input
                      className="input text-xs py-1 px-2"
                      value={newTx.date}
                      onChange={e => setNewTx(p => ({ ...p, date: e.target.value }))}
                      onKeyDown={handleNewKeyDown}
                      placeholder={t('tx.formDatePlaceholder')}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      autoFocus
                      className="input text-xs py-1 px-2 font-medium"
                      value={newTx.libelle_simplifie}
                      onChange={e => setNewTx(p => ({ ...p, libelle_simplifie: e.target.value }))}
                      onKeyDown={handleNewKeyDown}
                      placeholder={t('tx.merchantPlaceholder')}
                    />
                  </td>
                  {/* 1. TYPE SELECT (Trié alphabétiquement) */}
                  <td className="px-2 py-2">
                    <select
                      className="input text-xs py-1 px-2 cursor-pointer font-medium"
                      value={newTx.type}
                      onChange={e => handleNewTypeChange(e.target.value)}
                      onKeyDown={handleNewKeyDown}
                      disabled={parseFloat(newTx.credit || '0') > 0}
                    >
                      {types.map(tp => (
                        <option key={tp.id} value={tp.nom}>
                          {translateType(tp.nom)}
                        </option>
                      ))}
                    </select>
                  </td>
                  {/* 2. CATÉGORIE SELECT (UNIQUEMENT CELLES LIÉES AU TYPE CHOISI) */}
                  <td className="px-2 py-2">
                    {isCreatingCategory ? (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          className="input text-xs py-1 px-2 flex-1 font-medium"
                          placeholder={t('tx.newCategoryPlaceholder')}
                          value={newCategoryName}
                          onChange={e => setNewCategoryName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleCreateCategoryOnTheFly('new')
                            } else if (e.key === 'Escape') {
                              setIsCreatingCategory(false)
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleCreateCategoryOnTheFly('new')}
                          className="p-1 rounded bg-primary-600 text-white"
                          title={t('tx.createAndSelectTitle')}
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsCreatingCategory(false)}
                          className="p-1 rounded hover:bg-gray-200 text-gray-400"
                          title={t('common.cancel')}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <select
                          className="input text-xs py-1 px-2 cursor-pointer flex-1"
                          value={newTx.categorie}
                          onChange={e => handleNewCategorySelect(e.target.value)}
                          onKeyDown={handleNewKeyDown}
                        >
                          {allowedNewCategories.map(c => (
                            <option key={c.id} value={c.nom}>
                              {c.nom}
                            </option>
                          ))}
                          <option value="__NEW__" className="font-semibold text-primary-600">
                            {t('tx.createCategoryForType', { type: translateType(newTx.type) })}
                          </option>
                        </select>
                        <button
                          type="button"
                          onClick={() => setIsCreatingCategory(true)}
                          className="p-1.5 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-950 text-primary-600"
                          title={t('tx.newCategoryTitle')}
                        >
                          <FolderPlus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input text-xs py-1 px-2 text-right font-semibold"
                      value={newTx.debit}
                      onChange={e => handleNewDebitChange(e.target.value)}
                      onKeyDown={handleNewKeyDown}
                      placeholder="0.00"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input text-xs py-1 px-2 text-right text-emerald-600 font-semibold"
                      value={newTx.credit}
                      onChange={e => handleNewCreditChange(e.target.value)}
                      onKeyDown={handleNewKeyDown}
                      placeholder="0.00"
                    />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={submitNewTx}
                        className="p-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 shadow-sm"
                        title={t('tx.addEnterTitle')}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setIsAdding(false)
                          if (onToggleAddRow) onToggleAddRow(false)
                        }}
                        className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
                        title={t('tx.cancelEscTitle')}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {processedTransactions.length === 0 && !isAdding ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">
                    {t('tx.empty')}
                  </td>
                </tr>
              ) : (
                processedTransactions.map(tx => {
                  const isEditing = editingId === tx.id
                  const isIgnored = !!tx.ignore_dashboard

                  if (isEditing) {
                    // LIGNE ÉDITABLE DIRECTEMENT DANS LE TABLEAU
                    return (
                      <tr
                        key={tx.id}
                        className="bg-amber-50/60 dark:bg-amber-950/20"
                        onKeyDown={e => handleEditKeyDown(e, tx.id)}
                      >
                        <td className="px-2 py-2">
                          <input
                            className="input text-xs py-1 px-2"
                            value={editForm.date || ''}
                            onChange={e => setEditForm(p => ({ ...p, date: e.target.value }))}
                            placeholder="JJ/MM/AAAA"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            autoFocus
                            className="input text-xs py-1 px-2 font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                            value={editForm.libelle_simplifie || ''}
                            onChange={e =>
                              setEditForm(p => ({ ...p, libelle_simplifie: e.target.value }))
                            }
                            disabled={editForm.type === RECONCILIATION_TYPE}
                          />
                        </td>
                        {/* 1. TYPE SELECT */}
                        <td className="px-2 py-2">
                          {editForm.type === RECONCILIATION_TYPE ? (
                            <Badge type={RECONCILIATION_TYPE} />
                          ) : (
                            <select
                              className="input text-xs py-1 px-2 cursor-pointer font-medium"
                              value={editForm.type || 'Essentielle'}
                              onChange={e => handleEditTypeChange(e.target.value)}
                              disabled={Number(editForm.credit || 0) > 0}
                            >
                              {types.map(tp => (
                                <option key={tp.id} value={tp.nom}>
                                  {translateType(tp.nom)}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        {/* 2. CATÉGORIE SELECT (UNIQUEMENT CELLES LIÉES AU TYPE SÉLECTIONNÉ) */}
                        <td className="px-2 py-2">
                          {editForm.type === RECONCILIATION_TYPE ? (
                            <CategoryBadge categorie={editForm.categorie || RECONCILIATION_CATEGORY} />
                          ) : isCreatingCategory ? (
                            <div className="flex items-center gap-1">
                              <input
                                autoFocus
                                className="input text-xs py-1 px-2 flex-1 font-medium"
                                placeholder={t('tx.newCategoryPlaceholder')}
                                value={newCategoryName}
                                onChange={e => setNewCategoryName(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    handleCreateCategoryOnTheFly('edit')
                                  } else if (e.key === 'Escape') {
                                    setIsCreatingCategory(false)
                                  }
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => handleCreateCategoryOnTheFly('edit')}
                                className="p-1 rounded bg-primary-600 text-white"
                                title={t('tx.createAndSelectTitle')}
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setIsCreatingCategory(false)}
                                className="p-1 rounded hover:bg-gray-200 text-gray-400"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <select
                                className="input text-xs py-1 px-2 cursor-pointer flex-1"
                                value={editForm.categorie || ''}
                                onChange={e => handleEditCategorySelect(e.target.value)}
                              >
                                {allowedEditCategories.map(c => (
                                  <option key={c.id} value={c.nom}>
                                    {c.nom}
                                  </option>
                                ))}
                                <option value="__NEW__" className="font-semibold text-primary-600">
                                  {t('tx.createCategoryForType', { type: translateType(editForm.type || '') })}
                                </option>
                              </select>
                              <button
                                type="button"
                                onClick={() => setIsCreatingCategory(true)}
                                className="p-1.5 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-950 text-primary-600"
                                title={t('tx.newCategoryTitle')}
                              >
                                <FolderPlus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="input text-xs py-1 px-2 text-right text-red-600 font-semibold"
                            value={editForm.debit !== undefined ? String(editForm.debit) : ''}
                            onChange={e => handleEditDebitChange(e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="input text-xs py-1 px-2 text-right text-emerald-600 font-semibold"
                            value={editForm.credit !== undefined ? String(editForm.credit) : ''}
                            onChange={e => handleEditCreditChange(e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => saveEdit(tx.id)}
                              className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                              title={t('tx.saveEnterTitle')}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
                              title={t('tx.cancelEscTitle')}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  // LIGNE AFFICHAGE NORMAL (AVEC ACTION "IGNORER DU DASHBOARD")
                  return (
                    <tr
                      key={tx.id}
                      onDoubleClick={() => startEdit(tx)}
                      className={cn(
                        'hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors group cursor-pointer',
                        isIgnored ? 'opacity-50 bg-gray-50/50 dark:bg-gray-900/30' : ''
                      )}
                    >
                      <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {formatDate(tx.date)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 dark:text-white truncate max-w-[240px]">
                            {tx.libelle_simplifie}
                          </p>
                          {isIgnored && (
                            <span className="badge text-[9px] px-1.5 py-0.2 bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 font-semibold border border-amber-300 dark:border-amber-800 whitespace-nowrap">
                              {t('tx.ignoredFromDashboard')}
                            </span>
                          )}
                        </div>
                        {tx.libelle_operation && tx.libelle_operation !== tx.libelle_simplifie && (
                          <p className="text-[11px] text-gray-400 truncate max-w-[240px] hidden sm:block">
                            {tx.libelle_operation}
                          </p>
                        )}
                      </td>
                      {/* 1. TYPE BADGE AVANT CATÉGORIE */}
                      <td className="px-3 py-3">
                        <Badge type={tx.type} />
                      </td>
                      {/* 2. CATÉGORIE BADGE */}
                      <td className="px-3 py-3">
                        <CategoryBadge categorie={tx.categorie} />
                      </td>
                      <td className="px-3 py-3 text-right">
                        {tx.debit > 0 && (
                          <span className={cn('font-semibold text-red-600 dark:text-red-400', isIgnored ? 'line-through' : '')}>
                            -{formatCurrency(tx.debit)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {tx.credit > 0 && (
                          <span className={cn('font-semibold text-emerald-600 dark:text-emerald-400', isIgnored ? 'line-through' : '')}>
                            +{formatCurrency(tx.credit)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* ACTION : IGNORER DANS LE TABLEAU DE BORD */}
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              if (onToggleIgnoreDashboard) {
                                onToggleIgnoreDashboard(tx.id)
                              } else {
                                onUpdate(tx.id, { ignore_dashboard: !isIgnored })
                              }
                            }}
                            className={cn(
                              'p-1.5 rounded-lg transition-colors',
                              isIgnored
                                ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-700'
                            )}
                            title={
                              isIgnored
                                ? t('tx.unignoreTitle')
                                : t('tx.ignoreTitle')
                            }
                          >
                            {isIgnored ? (
                              <EyeOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* ACTION : ÉDITER */}
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              startEdit(tx)
                            }}
                            className="p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 text-gray-400 hover:text-primary-600 transition-colors"
                            title={t('tx.editDirectTitle')}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* ACTION : SUPPRIMER */}
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              onDelete(tx.id)
                            }}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
                            title={t('common.delete')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>

            {/* Totals footer */}
            {processedTransactions.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50/80 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800">
                  <td
                    colSpan={4}
                    className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                  >
                    {t('tx.totalOps', { count: processedTransactions.length })}
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-red-600 dark:text-red-400">
                    -{formatCurrency(totals.debit)}
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                    +{formatCurrency(totals.credit)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
