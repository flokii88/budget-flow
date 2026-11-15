import { QueryClient, useQuery } from '@tanstack/react-query'
import pb from './pocketbase'
import {
  fetchTransactions,
  fetchCategories,
  fetchBudgetTypes,
  fetchCategorizationRules,
  fetchFixedExpenses,
  fetchBudgetRulesPB,
  getPocketBaseStats,
} from './sync'
import { DEFAULT_BUDGET_RULES, DEFAULT_SAVINGS_RULES } from './constants'
import { BudgetRules, CurrencyCode } from './types'
import { resolveCurrencyCode, setActiveCurrency } from './utils'
import { useStore } from '@/store/useStore'

export const QUERY_KEYS = {
  transactions: ['transactions'] as const,
  fixedExpenses: ['fixedExpenses'] as const,
  categories: ['categories'] as const,
  budgetTypes: ['budgetTypes'] as const,
  categorizationRules: ['categorizationRules'] as const,
  budgetRules: ['budgetRules'] as const,
  pbStats: ['pbStats'] as const,
}

export function invalidateAllBudgetQueries(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.transactions }),
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.fixedExpenses }),
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.categories }),
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.budgetTypes }),
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.categorizationRules }),
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.budgetRules }),
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pbStats }),
  ])
}

export function useTransactions() {
  return useQuery({
    queryKey: QUERY_KEYS.transactions,
    queryFn: fetchTransactions,
    enabled: pb.authStore.isValid,
  })
}

export function useCategories() {
  return useQuery({
    queryKey: QUERY_KEYS.categories,
    queryFn: async () => {
      const list = await fetchCategories()
      return [...list].sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }))
    },
    enabled: pb.authStore.isValid,
  })
}

export function useBudgetTypes() {
  return useQuery({
    queryKey: QUERY_KEYS.budgetTypes,
    queryFn: async () => {
      const list = await fetchBudgetTypes()
      return [...list].sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }))
    },
    enabled: pb.authStore.isValid,
  })
}

export function useCategorizationRules() {
  return useQuery({
    queryKey: QUERY_KEYS.categorizationRules,
    queryFn: fetchCategorizationRules,
    enabled: pb.authStore.isValid,
  })
}

export function useFixedExpenses() {
  return useQuery({
    queryKey: QUERY_KEYS.fixedExpenses,
    queryFn: fetchFixedExpenses,
    enabled: pb.authStore.isValid,
  })
}

export function useBudgetRules() {
  return useQuery({
    queryKey: QUERY_KEYS.budgetRules,
    queryFn: async (): Promise<BudgetRules> => {
      const rules = await fetchBudgetRulesPB()
      if (!rules) return DEFAULT_BUDGET_RULES
      const resolvedDevise: CurrencyCode = rules.devise
        ? resolveCurrencyCode(rules.devise)
        : useStore.getState().currency
      if (rules.devise && resolvedDevise !== useStore.getState().currency) {
        useStore.getState().setCurrency(resolvedDevise)
      } else {
        setActiveCurrency(resolvedDevise)
      }
      return {
        ...rules,
        devise: resolvedDevise,
        ventilation_epargne:
          rules.ventilation_epargne && rules.ventilation_epargne.length > 0
            ? rules.ventilation_epargne
            : DEFAULT_SAVINGS_RULES,
      }
    },
    enabled: pb.authStore.isValid,
  })
}

export function usePocketBaseStats() {
  return useQuery({
    queryKey: QUERY_KEYS.pbStats,
    queryFn: getPocketBaseStats,
    enabled: pb.authStore.isValid,
  })
}
