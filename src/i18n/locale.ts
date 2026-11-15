import { Language } from '@/lib/types'

export const DEFAULT_LANGUAGE: Language = 'fr'

let activeLanguage: Language = DEFAULT_LANGUAGE

export function resolveLanguage(lang?: string | null): Language {
  return lang === 'en' ? 'en' : 'fr'
}

export function setActiveLanguage(lang?: string | null): void {
  activeLanguage = resolveLanguage(lang)
}

export function getActiveLanguage(): Language {
  return activeLanguage
}
