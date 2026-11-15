import { useStore } from '@/store/useStore'
import { Language } from '@/lib/types'
import { fr, TranslationKey } from './fr'
import { en } from './en'
import { getActiveLanguage } from './locale'

export { DEFAULT_LANGUAGE, getActiveLanguage, setActiveLanguage, resolveLanguage } from './locale'
export type { TranslationKey }

const dictionaries: Record<Language, Record<TranslationKey, string>> = {
  fr,
  en,
}

export function t(
  key: TranslationKey,
  params?: Record<string, string | number>,
  langOverride?: Language
): string {
  const lang = langOverride ?? getActiveLanguage()
  const dict = dictionaries[lang] || dictionaries.fr
  let str = dict[key] ?? dictionaries.fr[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
    }
  }
  return str
}

export function useTranslation() {
  const language = useStore(s => s.language)
  const setLanguage = useStore(s => s.setLanguage)

  const translate = (key: TranslationKey, params?: Record<string, string | number>) =>
    t(key, params, language)

  return {
    t: translate,
    language,
    setLanguage,
  }
}

const SYSTEM_TYPE_MAP: Record<string, TranslationKey> = {
  Essentielle: 'type.Essentielle',
  Loisirs: 'type.Loisirs',
  Epargne: 'type.Epargne',
  Épargne: 'type.Epargne',
  Revenu: 'type.Revenu',
  Réconciliation: 'type.Réconciliation',
}

export function translateType(typeName: string, langOverride?: Language): string {
  const key = SYSTEM_TYPE_MAP[typeName]
  if (!key) return typeName
  return t(key, undefined, langOverride)
}
