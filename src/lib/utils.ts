import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parse } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { getActiveLanguage } from '@/i18n/locale'
import { BudgetCategory, BudgetRules, CategorizationRule, CurrencyCode, MonthlyDashboard, SavingsAllocation, SavingsAllocatedItem, Transaction } from './types'
import { DEFAULT_BUDGET_RULES, DEFAULT_CURRENCY, RECONCILIATION_TYPE, SUPPORTED_CURRENCIES } from './constants'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

let activeCurrency: CurrencyCode = DEFAULT_CURRENCY

export function resolveCurrencyCode(code?: string | null): CurrencyCode {
  if (!code) return DEFAULT_CURRENCY
  const match = SUPPORTED_CURRENCIES.find(c => c.code === code)
  return match ? match.code : DEFAULT_CURRENCY
}

export function setActiveCurrency(code?: string | null): void {
  activeCurrency = resolveCurrencyCode(code)
}

export function getActiveCurrency(): CurrencyCode {
  return activeCurrency
}

export function getCurrencySymbol(code?: string | null): string {
  const resolved = code ? resolveCurrencyCode(code) : activeCurrency
  return SUPPORTED_CURRENCIES.find(c => c.code === resolved)?.symbol || '€'
}

export function formatCurrency(amount: number, currencyCode?: string): string {
  const currency = currencyCode ? resolveCurrencyCode(currencyCode) : activeCurrency
  const intlLocale = getActiveLanguage() === 'en' ? 'en-US' : 'fr-FR'
  try {
    return new Intl.NumberFormat(intlLocale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount)
  } catch {
    return new Intl.NumberFormat(intlLocale, {
      style: 'currency',
      currency: DEFAULT_CURRENCY,
      minimumFractionDigits: 2,
    }).format(amount)
  }
}

export function formatDate(dateStr: string): string {
  try {
    const date = parse(dateStr, 'dd/MM/yyyy', new Date())
    const dateLocale = getActiveLanguage() === 'en' ? enUS : fr
    return format(date, 'dd MMM yyyy', { locale: dateLocale })
  } catch {
    return dateStr
  }
}

export function parseDateToTimestamp(dateStr: string): number {
  if (!dateStr) return 0
  try {
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/')
      if (parts.length === 3) {
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime()
      }
    }
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? 0 : d.getTime()
  } catch {
    return 0
  }
}

export function dateToMois(dateStr: string): string {
  // DD/MM/YYYY -> MM/YYYY
  const parts = dateStr.split('/')
  if (parts.length >= 3) return `${parts[1]}/${parts[2]}`
  return dateStr
}

export function moisToLabel(mois: string): string {
  // MM/YYYY -> "Octobre 2025" / "October 2025"
  try {
    const [month, year] = mois.split('/')
    const date = new Date(parseInt(year), parseInt(month) - 1, 1)
    const dateLocale = getActiveLanguage() === 'en' ? enUS : fr
    return format(date, 'MMMM yyyy', { locale: dateLocale })
  } catch {
    return mois
  }
}

export function getCurrentMois(): string {
  return format(new Date(), 'MM/yyyy')
}

export function getAvailableMonths(transactions: Transaction[]): string[] {
  const currentMonth = getCurrentMois()
  const months = new Set(transactions.map(t => t.mois))
  months.add(currentMonth)
  return Array.from(months).sort((a, b) => {
    const [ma, ya] = a.split('/')
    const [mb, yb] = b.split('/')
    const da = new Date(parseInt(ya), parseInt(ma) - 1)
    const db = new Date(parseInt(yb), parseInt(mb) - 1)
    return db.getTime() - da.getTime() // newest first
  })
}

export function resolveCategoryTypes(categories: BudgetCategory[], categoryName: string): string[] {
  if (!categoryName) return ['Essentielle']
  const found = categories.find(c => c.nom.toLowerCase() === categoryName.trim().toLowerCase())
  return found && found.types && found.types.length > 0 ? found.types : ['Essentielle']
}

export function resolveTypeForCategory(
  categories: BudgetCategory[],
  categoryName: string,
  preferredType?: string
): string {
  const types = resolveCategoryTypes(categories, categoryName)
  if (preferredType && types.includes(preferredType)) {
    return preferredType
  }
  return types[0] || 'Essentielle'
}

export function countDuplicateTransactions(transactions: Transaction[]): number {
  const seen = new Set<string>()
  let duplicates = 0
  for (const tx of transactions) {
    const key = `${tx.date}_${tx.debit}_${tx.credit}_${(tx.libelle_operation || tx.libelle_simplifie || '').trim().toUpperCase()}`
    if (seen.has(key)) {
      duplicates++
    } else {
      seen.add(key)
    }
  }
  return duplicates
}

export function autoCategorize(
  libelle: string,
  rules: CategorizationRule[] = [],
  categories: BudgetCategory[] = []
): {
  categorie: string
  libelle_simplifie: string
  type: string
} {
  const upper = (libelle || '').toUpperCase()

  // 1. Recherche d'abord dans les règles personnalisées enregistrées
  for (const rule of rules) {
    if (rule.pattern && upper.includes(rule.pattern.toUpperCase())) {
      return {
        categorie: rule.categorie,
        libelle_simplifie: rule.pattern,
        type: rule.type || resolveTypeForCategory(categories, rule.categorie),
      }
    }
  }

  // 2. Par défaut : extrait les deux premiers mots pour le libellé simplifié
  const words = libelle.split(' ').slice(0, 2).join(' ')
  const fallbackCat = categories[0]?.nom || 'Essentielle'
  return {
    categorie: fallbackCat,
    libelle_simplifie: words || 'Opération',
    type: resolveTypeForCategory(categories, fallbackCat),
  }
}

export function computeDashboard(
  transactions: Transaction[],
  mois: string,
  rules: BudgetRules = DEFAULT_BUDGET_RULES
): MonthlyDashboard {
  // RÈGLE MÉTIER: Exclure les transactions ayant l'action "ignorer dans le tableau de bord" (ignore_dashboard === true)
  const monthTx = transactions.filter(t => t.mois === mois && !t.ignore_dashboard)

  const total_revenus_reels = monthTx
    .filter(t => t.type === 'Revenu')
    .reduce((sum, t) => sum + t.credit, 0)

  const total_depenses = monthTx
    .filter(t => t.type !== 'Revenu' && t.type !== RECONCILIATION_TYPE)
    .reduce((sum, t) => sum + t.debit, 0)

  const solde_theorique = total_revenus_reels - total_depenses

  const rev = rules.revenus_theoriques
  const budget_essentielle = rev * rules.taux_essentielle
  const budget_loisirs = rev * rules.taux_loisirs
  const budget_epargne = rev * rules.taux_epargne

  const reel_essentielle = monthTx
    .filter(t => t.type === 'Essentielle')
    .reduce((sum, t) => sum + t.debit, 0)

  const reel_loisirs = monthTx
    .filter(t => t.type === 'Loisirs')
    .reduce((sum, t) => sum + t.debit, 0)

  const reel_epargne = monthTx
    .filter(t => t.type === 'Epargne')
    .reduce((sum, t) => sum + t.debit, 0)

  // Unified Savings allocation
  const montant_total = reel_epargne
  const savingsRules = rules.ventilation_epargne || []

  // 1. Total fixe
  const total_fixe = savingsRules
    .filter(r => r.mode === 'fixe')
    .reduce((sum, r) => sum + (r.valeur || 0), 0)

  // 2. Montant restant pour les pourcentages
  const restant_pourcentage = Math.max(0, montant_total - total_fixe)

  const defaultColors = ['#a78bfa', '#fb7185', '#6366f1', '#0ea5e9', '#f59e0b', '#10b981', '#ec4899', '#14b8a6']

  const allocatedItems: SavingsAllocatedItem[] = savingsRules.map((rule, idx) => {
    let montantCalcule = 0
    if (rule.mode === 'fixe') {
      montantCalcule = montant_total >= total_fixe
        ? rule.valeur
        : total_fixe > 0
          ? (rule.valeur / total_fixe) * montant_total
          : 0
    } else {
      montantCalcule = restant_pourcentage * ((rule.valeur || 0) / 100)
    }

    return {
      id: rule.id,
      libelle: rule.libelle,
      mode: rule.mode,
      valeur: rule.valeur,
      montantCalcule,
      couleur: rule.couleur || defaultColors[idx % defaultColors.length],
    }
  })

  const savings: SavingsAllocation = {
    id: `${mois}-savings`,
    mois,
    montant_total,
    total_fixe,
    restant_pourcentage,
    items: allocatedItems,
  }

  return {
    mois,
    total_revenus_reels,
    total_revenus_theoriques: rules.revenus_theoriques,
    total_depenses,
    solde_theorique,
    budget_essentielle,
    reel_essentielle,
    ecart_essentielle: budget_essentielle - reel_essentielle,
    budget_loisirs,
    reel_loisirs,
    ecart_loisirs: budget_loisirs - reel_loisirs,
    budget_epargne,
    reel_epargne,
    ecart_epargne: budget_epargne - reel_epargne,
    savings,
  }
}

export function parseCSVAmount(value: string): number {
  if (!value || value.trim() === '') return 0
  const cleaned = value
    .replace(/\s/g, '')
    .replace(',', '.')
    .replace(/[^0-9.\-]/g, '')
  return Math.abs(parseFloat(cleaned) || 0)
}

export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}
