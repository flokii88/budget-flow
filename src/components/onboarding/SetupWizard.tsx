import { useState, useMemo, useEffect } from 'react'
import {
  Wallet,
  PieChart,
  PiggyBank,
  Tag,
  Receipt,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  Sparkles,
  Check,
  RefreshCw,
  X,
  Layers,
  Database,
  Wifi,
  WifiOff,
  Coins,
} from 'lucide-react'
import { BudgetRules, CurrencyCode, SavingsRuleItem, BudgetCategory, FixedExpense, SavingsMode } from '@/lib/types'
import {
  DEFAULT_CATEGORIES,
  DEFAULT_CURRENCY,
  SUGGESTED_TYPES_BY_CATEGORY,
  SUPPORTED_CURRENCIES,
} from '@/lib/constants'
import { useStore } from '@/store/useStore'
import pb, { updatePocketBaseUrl } from '@/lib/pocketbase'
import {
  saveBudgetRulesPB,
  saveCategoryPB,
  saveFixedExpensePB,
  checkPocketBaseHealth,
  subscribeSyncStatus,
  SyncStatus,
} from '@/lib/sync'
import {
  useBudgetRules,
  useCategories,
  useFixedExpenses,
  invalidateAllBudgetQueries,
} from '@/lib/queries'
import { useQueryClient } from '@tanstack/react-query'
import { formatCurrency, generateId, getCurrencySymbol } from '@/lib/utils'
import LogoIcon from '@/components/ui/LogoIcon'

const SAVINGS_COLORS = [
  '#6366f1',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#a78bfa',
  '#fb7185',
  '#ec4899',
  '#14b8a6',
]

import { Globe } from 'lucide-react'
import { useTranslation, translateType } from '@/i18n'

interface SetupWizardProps {
  isOpen: boolean
  onClose: () => void
  onFinish?: () => void
}

interface IncomeDetail {
  id: string
  libelle: string
  montant: number
}

export default function SetupWizard({ isOpen, onClose, onFinish }: SetupWizardProps) {
  const { t, language } = useTranslation()
  const setLanguage = useStore(s => s.setLanguage)
  const queryClient = useQueryClient()
  const { data: pbBudgetRules } = useBudgetRules()
  const { data: pbCategories } = useCategories()
  const { data: pbFixedExpenses } = useFixedExpenses()

  // Navigation Étape 1 à 8
  const [currentStep, setCurrentStep] = useState<number>(1)

  // ─── Step 1: PocketBase ─────────────────────────────────────────────────────
  const [pbUrlInput, setPbUrlInput] = useState<string>(pb.baseUrl)
  const [isTestingPb, setIsTestingPb] = useState<boolean>(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: false,
    isSyncing: false,
    lastSyncTime: null,
    error: null,
  })

  useEffect(() => {
    return subscribeSyncStatus(setSyncStatus)
  }, [])

  useEffect(() => {
    if (isOpen) {
      setPbUrlInput(pb.baseUrl)
      checkPocketBaseHealth()
    }
  }, [isOpen])

  const handleTestPocketBase = async () => {
    setIsTestingPb(true)
    updatePocketBaseUrl(pbUrlInput)
    const ok = await checkPocketBaseHealth()
    if (ok) {
      await invalidateAllBudgetQueries(queryClient)
    }
    setIsTestingPb(false)
  }

  // ─── Step 2: Devise & Revenus ───────────────────────────────────────────────
  const setStoreCurrency = useStore(s => s.setCurrency)
  const storeCurrency = useStore(s => s.currency)
  const [devise, setDevise] = useState<CurrencyCode>(storeCurrency || DEFAULT_CURRENCY)
  const [incomeMode, setIncomeMode] = useState<'simple' | 'detailed'>('simple')
  const [simpleIncome, setSimpleIncome] = useState<number>(3200)

  useEffect(() => {
    if (isOpen && pbBudgetRules) {
      if (pbBudgetRules.revenus_theoriques > 0) {
        setSimpleIncome(pbBudgetRules.revenus_theoriques)
      }
      if (pbBudgetRules.devise) {
        setDevise(pbBudgetRules.devise)
      }
    }
  }, [isOpen, pbBudgetRules])

  const handleSelectDevise = (nextDevise: CurrencyCode) => {
    setDevise(nextDevise)
    setStoreCurrency(nextDevise)
  }
  const [detailedIncomes, setDetailedIncomes] = useState<IncomeDetail[]>([
    { id: '1', libelle: 'Salaire principal', montant: 2200 },
    { id: '2', libelle: 'Second revenu / Salaire', montant: 1000 },
  ])
  const [newIncomeLibelle, setNewIncomeLibelle] = useState('')
  const [newIncomeMontant, setNewIncomeMontant] = useState('')

  const totalMonthlyIncome = useMemo(() => {
    if (incomeMode === 'simple') return Math.max(0, simpleIncome || 0)
    return detailedIncomes.reduce((acc, curr) => acc + (Number(curr.montant) || 0), 0)
  }, [incomeMode, simpleIncome, detailedIncomes])

  // ─── Step 2: Ventilation 55/25/20 ───────────────────────────────────────────
  const [tauxEssentielle, setTauxEssentielle] = useState<number>(55)
  const [tauxLoisirs, setTauxLoisirs] = useState<number>(25)
  const [tauxEpargne, setTauxEpargne] = useState<number>(20)

  const sumTaux = tauxEssentielle + tauxLoisirs + tauxEpargne
  const isRatioValid = Math.abs(sumTaux - 100) < 0.1

  const amountEssentielle = (totalMonthlyIncome * tauxEssentielle) / 100
  const amountLoisirs = (totalMonthlyIncome * tauxLoisirs) / 100
  const amountEpargne = (totalMonthlyIncome * tauxEpargne) / 100

  // ─── Step 3: Ventilation de l'épargne ────────────────────────────────────────
  const [savingsRules, setSavingsRules] = useState<SavingsRuleItem[]>([])
  const [newPocketLibelle, setNewPocketLibelle] = useState('')
  const [newPocketMode, setNewPocketMode] = useState<SavingsMode>('pourcentage')
  const [newPocketValeur, setNewPocketValeur] = useState('')
  const [newPocketColor, setNewPocketColor] = useState(SAVINGS_COLORS[0])

  const totalFixeEpargne = savingsRules
    .filter(r => r.mode === 'fixe')
    .reduce((sum, r) => sum + (Number(r.valeur) || 0), 0)

  const restantPourcentageEpargne = Math.max(0, amountEpargne - totalFixeEpargne)

  // ─── Step 4: Catégories & Types (Structure à 2 mailles claire) ───────────────
  // Stocke les types sous forme de BudgetCategory { id, nom, types: [parentCategory] }
  const [activeCategoryTab, setActiveCategoryTab] = useState<'Essentielle' | 'Loisirs' | 'Epargne' | 'Revenu'>('Essentielle')
  const [categories, setCategories] = useState<BudgetCategory[]>(DEFAULT_CATEGORIES)
  const [newTypeName, setNewTypeName] = useState('')

  // ─── Step 5: Dépenses fixes ──────────────────────────────────────────────────
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([])

  useEffect(() => {
    if (isOpen && pbCategories && pbCategories.length > 0) {
      setCategories(pbCategories)
    }
  }, [isOpen, pbCategories])

  useEffect(() => {
    if (isOpen && pbFixedExpenses) {
      setFixedExpenses(pbFixedExpenses)
    }
  }, [isOpen, pbFixedExpenses])
  const [newFixedLibelle, setNewFixedLibelle] = useState('')
  const [newFixedPattern, setNewFixedPattern] = useState('')
  const [newFixedMontant, setNewFixedMontant] = useState('')
  const [newFixedCategory, setNewFixedCategory] = useState<string>('Alimentation & Supermarché')

  const totalFixedExpenses = fixedExpenses.reduce((sum, e) => sum + (Number(e.montant) || 0), 0)

  // ─── Step 6: Finalisation ────────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  if (!isOpen) return null

  // ─── Handlers Revenus ────────────────────────────────────────────────────────
  const handleAddDetailedIncome = () => {
    if (!newIncomeLibelle.trim() || !newIncomeMontant) return
    const montant = parseFloat(newIncomeMontant) || 0
    if (montant <= 0) return
    setDetailedIncomes(prev => [
      ...prev,
      { id: generateId(), libelle: newIncomeLibelle.trim(), montant },
    ])
    setNewIncomeLibelle('')
    setNewIncomeMontant('')
  }

  const handleRemoveDetailedIncome = (id: string) => {
    setDetailedIncomes(prev => prev.filter(i => i.id !== id))
  }

  // ─── Handlers Epargne ────────────────────────────────────────────────────────
  const handleAddSavingsPocket = () => {
    if (!newPocketLibelle.trim() || !newPocketValeur) return
    const val = parseFloat(newPocketValeur) || 0
    if (val <= 0) return
    const newPocket: SavingsRuleItem = {
      id: generateId(),
      libelle: newPocketLibelle.trim(),
      mode: newPocketMode,
      valeur: val,
      couleur: newPocketColor,
    }
    setSavingsRules(prev => [...prev, newPocket])
    
    // Ajoute aussi automatiquement ce type d'épargne dans la catégorie 'Epargne'
    if (!categories.some(c => c.nom.toLowerCase() === newPocketLibelle.trim().toLowerCase())) {
      setCategories(prev => [
        ...prev,
        { id: generateId(), nom: newPocketLibelle.trim(), types: ['Epargne'] },
      ])
    }

    setNewPocketLibelle('')
    setNewPocketValeur('')
    const nextColorIdx = (SAVINGS_COLORS.indexOf(newPocketColor) + 1) % SAVINGS_COLORS.length
    setNewPocketColor(SAVINGS_COLORS[nextColorIdx])
  }

  const handleRemoveSavingsPocket = (id: string) => {
    setSavingsRules(prev => prev.filter(p => p.id !== id))
  }

  const applyRecommendedSavingsPockets = () => {
    const defaultPockets: SavingsRuleItem[] = [
      {
        id: generateId(),
        libelle: t('wizard.savingsRec1'),
        mode: 'pourcentage',
        valeur: 50,
        couleur: '#10b981',
      },
      {
        id: generateId(),
        libelle: t('wizard.savingsRec2'),
        mode: 'pourcentage',
        valeur: 30,
        couleur: '#6366f1',
      },
      {
        id: generateId(),
        libelle: t('wizard.savingsRec3'),
        mode: 'pourcentage',
        valeur: 20,
        couleur: '#0ea5e9',
      },
    ]
    setSavingsRules(defaultPockets)

    // Insérer aussi ces types dans la catégorie 'Epargne'
    setCategories(prev => {
      const next = [...prev]
      for (const p of defaultPockets) {
        if (!next.some(c => c.nom === p.libelle)) {
          next.push({ id: generateId(), nom: p.libelle, types: ['Epargne'] })
        }
      }
      return next
    })
  }

  // ─── Handlers Catégories & Types ─────────────────────────────────────────────
  const toggleTypeInCategory = (parentCategory: 'Essentielle' | 'Loisirs' | 'Epargne' | 'Revenu', typeName: string) => {
    const existing = categories.find(c => c.nom === typeName)
    if (existing) {
      // Décocher / supprimer si ce n'est pas une catégorie système
      const isBaseSystem = DEFAULT_CATEGORIES.some(dc => dc.nom === typeName)
      if (!isBaseSystem) {
        setCategories(prev => prev.filter(c => c.nom !== typeName))
      }
    } else {
      // Cocher / ajouter
      setCategories(prev => [
        ...prev,
        { id: generateId(), nom: typeName, types: [parentCategory] },
      ])
    }
  }

  const handleAddCustomType = (parentCategory: 'Essentielle' | 'Loisirs' | 'Epargne' | 'Revenu') => {
    const trimmed = newTypeName.trim()
    if (!trimmed) return
    if (categories.some(c => c.nom.toLowerCase() === trimmed.toLowerCase())) return
    setCategories(prev => [
      ...prev,
      { id: generateId(), nom: trimmed, types: [parentCategory] },
    ])
    setNewTypeName('')
  }

  const handleRemoveType = (id: string) => {
    const target = categories.find(c => c.id === id)
    if (!target) return
    const isBaseSystem = DEFAULT_CATEGORIES.some(dc => dc.nom === target.nom)
    if (isBaseSystem) return
    setCategories(prev => prev.filter(c => c.id !== id))
  }

  const selectAllSuggestionsForCategory = (parentCategory: 'Essentielle' | 'Loisirs' | 'Epargne' | 'Revenu') => {
    const suggestions = SUGGESTED_TYPES_BY_CATEGORY[parentCategory] || []
    setCategories(prev => {
      const next = [...prev]
      for (const sug of suggestions) {
        if (!next.some(c => c.nom === sug.nom)) {
          next.push({ id: generateId(), nom: sug.nom, types: [parentCategory] })
        }
      }
      return next
    })
  }

  // ─── Handlers Dépenses Fixes ─────────────────────────────────────────────────
  const handleAddFixedExpense = () => {
    if (!newFixedLibelle.trim() || !newFixedMontant) return
    const montant = parseFloat(newFixedMontant) || 0
    if (montant <= 0) return

    const newExpense: FixedExpense = {
      id: generateId(),
      libelle: newFixedLibelle.trim(),
      pattern: newFixedPattern.trim(),
      montant,
      categorie: newFixedCategory || 'Logement, Énergie & Charges',
      type: 'Essentielle',
      actif: true,
      ordre: fixedExpenses.length + 1,
    }
    setFixedExpenses(prev => [...prev, newExpense])
    setNewFixedLibelle('')
    setNewFixedPattern('')
    setNewFixedMontant('')
  }

  const handleRemoveFixedExpense = (id: string) => {
    setFixedExpenses(prev => prev.filter(e => e.id !== id))
  }

  // ─── Validation finale & Enregistrement ──────────────────────────────────────
  const handleSaveAndFinish = async () => {
    setIsSaving(true)
    setSyncResult(null)

    const finalRules: BudgetRules = {
      revenus_theoriques: totalMonthlyIncome,
      taux_essentielle: tauxEssentielle / 100,
      taux_loisirs: tauxLoisirs / 100,
      taux_epargne: tauxEpargne / 100,
      ventilation_epargne: savingsRules,
      devise,
    }
    setStoreCurrency(devise)

    const finalCategories = [...categories]
    for (const defCat of DEFAULT_CATEGORIES) {
      if (!finalCategories.some(c => c.nom === defCat.nom)) {
        finalCategories.push(defCat)
      }
    }

    try {
      const isOnline = await checkPocketBaseHealth()
      if (!isOnline) {
        setSyncResult(t('wizard.saveErrOffline'))
        setIsSaving(false)
        return
      }

      setSyncResult(t('wizard.saveInProgress'))
      await saveBudgetRulesPB(finalRules)

      for (const cat of finalCategories) {
        await saveCategoryPB(cat).catch(() => null)
      }

      for (const fe of fixedExpenses) {
        await saveFixedExpensePB(fe).catch(() => null)
      }

      await invalidateAllBudgetQueries(queryClient)
      setSyncResult(t('wizard.saveSuccess'))
    } catch (err) {
      console.warn('PocketBase save error:', err)
      setSyncResult(t('wizard.saveError'))
    }

    setTimeout(() => {
      setIsSaving(false)
      onFinish?.()
      onClose()
    }, 500)
  }

  const mainCategories = [
    { id: 'Essentielle', label: translateType('Essentielle', language), badge: '55%', color: 'indigo', desc: t('wizard.catEssentielleDesc') },
    { id: 'Loisirs', label: translateType('Loisirs', language), badge: '25%', color: 'amber', desc: t('wizard.catLoisirsDesc') },
    { id: 'Epargne', label: translateType('Epargne', language), badge: '20%', color: 'emerald', desc: t('wizard.catEpargneDesc') },
    { id: 'Revenu', label: translateType('Revenu', language), badge: t('wizard.catRevenuBadge'), color: 'blue', desc: t('wizard.catRevenuDesc') },
  ] as const

  const stepsMeta = [
    { num: 1, label: t('wizard.stepLang'), icon: Globe },
    { num: 2, label: t('wizard.stepPb'), icon: Database },
    { num: 3, label: t('wizard.stepIncome'), icon: Wallet },
    { num: 4, label: t('wizard.stepSplit'), icon: PieChart },
    { num: 5, label: t('wizard.stepSavings'), icon: PiggyBank },
    { num: 6, label: t('wizard.stepCategories'), icon: Tag },
    { num: 7, label: t('wizard.stepFixed'), icon: Receipt },
    { num: 8, label: t('wizard.stepSummary'), icon: CheckCircle2 },
  ]

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col min-h-screen overflow-y-auto animate-fade-in">
      
      {/* ─── Top Header Plein Écran ──────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <LogoIcon className="w-10 h-10 shadow-md shadow-primary-500/20" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base sm:text-lg text-gray-900 dark:text-white">
                  Budget Flow
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 font-semibold border border-primary-200 dark:border-primary-800">
                  {t('wizard.badge')}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('wizard.subtitle')}
              </p>
            </div>
          </div>

          {/* Stepper horizontal compact */}
          <div className="hidden md:flex items-center gap-1 bg-gray-100 dark:bg-gray-800/80 p-1.5 rounded-2xl border border-gray-200/50 dark:border-gray-700/50">
            {stepsMeta.map(s => {
              const Icon = s.icon
              const isCurrent = currentStep === s.num
              const isDone = currentStep > s.num
              return (
                <button
                  key={s.num}
                  onClick={() => setCurrentStep(s.num)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    isCurrent
                      ? 'bg-white dark:bg-gray-900 text-primary-600 dark:text-primary-400 shadow-sm'
                      : isDone
                      ? 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700'
                      : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{s.label}</span>
                </button>
              )
            })}
          </div>

          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
            title={t('wizard.quitTitle')}
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">{t('wizard.quit')}</span>
          </button>
        </div>

        {/* Barre de progression fluide */}
        <div className="w-full bg-gray-200 dark:bg-gray-800 h-1">
          <div
            className="h-full bg-gradient-to-r from-primary-500 via-indigo-500 to-emerald-500 transition-all duration-300"
            style={{ width: `${(currentStep / 8) * 100}%` }}
          />
        </div>
      </header>

      {/* ─── Contenu Central Plein Écran Aéré ────────────────────────────── */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-8 py-8 flex flex-col justify-start">
        
        {/* ════════════ ÉTAPE 1 : LANGUE / LANGUAGE ════════════ */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-fade-in max-w-3xl mx-auto w-full">
            <div className="space-y-1 text-center sm:text-left">
              <span className="text-xs font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400">
                {t('wizard.stepOf', { step: 1, total: 8 })}
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2 justify-center sm:justify-start">
                <Globe className="w-7 h-7 text-primary-500" />
                {t('wizard.langTitle')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
                {t('wizard.langSub')}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(
                [
                  { code: 'fr', flag: '🇫🇷', name: t('wizard.langFrName'), desc: t('wizard.langFrDesc') },
                  { code: 'en', flag: '🇬🇧', name: t('wizard.langEnName'), desc: t('wizard.langEnDesc') },
                ] as const
              ).map(opt => {
                const isSelected = language === opt.code
                return (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => setLanguage(opt.code)}
                    className={`p-6 rounded-3xl border-2 text-left transition-all flex items-start justify-between gap-4 ${
                      isSelected
                        ? 'bg-white dark:bg-gray-900 border-primary-500 shadow-lg ring-4 ring-primary-500/15'
                        : 'bg-white/70 dark:bg-gray-900/60 border-gray-200 dark:border-gray-800 hover:border-primary-300 dark:hover:border-primary-700'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <span className="text-3xl leading-none" aria-hidden="true">
                        {opt.flag}
                      </span>
                      <div>
                        <p className="text-lg font-extrabold text-gray-900 dark:text-white">
                          {opt.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {opt.desc}
                        </p>
                      </div>
                    </div>
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center border shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-primary-600 border-primary-600 text-white'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ════════════ ÉTAPE 2 : CONNEXION POCKETBASE ════════════ */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-fade-in max-w-3xl mx-auto w-full">
            <div className="space-y-1 text-center sm:text-left">
              <span className="text-xs font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400">
                {t('wizard.stepOf', { step: 2, total: 8 })}
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2 justify-center sm:justify-start">
                <Database className="w-7 h-7 text-primary-500" />
                {t('wizard.pbTitle')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
                {t('wizard.pbSub')}
              </p>
            </div>

            <div className="card p-6 sm:p-8 space-y-5 border-2 border-primary-100 dark:border-primary-900/40">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {t('wizard.pbStatusLabel')}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                    isTestingPb || syncStatus.isSyncing
                      ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                      : syncStatus.isOnline
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                      : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800'
                  }`}
                >
                  {isTestingPb || syncStatus.isSyncing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      {t('wizard.pbChecking')}
                    </>
                  ) : syncStatus.isOnline ? (
                    <>
                      <Wifi className="w-3.5 h-3.5" />
                      {t('wizard.pbConnected')}
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3.5 h-3.5" />
                      {t('wizard.pbOffline')}
                    </>
                  )}
                </span>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {t('wizard.pbUrlLabel')}
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="url"
                    value={pbUrlInput}
                    onChange={e => setPbUrlInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleTestPocketBase()
                      }
                    }}
                    placeholder="http://127.0.0.1:8090"
                    className="input flex-1 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleTestPocketBase}
                    disabled={isTestingPb}
                    className="btn-primary px-5 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 shrink-0"
                  >
                    <RefreshCw className={`w-4 h-4 ${isTestingPb ? 'animate-spin' : ''}`} />
                    <span>{t('wizard.pbTestBtn')}</span>
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  {t('wizard.pbDefaultHelp', { url: 'http://127.0.0.1:8090' })}
                </p>
              </div>

              {syncStatus.isOnline ? (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/70 flex items-start gap-3 text-xs text-emerald-800 dark:text-emerald-200">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">{t('wizard.pbReadyTitle', { url: pb.baseUrl })}</p>
                    <p>
                      {t('wizard.pbReadyDesc')}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 space-y-2 text-xs text-amber-900 dark:text-amber-200">
                  <p className="font-bold">{t('wizard.pbNotDetected')}</p>
                  {syncStatus.error && (
                    <p className="text-amber-800 dark:text-amber-300">{syncStatus.error}</p>
                  )}
                  <p className="text-amber-700 dark:text-amber-300/90">
                    {t('wizard.pbNotDetectedHelp')}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════ ÉTAPE 3 : REVENUS ════════════ */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-fade-in max-w-3xl mx-auto w-full">
            <div className="space-y-1 text-center sm:text-left">
              <span className="text-xs font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400">
                {t('wizard.stepOf', { step: 3, total: 8 })}
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2 justify-center sm:justify-start">
                <Wallet className="w-7 h-7 text-primary-500" />
                {t('wizard.incomeTitle')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
                {t('wizard.incomeSub')}
              </p>
            </div>

            {/* Sélection de la devise */}
            <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-2xl bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400 shrink-0">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <label htmlFor="wizard-devise" className="block text-sm font-bold text-gray-800 dark:text-gray-200">
                    {t('wizard.currencyLabel')}
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {t('wizard.currencyHelp')}
                  </p>
                </div>
              </div>
              <select
                id="wizard-devise"
                value={devise}
                onChange={e => handleSelectDevise(e.target.value as CurrencyCode)}
                className="input text-sm font-semibold py-2.5 px-3 sm:w-64 cursor-pointer"
              >
                {SUPPORTED_CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Mode Simple vs Détaillé */}
            <div className="flex bg-gray-200/80 dark:bg-gray-800/80 p-1.5 rounded-2xl w-fit">
              <button
                type="button"
                onClick={() => setIncomeMode('simple')}
                className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                  incomeMode === 'simple'
                    ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                {t('wizard.incomeModeSimple')}
              </button>
              <button
                type="button"
                onClick={() => setIncomeMode('detailed')}
                className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                  incomeMode === 'detailed'
                    ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                {t('wizard.incomeModeDetailed')}
              </button>
            </div>

            {incomeMode === 'simple' ? (
              <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                  {t('wizard.incomeSimpleLabel', { symbol: getCurrencySymbol() })}
                </label>
                <div className="relative max-w-md">
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={simpleIncome || ''}
                    onChange={e => setSimpleIncome(parseFloat(e.target.value) || 0)}
                    placeholder={t('wizard.incomeSimplePlaceholder')}
                    className="w-full text-3xl font-black py-4 px-5 pr-12 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xl">
                    {getCurrencySymbol()}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('wizard.incomeSimpleHelp')}
                </p>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
                <div className="space-y-2">
                  {detailedIncomes.map(item => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 rounded-2xl"
                    >
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {item.libelle}
                      </span>
                      <div className="flex items-center gap-4">
                        <span className="text-base font-bold text-primary-600 dark:text-primary-400">
                          {formatCurrency(item.montant)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveDetailedIncome(item.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-2 flex-wrap sm:flex-nowrap">
                  <input
                    type="text"
                    placeholder={t('wizard.incomeItemPlaceholder')}
                    value={newIncomeLibelle}
                    onChange={e => setNewIncomeLibelle(e.target.value)}
                    className="input text-sm py-2.5 flex-1"
                  />
                  <div className="relative w-36">
                    <input
                      type="number"
                      placeholder={t('wizard.amountPlaceholder')}
                      value={newIncomeMontant}
                      onChange={e => setNewIncomeMontant(e.target.value)}
                      className="input text-sm py-2.5 pr-7 w-full"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">
                      {getCurrencySymbol()}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddDetailedIncome}
                    className="btn-primary text-sm py-2.5 px-5 flex items-center gap-1.5 shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    {t('common.add')}
                  </button>
                </div>
              </div>
            )}

            {/* Total mensuel calculé */}
            <div className="p-5 rounded-3xl bg-primary-50/80 dark:bg-primary-950/30 border border-primary-200 dark:border-primary-900/50 flex items-center justify-between shadow-sm">
              <div>
                <p className="text-xs font-bold text-primary-700 dark:text-primary-300 uppercase tracking-wider">
                  {t('wizard.incomeTotalLabel')}
                </p>
                <p className="text-2xl sm:text-3xl font-black text-primary-900 dark:text-primary-100 mt-1">
                  {formatCurrency(totalMonthlyIncome)}
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-primary-500/10 text-primary-600 dark:text-primary-400">
                <CheckCircle2 className="w-7 h-7" />
              </div>
            </div>
          </div>
        )}

        {/* ════════════ ÉTAPE 4 : VENTILATION 55/25/20 ════════════ */}
        {currentStep === 4 && (
          <div className="space-y-6 animate-fade-in max-w-3xl mx-auto w-full">
            <div className="space-y-1 text-center sm:text-left">
              <span className="text-xs font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400">
                {t('wizard.stepOf', { step: 4, total: 8 })}
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2 justify-center sm:justify-start">
                <PieChart className="w-7 h-7 text-primary-500" />
                {t('wizard.splitTitle')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
                {t('wizard.splitSub')}
              </p>
            </div>

            {/* Barre visuelle 100% */}
            <div className="space-y-2 bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm">
              <div className="h-5 rounded-full overflow-hidden flex bg-gray-100 dark:bg-gray-800 shadow-inner">
                <div
                  style={{ width: `${Math.max(0, tauxEssentielle)}%` }}
                  className="bg-indigo-500 transition-all duration-300"
                  title={`${translateType('Essentielle', language)}: ${tauxEssentielle}%`}
                />
                <div
                  style={{ width: `${Math.max(0, tauxLoisirs)}%` }}
                  className="bg-amber-500 transition-all duration-300"
                  title={`${translateType('Loisirs', language)}: ${tauxLoisirs}%`}
                />
                <div
                  style={{ width: `${Math.max(0, tauxEpargne)}%` }}
                  className="bg-emerald-500 transition-all duration-300"
                  title={`${translateType('Epargne', language)}: ${tauxEpargne}%`}
                />
              </div>

              <div className="flex items-center justify-between text-xs font-semibold pt-1 text-gray-600 dark:text-gray-300 flex-wrap gap-2">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-indigo-500" />
                  {translateType('Essentielle', language)} ({tauxEssentielle}%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-amber-500" />
                  {translateType('Loisirs', language)} ({tauxLoisirs}%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500" />
                  {translateType('Epargne', language)} ({tauxEpargne}%)
                </span>
                <span className={`px-2 py-0.5 rounded-full font-bold ${isRatioValid ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' : 'bg-red-100 text-red-700'}`}>
                  {t('wizard.splitTotal', { sum: sumTaux })}
                </span>
              </div>
            </div>

            {/* 3 Cartes de réglages */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Essentielle */}
              <div className="p-5 rounded-3xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-indigo-900 dark:text-indigo-200">
                    {t('wizard.splitEssentielleCard')}
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-200/60 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 font-extrabold">
                    {tauxEssentielle}%
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="90"
                  value={tauxEssentielle}
                  onChange={e => setTauxEssentielle(parseInt(e.target.value) || 0)}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
                <div className="pt-2 border-t border-indigo-200/50 dark:border-indigo-900/50">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('wizard.splitMonthlyCalc')}</p>
                  <p className="text-xl font-black text-indigo-700 dark:text-indigo-300 mt-0.5">
                    {formatCurrency(amountEssentielle)}
                  </p>
                </div>
              </div>

              {/* Loisirs */}
              <div className="p-5 rounded-3xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-amber-900 dark:text-amber-200">
                    {t('wizard.splitLoisirsCard')}
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-amber-200/60 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 font-extrabold">
                    {tauxLoisirs}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="80"
                  value={tauxLoisirs}
                  onChange={e => setTauxLoisirs(parseInt(e.target.value) || 0)}
                  className="w-full accent-amber-600 cursor-pointer"
                />
                <div className="pt-2 border-t border-amber-200/50 dark:border-amber-900/50">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('wizard.splitMonthlyCalc')}</p>
                  <p className="text-xl font-black text-amber-700 dark:text-amber-300 mt-0.5">
                    {formatCurrency(amountLoisirs)}
                  </p>
                </div>
              </div>

              {/* Epargne */}
              <div className="p-5 rounded-3xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                    {t('wizard.splitEpargneCard')}
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-extrabold">
                    {tauxEpargne}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="60"
                  value={tauxEpargne}
                  onChange={e => setTauxEpargne(parseInt(e.target.value) || 0)}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
                <div className="pt-2 border-t border-emerald-200/50 dark:border-emerald-900/50">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('wizard.splitMonthlyCalc')}</p>
                  <p className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
                    {formatCurrency(amountEpargne)}
                  </p>
                </div>
              </div>
            </div>

            {!isRatioValid && (
              <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl flex items-center justify-between text-xs text-red-700 dark:text-red-300">
                <span>{t('wizard.splitInvalidError', { sum: sumTaux })}</span>
                <button
                  type="button"
                  onClick={() => {
                    setTauxEssentielle(55)
                    setTauxLoisirs(25)
                    setTauxEpargne(20)
                  }}
                  className="px-3 py-1.5 bg-red-100 dark:bg-red-900/50 hover:bg-red-200 rounded-xl font-bold transition-colors"
                >
                  {t('wizard.splitResetBtn')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ════════════ ÉTAPE 5 : VENTILATION DE L'ÉPARGNE ════════════ */}
        {currentStep === 5 && (
          <div className="space-y-6 animate-fade-in max-w-3xl mx-auto w-full">
            <div className="space-y-1 text-center sm:text-left">
              <span className="text-xs font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400">
                {t('wizard.stepOf', { step: 5, total: 8 })}
              </span>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                  <PiggyBank className="w-7 h-7 text-primary-500" />
                  {t('wizard.savingsTitle')}
                </h2>
                <button
                  type="button"
                  onClick={applyRecommendedSavingsPockets}
                  className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1 font-bold"
                >
                  <Sparkles className="w-4 h-4" />
                  {t('wizard.savingsApplyRec')}
                </button>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
                {t('wizard.savingsSub', { amount: formatCurrency(amountEpargne), symbol: getCurrencySymbol() })}
              </p>
            </div>

            {/* Formulaire ajout poche */}
            <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
              <p className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                {t('wizard.savingsAddTitle')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input
                  type="text"
                  placeholder={t('wizard.savingsPocketPlaceholder')}
                  value={newPocketLibelle}
                  onChange={e => setNewPocketLibelle(e.target.value)}
                  className="input text-sm py-2.5 sm:col-span-2"
                />
                <div className="flex gap-1">
                  <select
                    value={newPocketMode}
                    onChange={e => setNewPocketMode(e.target.value as SavingsMode)}
                    className="input text-xs py-2.5 w-24 font-semibold"
                  >
                    <option value="pourcentage">{t('wizard.savingsModePct')}</option>
                    <option value="fixe">{t('wizard.savingsModeFixed', { symbol: getCurrencySymbol() })}</option>
                  </select>
                  <input
                    type="number"
                    placeholder={newPocketMode === 'pourcentage' ? t('wizard.savingsRatePlaceholder') : t('wizard.savingsAmountPlaceholder', { symbol: getCurrencySymbol() })}
                    value={newPocketValeur}
                    onChange={e => setNewPocketValeur(e.target.value)}
                    className="input text-sm py-2.5 flex-1 min-w-0"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddSavingsPocket}
                  className="btn-primary text-sm py-2.5 flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  {t('common.add')}
                </button>
              </div>
            </div>

            {/* Liste des poches */}
            {savingsRules.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-3xl bg-white/50 dark:bg-gray-900/50">
                <PiggyBank className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-base font-bold text-gray-700 dark:text-gray-300">
                  {t('wizard.savingsEmptyTitle')}
                </p>
                <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                  {t('wizard.savingsEmptyDesc')}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {savingsRules.map(pocket => {
                  let calcAmount = 0
                  if (pocket.mode === 'fixe') {
                    calcAmount = pocket.valeur
                  } else {
                    calcAmount = (restantPourcentageEpargne * (pocket.valeur / 100))
                  }

                  return (
                    <div
                      key={pocket.id}
                      className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="w-4 h-4 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: pocket.couleur }}
                        />
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">
                            {pocket.libelle}
                          </p>
                          <p className="text-xs text-gray-500">
                            {pocket.mode === 'fixe'
                              ? t('wizard.savingsFixedEachMonth', { amount: formatCurrency(pocket.valeur) })
                              : t('wizard.savingsPctRemaining', { pct: pocket.valeur })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                          {t('wizard.savingsPerMonth', { amount: formatCurrency(calcAmount) })}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSavingsPocket(pocket.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ════════════ ÉTAPE 6 : CATÉGORIES & TYPES (HIÉRARCHIE CLAIRE À 2 MAILLES) ════════════ */}
        {currentStep === 6 && (
          <div className="space-y-6 animate-fade-in max-w-4xl mx-auto w-full">
            <div className="space-y-1 text-center sm:text-left">
              <span className="text-xs font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400">
                {t('wizard.stepOf', { step: 6, total: 8 })}
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2 justify-center sm:justify-start">
                <Tag className="w-7 h-7 text-primary-500" />
                {t('wizard.catTitle')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-3xl">
                {t('wizard.catSub')}
              </p>
            </div>

            {/* Sélecteur des 4 Catégories Piliers */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {mainCategories.map(cat => {
                const isActive = activeCategoryTab === cat.id
                const typesInCat = categories.filter(c => c.types?.includes(cat.id))
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategoryTab(cat.id as any)}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      isActive
                        ? 'bg-white dark:bg-gray-900 border-primary-500 shadow-md ring-2 ring-primary-500/20'
                        : 'bg-gray-100/70 dark:bg-gray-800/40 border-gray-200 dark:border-gray-800 hover:bg-white dark:hover:bg-gray-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-gray-200/80 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                        {cat.badge}
                      </span>
                      <span className="text-xs font-bold text-primary-600 dark:text-primary-400">
                        {t('wizard.catTypesCount', { count: typesInCat.length })}
                      </span>
                    </div>
                    <p className="text-sm font-black text-gray-900 dark:text-white mt-2">
                      {t('wizard.catCardPrefix', { label: cat.label })}
                    </p>
                  </button>
                )
              })}
            </div>

            {/* Panneau de la catégorie active */}
            {(() => {
              const currentCatMeta = mainCategories.find(c => c.id === activeCategoryTab)!
              const suggestions = SUGGESTED_TYPES_BY_CATEGORY[activeCategoryTab] || []
              const activeTypesInThisCat = categories.filter(c => c.types?.includes(activeCategoryTab))

              return (
                <div className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
                  
                  {/* Titre catégorie et action rapide */}
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-4 border-b border-gray-100 dark:border-gray-800">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Layers className="w-5 h-5 text-primary-500" />
                        {t('wizard.catPanelTitle', { label: currentCatMeta.label })}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {currentCatMeta.desc}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => selectAllSuggestionsForCategory(activeCategoryTab)}
                      className="text-xs text-primary-600 dark:text-primary-400 font-bold hover:underline flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {t('wizard.catEnableAll')}
                    </button>
                  </div>

                  {/* Suggestions en grille cochable */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      {t('wizard.catSuggestedTitle')}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {suggestions.map(sug => {
                        const isChecked = categories.some(c => c.nom === sug.nom && c.types?.includes(activeCategoryTab))
                        return (
                          <button
                            key={sug.nom}
                            type="button"
                            onClick={() => toggleTypeInCategory(activeCategoryTab, sug.nom)}
                            className={`p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all ${
                              isChecked
                                ? 'bg-primary-50/70 dark:bg-primary-950/40 border-primary-400 dark:border-primary-700 shadow-sm'
                                : 'bg-gray-50/50 dark:bg-gray-800/40 border-gray-200/70 dark:border-gray-800 hover:border-gray-300'
                            }`}
                          >
                            <div className="pr-2">
                              <p className={`text-sm ${isChecked ? 'font-bold text-primary-900 dark:text-primary-100' : 'font-medium text-gray-800 dark:text-gray-200'}`}>
                                {sug.nom}
                              </p>
                              {sug.description && (
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                                  {sug.description}
                                </p>
                              )}
                            </div>
                            <div className={`w-5 h-5 rounded-lg flex items-center justify-center border shrink-0 transition-colors ${
                              isChecked ? 'bg-primary-500 border-primary-500 text-white' : 'border-gray-300 dark:border-gray-600'
                            }`}>
                              {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Ajout type personnalisé sous cette catégorie */}
                  <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
                    <p className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      {t('wizard.catAddCustomTitle', { label: currentCatMeta.label })}
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder={t('wizard.catAddCustomPlaceholder')}
                        value={newTypeName}
                        onChange={e => setNewTypeName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddCustomType(activeCategoryTab)}
                        className="input text-sm py-2.5 flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddCustomType(activeCategoryTab)}
                        className="btn-primary text-sm py-2.5 px-5 flex items-center gap-1.5 shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                        {t('common.add')}
                      </button>
                    </div>
                  </div>

                  {/* Types actuellement actifs sous cette catégorie */}
                  <div className="space-y-2 pt-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold">
                      {t('wizard.catActiveList', { label: currentCatMeta.label, count: activeTypesInThisCat.length })}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {activeTypesInThisCat.map(item => {
                        const isSystem = DEFAULT_CATEGORIES.some(dc => dc.nom === item.nom)
                        return (
                          <span
                            key={item.id}
                            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium border border-gray-200/80 dark:border-gray-700"
                          >
                            <span>{item.nom}</span>
                            {!isSystem && (
                              <button
                                type="button"
                                onClick={() => handleRemoveType(item.id)}
                                className="text-gray-400 hover:text-red-500 transition-colors ml-0.5"
                                title={t('common.delete')}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </span>
                        )
                      })}
                    </div>
                  </div>

                </div>
              )
            })()}

          </div>
        )}

        {/* ════════════ ÉTAPE 7 : DÉPENSES FIXES ════════════ */}
        {currentStep === 7 && (
          <div className="space-y-6 animate-fade-in max-w-3xl mx-auto w-full">
            <div className="space-y-1 text-center sm:text-left">
              <span className="text-xs font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400">
                {t('wizard.stepOf', { step: 7, total: 8 })}
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2 justify-center sm:justify-start">
                <Receipt className="w-7 h-7 text-primary-500" />
                {t('wizard.fixedTitle')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
                {t('wizard.fixedSub')}
              </p>
            </div>

            {/* Formulaire ajout dépense fixe */}
            <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
              <p className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                {t('wizard.fixedAddTitle')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
                <input
                  type="text"
                  placeholder={t('wizard.fixedLabelPlaceholder')}
                  value={newFixedLibelle}
                  onChange={e => setNewFixedLibelle(e.target.value)}
                  className="input text-sm py-2.5 sm:col-span-2"
                />
                <input
                  type="text"
                  placeholder={t('wizard.fixedPatternPlaceholder')}
                  value={newFixedPattern}
                  onChange={e => setNewFixedPattern(e.target.value)}
                  className="input text-sm py-2.5 sm:col-span-1 font-mono"
                />
                <div className="relative sm:col-span-1">
                  <input
                    type="number"
                    placeholder={t('wizard.amountPlaceholder')}
                    value={newFixedMontant}
                    onChange={e => setNewFixedMontant(e.target.value)}
                    className="input text-sm py-2.5 pr-7 w-full"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">
                    {getCurrencySymbol()}
                  </span>
                </div>
                <select
                  value={newFixedCategory}
                  onChange={e => setNewFixedCategory(e.target.value)}
                  className="input text-xs py-2.5 sm:col-span-1 font-semibold"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.nom}>
                      {c.nom}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddFixedExpense}
                  className="btn-primary text-sm py-2.5 flex items-center justify-center gap-1.5 sm:col-span-1"
                >
                  <Plus className="w-4 h-4" />
                  {t('common.add')}
                </button>
              </div>
            </div>

            {/* Liste des charges fixes */}
            {fixedExpenses.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-3xl bg-white/50 dark:bg-gray-900/50">
                <Receipt className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-base font-bold text-gray-700 dark:text-gray-300">
                  {t('wizard.fixedEmptyTitle')}
                </p>
                <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                  {t('wizard.fixedEmptyDesc')}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {fixedExpenses.map(expense => (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm"
                  >
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {expense.libelle}
                      </p>
                      <p className="text-xs text-gray-500">
                        {t('wizard.fixedTypePrefix', { cat: expense.categorie })}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-base font-bold text-gray-900 dark:text-white">
                        {formatCurrency(expense.montant)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFixedExpense(expense.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Impact sur le budget essentiel */}
                <div className="p-5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 flex items-center justify-between text-xs flex-wrap gap-2">
                  <div>
                    <p className="font-bold text-indigo-950 dark:text-indigo-200 text-sm">
                      {t('wizard.fixedTotal', { amount: formatCurrency(totalFixedExpenses) })}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400 mt-0.5">
                      {t('wizard.fixedEngaged', {
                        amount: formatCurrency(amountEssentielle),
                        pct: amountEssentielle > 0 ? Math.round((totalFixedExpenses / amountEssentielle) * 100) : 0,
                      })}
                    </p>
                  </div>
                  <span className="text-base font-black text-indigo-700 dark:text-indigo-300">
                    {t('wizard.fixedRemaining', { amount: formatCurrency(Math.max(0, amountEssentielle - totalFixedExpenses)) })}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════ ÉTAPE 8 : SYNTHÈSE & VALIDATION ════════════ */}
        {currentStep === 8 && (
          <div className="space-y-6 animate-fade-in max-w-3xl mx-auto w-full">
            <div className="space-y-1 text-center sm:text-left">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                {t('wizard.stepOf', { step: 8, total: 8 })}
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2 justify-center sm:justify-start">
                <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                {t('wizard.summaryTitle')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
                {t('wizard.summarySub')}
              </p>
            </div>

            {/* Grid Récapitulatif */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Carte 1 : Revenus & 55/25/20 */}
              <div className="p-6 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
                <p className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">
                  {t('wizard.summaryIncomeCard')}
                </p>
                <div>
                  <span className="text-xs text-gray-500">{t('wizard.summaryCurrency')}</span>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {SUPPORTED_CURRENCIES.find(c => c.code === devise)?.label || devise}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">{t('wizard.summaryMonthlyIncome')}</span>
                  <p className="text-2xl font-black text-gray-900 dark:text-white">
                    {formatCurrency(totalMonthlyIncome)}
                  </p>
                </div>
                <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs">
                  <div className="flex justify-between">
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                      {translateType('Essentielle', language)} ({tauxEssentielle}%) :
                    </span>
                    <span className="font-black text-gray-900 dark:text-white">
                      {formatCurrency(amountEssentielle)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-600 dark:text-amber-400 font-bold">
                      {translateType('Loisirs', language)} ({tauxLoisirs}%) :
                    </span>
                    <span className="font-black text-gray-900 dark:text-white">
                      {formatCurrency(amountLoisirs)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                      {translateType('Epargne', language)} ({tauxEpargne}%) :
                    </span>
                    <span className="font-black text-gray-900 dark:text-white">
                      {formatCurrency(amountEpargne)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Carte 2 : Structure & Charges */}
              <div className="p-6 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
                <p className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">
                  {t('wizard.summaryStructureCard')}
                </p>
                <div className="space-y-2.5 text-xs">
                  <div>
                    <span className="text-gray-500">{t('wizard.summaryPockets')}</span>
                    <p className="font-black text-gray-900 dark:text-white text-sm">
                      {savingsRules.length > 0
                        ? t('wizard.summaryPocketsActive', { count: savingsRules.length })
                        : t('wizard.summaryPocketsGlobal')}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">{t('wizard.summaryTypes')}</span>
                    <p className="font-black text-gray-900 dark:text-white text-sm">
                      {t('wizard.summaryTypesCount', { count: categories.length })}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">{t('wizard.summaryFixed')}</span>
                    <p className="font-black text-gray-900 dark:text-white text-sm">
                      {t('wizard.summaryFixedCount', { count: fixedExpenses.length, amount: formatCurrency(totalFixedExpenses) })}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Notification synchronisation */}
            {syncResult && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
                <span>{syncResult}</span>
              </div>
            )}
          </div>
        )}

      </main>

      {/* ─── Bottom Footer Plein Écran ───────────────────────────────────── */}
      <footer className="sticky bottom-0 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 py-4 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 flex items-center justify-between gap-4">
          <div>
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(prev => prev - 1)}
                className="btn-secondary text-sm py-2.5 px-5 flex items-center gap-2 font-semibold"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{t('wizard.previous')}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-medium transition-colors"
              >
                {t('wizard.skipForNow')}
              </button>
            )}
          </div>

          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 hidden sm:block">
            {t('wizard.footerStep', { step: currentStep, total: 8, label: stepsMeta[currentStep - 1].label })}
          </div>

          <div>
            {currentStep < 8 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(prev => prev + 1)}
                className="btn-primary text-sm py-2.5 px-6 flex items-center gap-2 shadow-lg shadow-primary-500/25 font-bold"
              >
                <span>{t('wizard.continue')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveAndFinish}
                className="btn-primary text-sm py-3 px-8 flex items-center gap-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-xl shadow-emerald-500/30 font-black tracking-wide"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{t('wizard.saving')}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>{t('wizard.finishBtn')}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </footer>

    </div>
  )
}
