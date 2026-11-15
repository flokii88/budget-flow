import { BudgetRules, BudgetCategory, BudgetType, CurrencyCode, SavingsRuleItem, TransactionType } from './types'

export const DEFAULT_CURRENCY: CurrencyCode = 'EUR'

export const SUPPORTED_CURRENCIES: { code: CurrencyCode; label: string; symbol: string }[] = [
  { code: 'DKK', label: 'Dansk krone (kr)', symbol: 'kr' },
  { code: 'EUR', label: 'Euro (€)', symbol: '€' },
  { code: 'ISK', label: 'Íslensk króna (kr)', symbol: 'kr' },
  { code: 'HUF', label: 'Magyar forint (Ft)', symbol: 'Ft' },
  { code: 'NOK', label: 'Norsk krone (kr)', symbol: 'kr' },
  { code: 'PLN', label: 'Polski złoty (zł)', symbol: 'zł' },
  { code: 'GBP', label: 'Pound sterling (£)', symbol: '£' },
  { code: 'CHF', label: 'Schweizer Franken (CHF)', symbol: 'CHF' },
  { code: 'SEK', label: 'Svensk krona (kr)', symbol: 'kr' },
  { code: 'USD', label: 'US Dollar ($)', symbol: '$' },
]

export const DEFAULT_SAVINGS_RULES: SavingsRuleItem[] = []

export const DEFAULT_BUDGET_RULES: BudgetRules = {
  revenus_theoriques: 0,
  taux_essentielle: 0.55,
  taux_loisirs: 0.25,
  taux_epargne: 0.20,
  ventilation_epargne: DEFAULT_SAVINGS_RULES,
  devise: DEFAULT_CURRENCY,
}

export const DEFAULT_BUDGET_TYPES: BudgetType[] = [
  { id: 'essentielle', nom: 'Essentielle', couleur: '#6366f1', isSystem: true },
  { id: 'loisirs', nom: 'Loisirs', couleur: '#f59e0b', isSystem: true },
  { id: 'epargne', nom: 'Epargne', couleur: '#10b981', isSystem: true },
  { id: 'revenu', nom: 'Revenu', couleur: '#3b82f6', isSystem: true },
]

export const TRANSACTION_TYPES: TransactionType[] = [
  'Essentielle',
  'Loisirs',
  'Epargne',
  'Revenu',
]

// Seules les catégories fondamentales par défaut (tout le reste est personnalisable)
export const DEFAULT_CATEGORIES: BudgetCategory[] = [
  { id: 'cat-essentielle', nom: 'Essentielle', types: ['Essentielle'] },
  { id: 'cat-loisirs', nom: 'Loisirs', types: ['Loisirs'] },
  { id: 'cat-epargne', nom: 'Epargne', types: ['Epargne'] },
  { id: 'cat-revenu', nom: 'Revenu', types: ['Revenu'] },
]

export const TRANSACTION_CATEGORIES: string[] = DEFAULT_CATEGORIES.map(c => c.nom)

// Suggestions optionnelles de types de transactions classés sous leurs 4 catégories mères (55/25/20 & Revenu)
export const SUGGESTED_TYPES_BY_CATEGORY: Record<string, { nom: string; description?: string }[]> = {
  'Essentielle': [
    { nom: 'Alimentation & Supermarché', description: 'Courses quotidiennes, supermarchés, boucherie, boulangerie' },
    { nom: 'Logement, Énergie & Charges', description: 'Loyer, prêt immobilier, électricité, gaz, eau, syndic' },
    { nom: 'Transports & Carburant', description: 'Essence, transports en commun, train, péages, parking' },
    { nom: 'Santé & Pharmacie', description: 'Médecins, spécialistes, pharmacie, optique, mutuelle' },
    { nom: 'Assurances', description: 'Assurance habitation, assurance auto / moto' },
    { nom: 'Abonnements essentiels', description: 'Internet, box, forfaits mobiles' },
    { nom: 'Scolarité & Garde', description: 'Nounou, crèche, cantine, activités scolaires' },
  ],
  'Loisirs': [
    { nom: 'Sorties, Bars & Restaurants', description: 'Restaurants, cafés, cinémas, spectacles, concerts' },
    { nom: 'Shopping & Vêtements', description: 'Mode, vêtements, chaussures, accessoires' },
    { nom: 'Vacances & Voyages', description: 'Hébergements, billets, loisirs en voyage' },
    { nom: 'Sport, Hobbies & Passions', description: 'Salle de sport, clubs, matériel de loisir' },
    { nom: 'Cadeaux & Événements', description: 'Anniversaires, Noël, réceptions' },
    { nom: 'Streaming & Divertissement', description: 'Netflix, Spotify, jeux vidéo, livres' },
  ],
  'Epargne': [
    { nom: 'Épargne de secours', description: 'Livret A, LDDS, épargne de sécurité immédiate' },
    { nom: 'Projets futurs', description: 'Achat véhicule, travaux, projets à moyen terme' },
    { nom: 'Investissement & Long terme', description: 'PEA, assurance-vie, bourse, retraite' },
  ],
  'Revenu': [
    { nom: 'Salaire principal', description: 'Salaire net régulier' },
    { nom: 'Second salaire', description: 'Salaire ou revenu d’activité du conjoint' },
    { nom: 'Primes & Bonus', description: 'Primes, 13ème mois, intéressement' },
    { nom: 'Allocations & Aides', description: 'CAF, allocations familiales, remboursements' },
  ],
}

export const SUGGESTED_CATEGORIES: Array<{ nom: string; types: string[]; description?: string }> = Object.entries(
  SUGGESTED_TYPES_BY_CATEGORY
).flatMap(([cat, list]) => list.map(item => ({ nom: item.nom, types: [cat], description: item.description })))

// Règles de commerçants initiales (vide pour respecter l'installation propre sans données de test)
export const MERCHANT_CATEGORY_MAP: Record<string, { categorie: string; libelle: string }> = {}

export const RECONCILIATION_LABEL = 'Ajustement solde / réconciliation'
export const RECONCILIATION_TYPE = 'Réconciliation'
export const RECONCILIATION_CATEGORY = 'Réconciliation'

export const TYPE_COLORS: Record<string, string> = {
  'Essentielle': '#6366f1',
  'Loisirs': '#f59e0b',
  'Epargne': '#10b981',
  'Revenu': '#3b82f6',
  'Réconciliation': '#64748b',
}

export const TYPE_BG_COLORS: Record<string, string> = {
  'Essentielle': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  'Loisirs': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'Epargne': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'Revenu': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'Réconciliation': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}
