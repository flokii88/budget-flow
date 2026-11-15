import { useState, useEffect } from 'react'
import { FixedExpense, BudgetCategory, CategorizationRule } from '@/lib/types'
import {
  fetchFixedExpenses,
  saveFixedExpensePB,
  deleteFixedExpensePB,
  fetchCategories,
  fetchCategorizationRules,
  saveBudgetRulesPB,
} from '@/lib/sync'
import { QUERY_KEYS, useBudgetRules } from '@/lib/queries'
import { DEFAULT_BUDGET_RULES } from '@/lib/constants'
import { useQueryClient } from '@tanstack/react-query'
import { formatCurrency, generateId, getCurrencySymbol, resolveTypeForCategory } from '@/lib/utils'
import { Plus, Pencil, Trash2, Check, X, Receipt, Search, SlidersHorizontal } from 'lucide-react'
import { PocketBaseGuard } from '@/components/ui/PocketBaseRequiredState'
import { useTranslation } from '@/i18n'

export default function FixedExpensesManager() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: budgetRules = DEFAULT_BUDGET_RULES } = useBudgetRules()
  const [expenses, setExpenses] = useState<FixedExpense[]>([])
  const [categories, setCategories] = useState<BudgetCategory[]>([])
  const [rules, setRules] = useState<CategorizationRule[]>([])
  const [loading, setLoading] = useState(true)
  const [pbError, setPbError] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<FixedExpense>>({})
  const [toleranceInput, setToleranceInput] = useState<string>('0')
  const [savingTolerance, setSavingTolerance] = useState(false)

  useEffect(() => {
    setToleranceInput(String(budgetRules.fixed_match_tolerance ?? 0))
  }, [budgetRules.fixed_match_tolerance])

  const saveToleranceToPB = async (rawVal: string) => {
    const num = parseFloat(rawVal)
    const clean = Number.isFinite(num) && num >= 0 ? num : 0
    setToleranceInput(String(clean))
    if (clean === (budgetRules.fixed_match_tolerance ?? 0)) return
    setSavingTolerance(true)
    try {
      await saveBudgetRulesPB({
        ...budgetRules,
        fixed_match_tolerance: clean,
      })
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.budgetRules })
    } catch (err: any) {
      setPbError(err.message || 'Erreur PocketBase')
    } finally {
      setSavingTolerance(false)
    }
  }

  // Inline add row state
  const [isAdding, setIsAdding] = useState(false)
  const [newExp, setNewExp] = useState({
    libelle: '',
    pattern: '',
    categorie: '',
    type: 'Essentielle',
    montant: '',
    actif: true,
  })

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setPbError(null)
      try {
        const [fetchedExpenses, fetchedCats, fetchedRules] = await Promise.all([
          fetchFixedExpenses(),
          fetchCategories(),
          fetchCategorizationRules().catch(() => [] as CategorizationRule[]),
        ])
        setExpenses(fetchedExpenses)
        setCategories(fetchedCats)
        setRules(fetchedRules)
        if (fetchedCats.length > 0) {
          setNewExp(prev => ({ ...prev, categorie: fetchedCats[0].nom }))
        }
      } catch (err: any) {
        setPbError(err.message || 'PocketBase hors ligne')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ─── Direct Inline Edit Handlers ──────────────────────────────────────────

  const startEdit = (exp: FixedExpense) => {
    setEditingId(exp.id)
    setEditForm({
      libelle: exp.libelle,
      pattern: exp.pattern || '',
      categorie: exp.categorie,
      type: exp.type,
      montant: exp.montant,
      actif: exp.actif,
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({})
  }

  const handleEditPatternChange = (patternValue: string) => {
    const matchedRule = rules.find(
      r => r.pattern.toLowerCase() === patternValue.trim().toLowerCase()
    )
    if (matchedRule) {
      const linkedType = matchedRule.type || resolveTypeForCategory(categories, matchedRule.categorie)
      setEditForm(prev => ({
        ...prev,
        pattern: patternValue,
        categorie: matchedRule.categorie,
        type: linkedType || prev.type || 'Essentielle',
      }))
    } else {
      setEditForm(prev => ({ ...prev, pattern: patternValue }))
    }
  }

  const handleEditCategoryChange = (catName: string) => {
    const linkedType = resolveTypeForCategory(categories, catName)
    setEditForm(prev => ({
      ...prev,
      categorie: catName,
      type: linkedType || prev.type || 'Essentielle',
    }))
  }

  const saveEdit = async (id: string) => {
    if (!editForm.libelle?.trim()) return
    const exp = expenses.find(e => e.id === id)
    if (!exp) return
    const updated: FixedExpense = {
      ...exp,
      ...editForm,
      pattern: (editForm.pattern || '').trim(),
      montant: parseFloat(String(editForm.montant || 0)) || 0,
    }
    try {
      const saved = await saveFixedExpensePB(updated)
      setExpenses(prev => prev.map(e => (e.id === id ? saved : e)))
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.fixedExpenses })
      setEditingId(null)
      setEditForm({})
    } catch (err: any) {
      setPbError(err.message || 'Erreur PocketBase')
    }
  }

  // ─── Inline Add Handlers ──────────────────────────────────────────────────

  const handleNewPatternChange = (patternValue: string) => {
    const matchedRule = rules.find(
      r => r.pattern.toLowerCase() === patternValue.trim().toLowerCase()
    )
    if (matchedRule) {
      const linkedType = matchedRule.type || resolveTypeForCategory(categories, matchedRule.categorie)
      setNewExp(prev => ({
        ...prev,
        pattern: patternValue,
        categorie: matchedRule.categorie,
        type: linkedType || 'Essentielle',
      }))
    } else {
      setNewExp(prev => ({ ...prev, pattern: patternValue }))
    }
  }

  const handleNewCategoryChange = (catName: string) => {
    const linkedType = resolveTypeForCategory(categories, catName)
    setNewExp(prev => ({
      ...prev,
      categorie: catName,
      type: linkedType || 'Essentielle',
    }))
  }

  const handleAddSubmit = async () => {
    if (!newExp.libelle.trim() || !newExp.montant) return
    const created: FixedExpense = {
      id: generateId(),
      libelle: newExp.libelle.trim(),
      pattern: newExp.pattern.trim(),
      categorie: newExp.categorie,
      type: newExp.type,
      montant: parseFloat(newExp.montant) || 0,
      actif: true,
      ordre: expenses.length + 1,
    }
    try {
      const saved = await saveFixedExpensePB(created)
      setExpenses(prev => [...prev, saved])
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.fixedExpenses })
      setNewExp({
        libelle: '',
        pattern: '',
        categorie: categories[0]?.nom || 'Abonnement',
        type: 'Essentielle',
        montant: '',
        actif: true,
      })
      setIsAdding(false)
    } catch (err: any) {
      setPbError(err.message || 'Erreur PocketBase')
    }
  }

  const toggleActif = async (id: string) => {
    const exp = expenses.find(e => e.id === id)
    if (!exp) return
    const updated: FixedExpense = { ...exp, actif: !exp.actif }
    try {
      const saved = await saveFixedExpensePB(updated)
      setExpenses(prev => prev.map(e => (e.id === id ? saved : e)))
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.fixedExpenses })
    } catch (err: any) {
      setPbError(err.message || 'Erreur PocketBase')
    }
  }

  const remove = async (id: string) => {
    try {
      await deleteFixedExpensePB(id)
      setExpenses(prev => prev.filter(e => e.id !== id))
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.fixedExpenses })
    } catch (err: any) {
      setPbError(err.message || 'Erreur PocketBase')
    }
  }

  const totalActif = expenses.filter(e => e.actif).reduce((s, e) => s + e.montant, 0)

  if (loading) {
    return (
      <div className="card p-5 flex items-center justify-center h-32 text-gray-400 text-sm">
        Chargement des dépenses fixes depuis PocketBase…
      </div>
    )
  }

  return (
    <PocketBaseGuard error={pbError}>
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl text-indigo-600 dark:text-indigo-400">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">
              Dépenses Récurrentes Fixes
            </h3>
            <p className="text-xs text-gray-400">
              Total mensuel actif :{' '}
              <span className="font-bold text-gray-800 dark:text-gray-200">
                {formatCurrency(totalActif)}
              </span>
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsAdding(p => !p)}
          className={isAdding ? 'btn-secondary text-xs' : 'btn-primary text-xs'}
        >
          {isAdding ? (
            <>
              <X className="w-3.5 h-3.5" /> Fermer
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" /> Ajouter directement
            </>
          )}
        </button>
      </div>

      {/* Datalist des règles swimlanes existantes */}
      <datalist id="swimlane-patterns-datalist">
        {rules.map(r => (
          <option key={r.id} value={r.pattern}>
            {r.pattern} → {r.categorie}
          </option>
        ))}
      </datalist>

      {/* Info rapprochement */}
      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-xs text-indigo-800 dark:text-indigo-200">
        <Search className="w-4 h-4 shrink-0 mt-0.5 text-indigo-500" />
        <p>
          <strong>Rapprochement automatique :</strong> associez un mot-clé (ou choisissez une règle swimlane existante). Sur le Tableau de bord, une dépense fixe est marquée <em>passée</em> dès qu’une transaction du mois a le <strong>montant attendu</strong> (ou dans la marge de tolérance ci-dessous) et contient ce <strong>mot-clé dans son libellé</strong>.
        </p>
      </div>

      {/* Réglage global : Marge de tolérance au-dessus du tableau */}
      <div className="card px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
              Marge de tolérance pour le rapprochement automatique
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              0 {getCurrencySymbol()} = montant exact au centime près (par défaut). Utile si vos factures varient légèrement (ex. ± 5 {getCurrencySymbol()}).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">±</span>
          <input
            type="number"
            min="0"
            step="0.5"
            disabled={savingTolerance}
            value={toleranceInput}
            onChange={e => setToleranceInput(e.target.value)}
            onBlur={() => saveToleranceToPB(toleranceInput)}
            onKeyDown={e => e.key === 'Enter' && saveToleranceToPB(toleranceInput)}
            className="input text-xs py-1.5 px-2.5 w-24 text-right font-semibold"
            aria-label="Marge de tolérance"
          />
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{getCurrencySymbol()}</span>
          <button
            type="button"
            disabled={savingTolerance}
            onClick={() => saveToleranceToPB(toleranceInput)}
            className="btn-secondary text-xs py-1.5 px-2.5"
            title="Enregistrer la marge dans PocketBase"
          >
            {savingTolerance ? '...' : 'Appliquer'}
          </button>
          {parseFloat(toleranceInput) > 0 && (
            <button
              type="button"
              disabled={savingTolerance}
              onClick={() => saveToleranceToPB('0')}
              className="text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 underline ml-1"
            >
              Réinitialiser (0 {getCurrencySymbol()})
            </button>
          )}
        </div>
      </div>

      {/* Table avec édition directement en ligne */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Libellé
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-44">
                  Mot-clé (Swimlane)
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-44">
                  Catégorie
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-36">
                  Type
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">
                  Montant ({getCurrencySymbol()})
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">
                  Actif
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
              {/* LIGNE D'AJOUT DIRECT DANS LE TABLEAU */}
              {isAdding && (
                <tr className="bg-primary-50/40 dark:bg-primary-950/20 border-b-2 border-primary-400">
                  <td className="px-3 py-2">
                    <input
                      autoFocus
                      className="input text-xs py-1 px-2"
                      placeholder={t('fixedMgr.labelPlaceholder')}
                      value={newExp.libelle}
                      onChange={e => setNewExp(p => ({ ...p, libelle: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && handleAddSubmit()}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      list="swimlane-patterns-datalist"
                      className="input text-xs py-1 px-2 font-mono"
                      placeholder={t('fixedMgr.patternPlaceholder')}
                      value={newExp.pattern}
                      onChange={e => handleNewPatternChange(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddSubmit()}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="input text-xs py-1 px-2 cursor-pointer"
                      value={newExp.categorie}
                      onChange={e => handleNewCategoryChange(e.target.value)}
                    >
                      {categories.map(c => (
                        <option key={c.id} value={c.nom}>
                          {c.nom}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <span className="badge text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                      {newExp.type}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input text-xs py-1 px-2 text-right font-semibold"
                      placeholder="0.00"
                      value={newExp.montant}
                      onChange={e => setNewExp(p => ({ ...p, montant: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && handleAddSubmit()}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="text-xs text-emerald-600 font-semibold">Oui</span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={handleAddSubmit}
                        disabled={!newExp.libelle.trim() || !newExp.montant}
                        className="p-1.5 rounded-lg bg-primary-600 text-white disabled:opacity-40 shadow-sm"
                        title="Ajouter la dépense fixe"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setIsAdding(false)}
                        className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
                        title="Annuler"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {/* LISTE DES DÉPENSES AVEC ÉDITION DIRECTE */}
              {expenses.map(exp => {
                const isEditing = editingId === exp.id

                if (isEditing) {
                  return (
                    <tr
                      key={exp.id}
                      className="bg-amber-50/60 dark:bg-amber-950/20"
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          saveEdit(exp.id)
                        } else if (e.key === 'Escape') {
                          cancelEdit()
                        }
                      }}
                    >
                      <td className="px-3 py-2">
                        <input
                          autoFocus
                          className="input text-xs py-1 px-2 font-medium"
                          value={editForm.libelle || ''}
                          onChange={e => setEditForm(p => ({ ...p, libelle: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && saveEdit(exp.id)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          list="swimlane-patterns-datalist"
                          className="input text-xs py-1 px-2 font-mono"
                          placeholder={t('fixedMgr.patternPlaceholder')}
                          value={editForm.pattern || ''}
                          onChange={e => handleEditPatternChange(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && saveEdit(exp.id)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          className="input text-xs py-1 px-2 cursor-pointer"
                          value={editForm.categorie || ''}
                          onChange={e => handleEditCategoryChange(e.target.value)}
                        >
                          {categories.map(c => (
                            <option key={c.id} value={c.nom}>
                              {c.nom}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <span className="badge text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                          {editForm.type}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="input text-xs py-1 px-2 text-right font-semibold"
                          value={editForm.montant !== undefined ? String(editForm.montant) : ''}
                          onChange={e => setEditForm(p => ({ ...p, montant: parseFloat(e.target.value) || 0 }))}
                          onKeyDown={e => e.key === 'Enter' && saveEdit(exp.id)}
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => setEditForm(p => ({ ...p, actif: !p.actif }))}
                          className={`w-8 h-4 rounded-full transition-all duration-200 inline-block align-middle ${
                            editForm.actif ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-700'
                          }`}
                        >
                          <span
                            className={`block w-3 h-3 bg-white rounded-full shadow transition-transform duration-200 mx-0.5 ${
                              editForm.actif ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => saveEdit(exp.id)}
                            className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                            title="Sauvegarder"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
                            title="Annuler"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                }

                return (
                  <tr
                    key={exp.id}
                    onDoubleClick={() => startEdit(exp)}
                    className={`group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer ${
                      !exp.actif ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {exp.libelle}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {exp.pattern ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-mono text-[11px]">
                          {exp.pattern}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {exp.categorie}
                    </td>
                    <td className="px-4 py-3">
                      <span className="badge text-[11px] bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                        {exp.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(exp.montant)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          toggleActif(exp.id)
                        }}
                        className={`w-9 h-5 rounded-full transition-all duration-200 ${
                          exp.actif ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                        title={exp.actif ? 'Actif (cliquez pour désactiver)' : 'Inactif (cliquez pour activer)'}
                      >
                        <span
                          className={`block w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 mx-0.5 ${
                            exp.actif ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            startEdit(exp)
                          }}
                          className="p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 text-gray-400 hover:text-primary-600"
                          title="Éditer directement dans le tableau"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            remove(exp.id)
                          }}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </PocketBaseGuard>
  )
}
