// ─── TYPES DE DONNÉES PRINCIPAUX ─────────────────────────────────────────────

export type TransactionType = 'Essentielle' | 'Loisirs' | 'Epargne' | 'Revenu' | string

export type TransactionCategory = string

export interface BudgetCategory {
  id: string
  nom: string
  types: string[] // Une catégorie peut être liée à plusieurs types (ex: ['Essentielle', 'Loisirs'])
  couleur?: string
}

export interface BudgetType {
  id: string
  nom: string
  couleur?: string
  isSystem?: boolean
}

export interface CategorizationRule {
  id: string
  pattern: string       // Mot-clé ou texte recherché (ex: "LECLERC", "AMAZON")
  categorie: string     // Catégorie cible (ex: "Alimentation")
  type?: string         // Type associé (ex: "Essentielle")
}

export interface Transaction {
  id: string
  date: string              // DD/MM/YYYY
  mois: string              // MM/YYYY - computed from date
  libelle_simplifie: string
  libelle_operation: string
  categorie: string
  type: TransactionType
  debit: number             // 0 if credit
  credit: number            // 0 if debit
  ignore_dashboard?: boolean // Si vrai, cette transaction est exclue des calculs du tableau de bord
  fixed_expense_id?: string // ID de la dépense fixe rapprochée manuellement
  created?: string
  updated?: string
}

export interface FixedExpense {
  id: string
  libelle: string
  pattern?: string          // Mot-clé recherché dans le libellé pour le rapprochement automatique
  categorie: string
  type: string
  montant: number
  actif: boolean
  ordre: number
}

// ─── VENTILATION ÉPARGNE UNIFIÉE ──────────────────────────────────────────────

export type SavingsMode = 'fixe' | 'pourcentage'

export interface SavingsRuleItem {
  id: string
  libelle: string
  mode: SavingsMode         // 'fixe' (montant en €) ou 'pourcentage' (%)
  valeur: number            // Montant en € ou Pourcentage (ex: 50 ou 72)
  couleur?: string
}

export interface SavingsAllocatedItem {
  id: string
  libelle: string
  mode: SavingsMode
  valeur: number
  montantCalcule: number
  couleur: string
}

export interface SavingsAllocation {
  id: string
  mois: string              // MM/YYYY
  montant_total: number
  total_fixe: number
  restant_pourcentage: number
  items: SavingsAllocatedItem[]
}

export type Language = 'fr' | 'en'

export type CurrencyCode =
  | 'EUR'
  | 'USD'
  | 'GBP'
  | 'PLN'
  | 'DKK'
  | 'HUF'
  | 'ISK'
  | 'NOK'
  | 'SEK'
  | 'CHF'

export interface BudgetRules {
  revenus_theoriques: number   // Target monthly income
  taux_essentielle: number     // 0.55
  taux_loisirs: number         // 0.25
  taux_epargne: number         // 0.20
  ventilation_epargne: SavingsRuleItem[]
  fixed_match_tolerance?: number // Marge de tolérance en € pour le rapprochement auto des dépenses fixes (0 = exact)
  devise?: CurrencyCode        // Devise d'affichage (défaut: 'EUR', sans conversion)
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

export interface MonthlyDashboard {
  mois: string
  total_revenus_reels: number
  total_revenus_theoriques: number
  total_depenses: number
  solde_theorique: number
  // 55/25/20
  budget_essentielle: number
  reel_essentielle: number
  ecart_essentielle: number
  budget_loisirs: number
  reel_loisirs: number
  ecart_loisirs: number
  budget_epargne: number
  reel_epargne: number
  ecart_epargne: number
  // Savings
  savings: SavingsAllocation | null
}

// ─── CSV IMPORT ──────────────────────────────────────────────────────────────

export interface CSVFieldMapping {
  date: string
  libelle_operation: string
  libelle_simplifie?: string
  debit: string
  credit: string
  categorie?: string
}

export interface CSVImportResult {
  success: number
  errors: number
  rows: Partial<Transaction>[]
}

// ─── STORE ───────────────────────────────────────────────────────────────────

export interface AppState {
  theme: 'light' | 'dark'
  selectedMonth: string       // MM/YYYY
  budgetRules: BudgetRules
  setTheme: (theme: 'light' | 'dark') => void
  setSelectedMonth: (month: string) => void
  setBudgetRules: (rules: BudgetRules) => void
}
