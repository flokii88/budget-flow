import { cn } from '@/lib/utils'

const CATEGORY_COLORS: Record<string, string> = {
  'Alimentation': 'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400',
  'Abonnement': 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  'Garde enfant': 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  'Prêt': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'Transport': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  'Santé': 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  'Logement': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'Epargne secours': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'Revenus': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'Loisirs & Sorties': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  'Shopping': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  'Restauration': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'Réconciliation': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}

export default function CategoryBadge({ categorie }: { categorie: string }) {
  return (
    <span className={cn(
      'badge text-xs',
      CATEGORY_COLORS[categorie] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
    )}>
      {categorie}
    </span>
  )
}
