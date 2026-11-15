import { useState, useEffect } from 'react'
import { CategorizationRule, BudgetCategory, BudgetType } from '@/lib/types'
import {
  fetchCategorizationRules,
  saveCategorizationRulePB,
  deleteCategorizationRulePB,
  fetchCategories,
  fetchBudgetTypes,
  applyCategorizationRulesToAllTransactionsPB,
} from '@/lib/sync'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/queries'
import { Plus, Trash2, Zap, Check, X, Pencil, Sparkles, Columns3 } from 'lucide-react'
import { PocketBaseGuard } from '@/components/ui/PocketBaseRequiredState'
import { generateId, resolveTypeForCategory } from '@/lib/utils'
import { useTranslation, translateType } from '@/i18n'

export default function SwimlaneRulesManager() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [rules, setRules] = useState<CategorizationRule[]>([])
  const [categories, setCategories] = useState<BudgetCategory[]>([])
  const [types, setTypes] = useState<BudgetType[]>([])
  const [loading, setLoading] = useState(true)
  const [pbError, setPbError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setPbError(null)
      try {
        const [fetchedRules, fetchedCats, fetchedTypes] = await Promise.all([
          fetchCategorizationRules(),
          fetchCategories(),
          fetchBudgetTypes(),
        ])
        setRules(fetchedRules)
        setCategories(fetchedCats)
        setTypes(fetchedTypes)
        if (fetchedCats.length > 0) {
          setNewCategory(fetchedCats[0].nom)
        }
      } catch (err: any) {
        setPbError(err.message || 'PocketBase hors ligne')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Add rule state
  const [newPattern, setNewPattern] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [newType, setNewType] = useState('Essentielle')

  // Edit rule state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPattern, setEditPattern] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editType, setEditType] = useState('')

  // Retroactive application state
  const [applyFeedback, setApplyFeedback] = useState<string | null>(null)

  const handleCategorySelect = (catName: string, isEdit = false) => {
    const inferred = resolveTypeForCategory(categories, catName)
    if (isEdit) {
      setEditCategory(catName)
      setEditType(inferred)
    } else {
      setNewCategory(catName)
      setNewType(inferred)
    }
  }

  const handleAddRule = async () => {
    if (!newPattern.trim() || !newCategory) return
    const cleanPattern = newPattern.trim().toUpperCase()
    const draft: CategorizationRule = {
      id: generateId(),
      pattern: cleanPattern,
      categorie: newCategory,
      type: newType || resolveTypeForCategory(categories, newCategory),
    }
    try {
      const saved = await saveCategorizationRulePB(draft)
      setRules(prev => [saved, ...prev])
      setNewPattern('')
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.categorizationRules })
    } catch (err: any) {
      setPbError(err.message || 'Erreur PocketBase')
    }
  }

  const startEdit = (rule: CategorizationRule) => {
    setEditingId(rule.id)
    setEditPattern(rule.pattern)
    setEditCategory(rule.categorie)
    setEditType(rule.type || resolveTypeForCategory(categories, rule.categorie))
  }

  const saveEdit = async (id: string) => {
    if (!editPattern.trim()) return
    const rule = rules.find(r => r.id === id)
    if (!rule) return
    const updated: CategorizationRule = {
      ...rule,
      pattern: editPattern.trim().toUpperCase(),
      categorie: editCategory,
      type: editType,
    }
    try {
      const saved = await saveCategorizationRulePB(updated)
      setRules(prev => prev.map(r => (r.id === id ? saved : r)))
      setEditingId(null)
    } catch (err: any) {
      setPbError(err.message || 'Erreur PocketBase')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteCategorizationRulePB(id)
      setRules(prev => prev.filter(r => r.id !== id))
    } catch (err: any) {
      setPbError(err.message || 'Erreur PocketBase')
    }
  }

  const handleApplyToAll = async () => {
    try {
      const count = await applyCategorizationRulesToAllTransactionsPB()
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.transactions })
      setApplyFeedback(
        count > 0
          ? t('swimlanes.appliedCount', { count })
          : t('swimlanes.appliedNone')
      )
      setTimeout(() => setApplyFeedback(null), 4000)
    } catch (err: any) {
      setPbError(err.message || t('common.pbSaveError'))
    }
  }

  if (loading) {
    return (
      <div className="card p-5 flex items-center justify-center h-32 text-gray-400 text-sm">
        {t('swimlanes.loading')}
      </div>
    )
  }

  return (
    <PocketBaseGuard error={pbError}>
    <div className="space-y-6 animate-fade-in">
      <div className="card p-5 space-y-4">
        {/* Header & Retroactive action */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Columns3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {t('swimlanes.title')}
              </h3>
              <p className="text-xs text-gray-400">
                {t('swimlanes.desc')}
              </p>
            </div>
          </div>

          <button
            onClick={handleApplyToAll}
            className="btn-secondary text-xs flex items-center gap-1.5 shadow-sm"
            title={t('swimlanes.applyAllTitle')}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            {t('swimlanes.applyAllBtn')}
          </button>
        </div>

        {applyFeedback && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-300 animate-fade-in flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            {applyFeedback}
          </div>
        )}

        {/* Formulaire d'ajout d'une règle */}
        <div className="p-3.5 bg-gray-50 dark:bg-gray-800/40 rounded-xl space-y-2.5">
          <p className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-primary-500" /> {t('swimlanes.addRuleTitle')}
          </p>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
              <span className="text-xs text-gray-500 font-medium whitespace-nowrap">
                {t('swimlanes.ifContains')}
              </span>
              <input
                className="input text-xs py-1.5 px-3 flex-1 bg-white dark:bg-gray-900 font-medium"
                placeholder={t('swimlanes.patternPlaceholder')}
                value={newPattern}
                onChange={e => setNewPattern(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddRule()}
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 font-medium whitespace-nowrap">{t('swimlanes.arrowCat')}</span>
              <select
                className="input text-xs py-1.5 px-2.5 w-auto cursor-pointer bg-white dark:bg-gray-900 font-medium"
                value={newCategory}
                onChange={e => handleCategorySelect(e.target.value, false)}
              >
                {categories.map(c => (
                  <option key={c.id} value={c.nom}>
                    {c.nom}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 font-medium whitespace-nowrap">{t('swimlanes.arrowType')}</span>
              <select
                className="input text-xs py-1.5 px-2.5 w-auto cursor-pointer bg-white dark:bg-gray-900 font-medium"
                value={newType}
                onChange={e => setNewType(e.target.value)}
              >
                {types.map(tp => (
                  <option key={tp.id} value={tp.nom}>
                    {translateType(tp.nom)}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleAddRule}
              disabled={!newPattern.trim()}
              className="btn-primary text-xs py-1.5 px-3.5 disabled:opacity-40 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> {t('swimlanes.saveRuleBtn')}
            </button>
          </div>
        </div>

        {/* Liste des règles */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-400 font-semibold uppercase px-2 pt-1">
            <span>{t('swimlanes.colKeyword')}</span>
            <span>{t('swimlanes.colAutoAssign')}</span>
          </div>

          <div className="space-y-1.5 max-h-[460px] overflow-y-auto pr-1">
            {rules.map(rule => {
              const isEditing = editingId === rule.id

              if (isEditing) {
                return (
                  <div
                    key={rule.id}
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900"
                  >
                    <input
                      autoFocus
                      className="input text-xs py-1 px-2 flex-1 font-semibold"
                      value={editPattern}
                      onChange={e => setEditPattern(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveEdit(rule.id)}
                    />
                    <select
                      className="input text-xs py-1 px-2 cursor-pointer w-auto"
                      value={editCategory}
                      onChange={e => handleCategorySelect(e.target.value, true)}
                    >
                      {categories.map(c => (
                        <option key={c.id} value={c.nom}>
                          {c.nom}
                        </option>
                      ))}
                    </select>
                    <select
                      className="input text-xs py-1 px-2 cursor-pointer w-auto"
                      value={editType}
                      onChange={e => setEditType(e.target.value)}
                    >
                      {types.map(tp => (
                        <option key={tp.id} value={tp.nom}>
                          {translateType(tp.nom)}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => saveEdit(rule.id)}
                      className="p-1.5 rounded-lg bg-emerald-600 text-white shadow-sm"
                      title={t('common.confirm')}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500"
                      title={t('common.cancel')}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              }

              return (
                <div
                  key={rule.id}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-200 dark:hover:border-gray-700 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md">
                      {rule.pattern}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="badge text-[11px] bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300 font-semibold">
                        {rule.categorie}
                      </span>
                      {rule.type && (
                        <span className="badge text-[10px] bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                          {translateType(rule.type)}
                        </span>
                      )}
                    </div>

                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <button
                        onClick={() => startEdit(rule)}
                        className="p-1 text-gray-400 hover:text-primary-600 rounded"
                        title={t('common.edit')}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="p-1 text-gray-400 hover:text-red-500 rounded"
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
    </PocketBaseGuard>
  )
}
