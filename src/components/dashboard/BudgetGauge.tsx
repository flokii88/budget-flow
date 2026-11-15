import { cn, formatCurrency } from '@/lib/utils'
import { useTranslation } from '@/i18n'

interface BudgetGaugeProps {
  label: string
  budget: number
  reel: number
  ecart: number
  taux: number
  color?: string
}

export default function BudgetGauge({ label, budget, reel, ecart, taux, color = '#6366f1' }: BudgetGaugeProps) {
  const { t } = useTranslation()
  const pct = budget > 0 ? Math.min((reel / budget) * 100, 100) : 0
  const isOver = reel > budget
  const isGood = !isOver

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{label}</p>
          <p className="text-xs text-gray-400">{t('dashboard.gaugePctIncome', { pct: (taux * 100).toFixed(0) })}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(reel)}</p>
          <p className="text-xs text-gray-400">/ {formatCurrency(budget)}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className={cn(
            'absolute inset-y-0 left-0 rounded-full transition-all duration-700',
            isOver ? 'bg-red-500' : ''
          )}
          style={{
            width: `${pct}%`,
            backgroundColor: isOver ? '#ef4444' : color,
          }}
        />
      </div>

      {/* Ecart */}
      <div className={cn(
        'flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg w-fit',
        isGood
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
          : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
      )}>
        <span>{isGood ? '✓' : '!'}</span>
        <span>
          {isGood ? t('dashboard.gaugeUnderBudget') : t('dashboard.gaugeOverBudget')} : {isGood ? '-' : '+'}{formatCurrency(Math.abs(ecart))}
        </span>
      </div>
    </div>
  )
}
