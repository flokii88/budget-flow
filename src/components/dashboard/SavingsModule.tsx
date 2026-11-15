import { SavingsAllocation } from '@/lib/types'
import { formatCurrency, getCurrencySymbol } from '@/lib/utils'
import { PiggyBank } from 'lucide-react'
import { useTranslation } from '@/i18n'

interface SavingsModuleProps {
  savings: SavingsAllocation
}

export default function SavingsModule({ savings }: SavingsModuleProps) {
  const { t } = useTranslation()
  const items = savings.items || []

  return (
    <div className="card p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl">
          <PiggyBank className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t('dashboard.savingsTitle')}</h3>
          <p className="text-xs text-gray-400">{t('dashboard.savingsAllocated', { amount: formatCurrency(savings.montant_total) })}</p>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-gray-400 italic">{t('dashboard.savingsNoRules')}</p>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-3">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.couleur }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate" title={item.libelle}>
                    {item.libelle}
                  </p>
                  <p className="text-xs font-bold text-gray-900 dark:text-white ml-2 flex-shrink-0">
                    {formatCurrency(item.montantCalcule)}
                  </p>
                </div>
                {/* Mini bar */}
                <div className="mt-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: savings.montant_total > 0
                        ? `${Math.min(100, Math.max(0, (item.montantCalcule / savings.montant_total) * 100))}%`
                        : '0%',
                      backgroundColor: item.couleur,
                    }}
                  />
                </div>
              </div>
              <div className="text-xs text-gray-400 flex-shrink-0 min-w-10 text-right">
                {item.mode === 'fixe' ? `${item.valeur}${getCurrencySymbol()}` : `${item.valeur}%`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
