import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getCurrentMois, resolveCurrencyCode, setActiveCurrency } from '@/lib/utils'
import { DEFAULT_CURRENCY } from '@/lib/constants'
import { CurrencyCode, Language } from '@/lib/types'
import { DEFAULT_LANGUAGE, resolveLanguage, setActiveLanguage } from '@/i18n/locale'

interface UIState {
  theme: 'light' | 'dark'
  selectedMonth: string       // MM/YYYY
  currency: CurrencyCode
  language: Language
  setTheme: (theme: 'light' | 'dark') => void
  setSelectedMonth: (month: string) => void
  setCurrency: (currency: CurrencyCode) => void
  setLanguage: (language: Language) => void
}

export const useStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'dark',
      selectedMonth: getCurrentMois(),
      currency: DEFAULT_CURRENCY,
      language: DEFAULT_LANGUAGE,

      setTheme: (theme) => set({ theme }),
      setSelectedMonth: (selectedMonth) => set({ selectedMonth }),
      setCurrency: (currency) => {
        const resolved = resolveCurrencyCode(currency)
        setActiveCurrency(resolved)
        set({ currency: resolved })
      },
      setLanguage: (language) => {
        const resolved = resolveLanguage(language)
        setActiveLanguage(resolved)
        set({ language: resolved })
      },
    }),
    {
      name: 'budget-familial-ui',
      partialize: (state) => ({
        theme: state.theme,
        selectedMonth: state.selectedMonth,
        currency: state.currency,
        language: state.language,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.currency) {
          setActiveCurrency(state.currency)
        }
        if (state?.language) {
          setActiveLanguage(state.language)
        }
      },
    }
  )
)
