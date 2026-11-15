import { useState, useEffect } from 'react'
import { BudgetRules, CurrencyCode, SavingsRuleItem, SavingsMode } from '@/lib/types'
import { saveBudgetRulesPB } from '@/lib/sync'
import { useBudgetRules, QUERY_KEYS } from '@/lib/queries'
import { useQueryClient } from '@tanstack/react-query'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { formatCurrency, generateId, getCurrencySymbol } from '@/lib/utils'
import { Save, RefreshCw, Plus, Trash2, PiggyBank, Pencil, Check, X, Coins } from 'lucide-react'
import { PocketBaseGuard } from '@/components/ui/PocketBaseRequiredState'
import { DEFAULT_BUDGET_RULES, DEFAULT_CURRENCY, DEFAULT_SAVINGS_RULES, SUPPORTED_CURRENCIES } from '@/lib/constants'
import { useStore } from '@/store/useStore'
import { useTranslation } from '@/i18n'

const SAVINGS_COLORS = [
  '#a78bfa',
  '#fb7185',
  '#6366f1',
  '#0ea5e9',
  '#f59e0b',
  '#10b981',
  '#ec4899',
  '#14b8a6',
  '#8b5cf6',
  '#f97316',
]

export default function BudgetRulesEditor() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: budgetRules = DEFAULT_BUDGET_RULES, error: queryError } = useBudgetRules()
  const setCurrency = useStore(s => s.setCurrency)
  const storeCurrency = useStore(s => s.currency)
  const [form, setForm] = useState<BudgetRules>(() => ({
    ...budgetRules,
    devise: budgetRules.devise || storeCurrency || DEFAULT_CURRENCY,
    ventilation_epargne: budgetRules.ventilation_epargne || DEFAULT_SAVINGS_RULES,
  }))
  const [saved, setSaved] = useState(false)

  // New savings line state
  const [newLineLibelle, setNewLineLibelle] = useState('')
  const [newLineMode, setNewLineMode] = useState<SavingsMode>('pourcentage')
  const [newLineValeur, setNewLineValeur] = useState<string>('')
  const [newLineCouleur, setNewLineCouleur] = useState(SAVINGS_COLORS[0])

  // Inline edit savings line state
  const [editingLineId, setEditingLineId] = useState<string | null>(null)
  const [editLineLibelle, setEditLineLibelle] = useState('')
  const [editLineMode, setEditLineMode] = useState<SavingsMode>('pourcentage')
  const [editLineValeur, setEditLineValeur] = useState<string>('')
  const [editLineCouleur, setEditLineCouleur] = useState('')

  const totalVentilation = form.taux_essentielle + form.taux_loisirs + form.taux_epargne
  const isVentilationValid = Math.abs(totalVentilation - 1) < 0.001

  const pocheEpargneGlobale = form.revenus_theoriques * form.taux_epargne

  const savingsItems = form.ventilation_epargne || []
  const totalFixe = savingsItems
    .filter(i => i.mode === 'fixe')
    .reduce((sum, i) => sum + (Number(i.valeur) || 0), 0)

  const restantPourPourcentage = Math.max(0, pocheEpargneGlobale - totalFixe)

  const computePctAmount = (pctValue: number | string, base = restantPourPourcentage) => {
    const num = typeof pctValue === 'number' ? pctValue : parseFloat(pctValue) || 0
    return base * (Math.max(0, num) / 100)
  }

  const editRestantPourPourcentage = editingLineId
    ? Math.max(
        0,
        pocheEpargneGlobale -
          (savingsItems
            .filter(i => i.id !== editingLineId && i.mode === 'fixe')
            .reduce((sum, i) => sum + (Number(i.valeur) || 0), 0) +
            (editLineMode === 'fixe' ? parseFloat(editLineValeur) || 0 : 0))
      )
    : restantPourPourcentage

  const totalPourcentage = savingsItems
    .filter(i => i.mode === 'pourcentage')
    .reduce((sum, i) => sum + (Number(i.valeur) || 0), 0)

  const totalPourcentageMontant = restantPourPourcentage * (totalPourcentage / 100)
  const restantAVentiler = pocheEpargneGlobale - totalFixe - totalPourcentageMontant

  const isSavingsPctValid = Math.abs(totalPourcentage - 100) < 0.1 || savingsItems.filter(i => i.mode === 'pourcentage').length === 0

  const [saveError, setSaveError] = useState<string | null>(null)

  // Source de vérité : PocketBase (via React Query)
  useEffect(() => {
    if (budgetRules) {
      setForm({
        ...budgetRules,
        devise: budgetRules.devise || storeCurrency || DEFAULT_CURRENCY,
        ventilation_epargne: budgetRules.ventilation_epargne?.length ? budgetRules.ventilation_epargne : DEFAULT_SAVINGS_RULES,
      })
    }
  }, [budgetRules, storeCurrency])

  useEffect(() => {
    if (queryError) {
      setSaveError((queryError as Error).message || t('common.pbUnreachable'))
    }
  }, [queryError])

  const handleSave = async () => {
    setSaveError(null)
    try {
      const nextDevise = (form.devise || DEFAULT_CURRENCY) as CurrencyCode
      await saveBudgetRulesPB({ ...form, devise: nextDevise })
      setCurrency(nextDevise)
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.budgetRules })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err: any) {
      setSaveError(err.message || t('common.pbSaveError'))
    }
  }

  const handleReset = () => {
    setForm(DEFAULT_BUDGET_RULES)
  }

  const handleAddSavingsLine = () => {
    if (!newLineLibelle.trim() || !newLineValeur) return
    const newItem: SavingsRuleItem = {
      id: generateId(),
      libelle: newLineLibelle.trim(),
      mode: newLineMode,
      valeur: parseFloat(newLineValeur) || 0,
      couleur: newLineCouleur,
    }
    setForm(prev => ({
      ...prev,
      ventilation_epargne: [...(prev.ventilation_epargne || []), newItem],
    }))
    setNewLineLibelle('')
    setNewLineValeur('')
  }

  const startEditSavingsLine = (item: SavingsRuleItem) => {
    setEditingLineId(item.id)
    setEditLineLibelle(item.libelle)
    setEditLineMode(item.mode)
    setEditLineValeur(String(item.valeur))
    setEditLineCouleur(item.couleur || SAVINGS_COLORS[0])
  }

  const saveEditSavingsLine = (id: string) => {
    if (!editLineLibelle.trim() || !editLineValeur) return
    setForm(prev => ({
      ...prev,
      ventilation_epargne: (prev.ventilation_epargne || []).map(item =>
        item.id === id
          ? {
              ...item,
              libelle: editLineLibelle.trim(),
              mode: editLineMode,
              valeur: parseFloat(editLineValeur) || 0,
              couleur: editLineCouleur,
            }
          : item
      ),
    }))
    setEditingLineId(null)
  }

  const handleDeleteSavingsLine = (id: string) => {
    setForm(prev => ({
      ...prev,
      ventilation_epargne: (prev.ventilation_epargne || []).filter(item => item.id !== id),
    }))
  }

  const pct = (val: number) => `${(val * 100).toFixed(0)}%`
  const activeDevise = form.devise || DEFAULT_CURRENCY
  const currencySymbol = getCurrencySymbol(activeDevise)

  return (
    <PocketBaseGuard error={saveError}>
    <div className="space-y-6">
      {/* 0. DEVISE */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary-100 dark:bg-primary-900/40 rounded-xl text-primary-600 dark:text-primary-400">
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t('budget.currencyTitle')}</h3>
            <p className="text-xs text-gray-400">
              {t('budget.currencyDesc')}
            </p>
          </div>
        </div>
        <Select
          label={t('budget.currencyLabel')}
          value={activeDevise}
          onChange={e => setForm(p => ({ ...p, devise: e.target.value as CurrencyCode }))}
          options={SUPPORTED_CURRENCIES.map(c => ({ value: c.code, label: c.label }))}
        />
      </div>

      {/* 1. REVENUS DE RÉFÉRENCE */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t('budget.incomeTitle')}</h3>
        <Input
          label={t('budget.incomeLabel', { symbol: currencySymbol })}
          type="number"
          step="1"
          min="0"
          value={form.revenus_theoriques}
          onChange={e => setForm(p => ({ ...p, revenus_theoriques: parseFloat(e.target.value) || 0 }))}
        />
      </div>

      {/* 2. RÈGLE 55 / 25 / 20 */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            {t('budget.ruleTitle')}
          </h3>
          <span
            className={`badge text-xs ${
              isVentilationValid
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}
          >
            {t('budget.totalPct', { pct: pct(totalVentilation) })} {isVentilationValid ? '✓' : '≠ 100%'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { key: 'taux_essentielle', label: t('budget.essential'), color: '#6366f1' },
            { key: 'taux_loisirs', label: t('budget.leisure'), color: '#f59e0b' },
            { key: 'taux_epargne', label: t('budget.savings'), color: '#10b981' },
          ].map(({ key, label, color }) => (
            <div key={key} className="text-center">
              <p className="text-xs font-semibold mb-2" style={{ color }}>
                {label}
              </p>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={Math.round((form as unknown as Record<string, number>)[key] * 100)}
                  onChange={e =>
                    setForm(p => ({ ...p, [key]: (parseInt(e.target.value) || 0) / 100 }))
                  }
                  className="input text-center text-xl font-bold pr-6"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
              </div>
              <p className="text-xs font-semibold mt-1.5" style={{ color }}>
                {formatCurrency(form.revenus_theoriques * (form as unknown as Record<string, number>)[key], activeDevise)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 3. VENTILATION ÉPARGNE FUSIONNÉE (Fixe & Pourcentage) */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl text-emerald-600 dark:text-emerald-400">
              <PiggyBank className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {t('budget.savingsTitle')}
              </h3>
              <p className="text-xs text-gray-400">
                {t('budget.savingsDesc', { symbol: currencySymbol })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="badge text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
              {t('budget.fixedTotal', { amount: formatCurrency(totalFixe, activeDevise) })}
            </span>
            <span
              className={`badge text-xs ${
                Math.abs(restantAVentiler) < 0.01
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : restantAVentiler < -0.01
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              {t('budget.remainingToAllocate', { amount: formatCurrency(restantAVentiler, activeDevise) })}
            </span>
            <span
              className={`badge text-xs ${
                isSavingsPctValid
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
              }`}
            >
              {t('budget.totalPctLabel', {
                pct: totalPourcentage.toFixed(0),
                check: isSavingsPctValid ? '✓' : t('budget.ideally100'),
              })}
            </span>
          </div>
        </div>

        {/* Ligne d'ajout rapide d'une poche d'épargne */}
        <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl">
          <input
            className="input text-xs py-1.5 px-3 flex-1 min-w-[140px]"
            placeholder={t('budget.savingsLabelPlaceholder')}
            value={newLineLibelle}
            onChange={e => setNewLineLibelle(e.target.value)}
          />

          <select
            className="input text-xs py-1.5 px-2 w-auto cursor-pointer"
            value={newLineMode}
            onChange={e => setNewLineMode(e.target.value as SavingsMode)}
          >
            <option value="fixe">{t('budget.modeFixed', { symbol: currencySymbol })}</option>
            <option value="pourcentage">{t('budget.modePct')}</option>
          </select>

          <div className="relative w-24">
            <input
              type="number"
              step="1"
              min="0"
              className="input text-xs py-1.5 pr-6 text-right font-semibold"
              placeholder={t('budget.valuePlaceholder')}
              value={newLineValeur}
              onChange={e => setNewLineValeur(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddSavingsLine()}
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">
              {newLineMode === 'fixe' ? currencySymbol : '%'}
            </span>
          </div>

          {newLineMode === 'pourcentage' && (
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
              ≈ {formatCurrency(computePctAmount(newLineValeur), activeDevise)}
            </span>
          )}

          <div className="flex items-center gap-1">
            {SAVINGS_COLORS.slice(0, 5).map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setNewLineCouleur(c)}
                className={`w-4 h-4 rounded-full transition-transform ${
                  newLineCouleur === c ? 'scale-125 ring-2 ring-primary-500' : 'opacity-70'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <button
            onClick={handleAddSavingsLine}
            disabled={!newLineLibelle.trim() || !newLineValeur}
            className="btn-primary text-xs py-1.5 px-3 disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" /> {t('common.add')}
          </button>
        </div>

        {/* Tableau des lignes d'épargne */}
        <div className="space-y-2">
          {savingsItems.map(item => {
            const isEditing = editingLineId === item.id

            if (isEditing) {
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900"
                >
                  <input
                    autoFocus
                    className="input text-xs py-1 px-2 flex-1"
                    value={editLineLibelle}
                    onChange={e => setEditLineLibelle(e.target.value)}
                  />
                  <select
                    className="input text-xs py-1 px-2 w-auto cursor-pointer"
                    value={editLineMode}
                    onChange={e => setEditLineMode(e.target.value as SavingsMode)}
                  >
                    <option value="fixe">{t('budget.modeFixedShort', { symbol: currencySymbol })}</option>
                    <option value="pourcentage">{t('budget.modePct')}</option>
                  </select>
                  <div className="relative w-24">
                    <input
                      type="number"
                      step="1"
                      className="input text-xs py-1 pr-6 text-right"
                      value={editLineValeur}
                      onChange={e => setEditLineValeur(e.target.value)}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">
                      {editLineMode === 'fixe' ? currencySymbol : '%'}
                    </span>
                  </div>
                  {editLineMode === 'pourcentage' && (
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      ≈ {formatCurrency(computePctAmount(editLineValeur, editRestantPourPourcentage), activeDevise)}
                    </span>
                  )}
                  <button
                    onClick={() => saveEditSavingsLine(item.id)}
                    className="p-1.5 rounded-lg bg-emerald-600 text-white"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setEditingLineId(null)}
                    className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            }

            return (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 group"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.couleur || '#10b981' }}
                  />
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    {item.libelle}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`badge text-xs font-semibold ${
                      item.mode === 'fixe'
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                    }`}
                  >
                    {item.mode === 'fixe'
                      ? t('budget.fixedTag', { amount: formatCurrency(item.valeur, activeDevise) })
                      : t('budget.pctTag', { pct: item.valeur, amount: formatCurrency(computePctAmount(item.valeur), activeDevise) })}
                  </span>

                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    <button
                      onClick={() => startEditSavingsLine(item)}
                      className="p-1 text-gray-400 hover:text-primary-600 rounded"
                      title={t('common.edit')}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteSavingsLine(item.id)}
                      className="p-1 text-gray-400 hover:text-red-500 rounded"
                      title={t('common.delete')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ACTIONS */}
      <div className="flex gap-3 justify-end items-center">
        {saveError && <span className="text-xs text-red-500 mr-auto">{saveError}</span>}
        <button onClick={handleReset} className="btn-secondary text-xs">
          <RefreshCw className="w-4 h-4" /> {t('budget.resetBtn')}
        </button>
        <button
          onClick={handleSave}
          disabled={!isVentilationValid}
          className="btn-primary text-xs disabled:opacity-40"
        >
          <Save className="w-4 h-4" />
          {saved ? t('budget.savedBtn') : t('budget.saveBtn')}
        </button>
      </div>
    </div>
    </PocketBaseGuard>
  )
}
