import PocketBase from 'pocketbase'

export function getPocketBaseUrl(): string {
  // 1. Sauvegarde personnalisée dans localStorage
  if (typeof window !== 'undefined') {
    const customUrl = localStorage.getItem('budget_pb_custom_url')
    if (customUrl && customUrl.trim()) {
      return customUrl.trim()
    }
  }

  // 2. Variable d'environnement explicite (si différente de localhost/127.0.0.1)
  const envUrl = import.meta.env.VITE_POCKETBASE_URL
  if (envUrl && !envUrl.includes('127.0.0.1') && !envUrl.includes('localhost')) {
    return envUrl
  }

  // 3. Détection automatique dynamique : utilise le même hôte/IP que la page actuelle sur le port 8090
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:'
    return `${protocol}//${window.location.hostname}:8090`
  }

  return envUrl || 'http://127.0.0.1:8090'
}

const pb = new PocketBase(getPocketBaseUrl())
pb.autoCancellation(false)

export function updatePocketBaseUrl(newUrl: string) {
  const cleanUrl = newUrl.trim()
  if (typeof window !== 'undefined') {
    if (cleanUrl) {
      localStorage.setItem('budget_pb_custom_url', cleanUrl)
    } else {
      localStorage.removeItem('budget_pb_custom_url')
    }
  }
  pb.baseUrl = cleanUrl || getPocketBaseUrl()
}

export default pb

// Collection names
export const COLLECTIONS = {
  USERS: 'users',
  APP_STATUS: 'app_status',
  TRANSACTIONS: 'transactions',
  FIXED_EXPENSES: 'fixed_expenses',
  BUDGET_RULES: 'budget_rules',
  CATEGORIES: 'categories',
  BUDGET_TYPES: 'budget_types',
  CATEGORIZATION_RULES: 'categorization_rules',
} as const
