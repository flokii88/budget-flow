import { ReactNode } from 'react'
import { cn, formatCurrency } from '@/lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface KPICardProps {
  title: string
  amount: number
  subtitle?: string
  icon: ReactNode
  color?: 'default' | 'green' | 'red' | 'blue' | 'purple'
  trend?: number // positive = good, negative = bad
  suffix?: string
}

const COLOR_MAP = {
  default: {
    bg: 'bg-gray-50 dark:bg-gray-800',
    icon: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
    amount: 'text-gray-900 dark:text-white',
  },
  green: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    icon: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400',
    amount: 'text-emerald-700 dark:text-emerald-400',
  },
  red: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    icon: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400',
    amount: 'text-red-700 dark:text-red-400',
  },
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    icon: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400',
    amount: 'text-blue-700 dark:text-blue-400',
  },
  purple: {
    bg: 'bg-primary-50 dark:bg-primary-950/30',
    icon: 'bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400',
    amount: 'text-primary-700 dark:text-primary-400',
  },
}

export default function KPICard({ title, amount, subtitle, icon, color = 'default', trend, suffix }: KPICardProps) {
  const colors = COLOR_MAP[color]

  return (
    <div className={cn('card p-5 flex flex-col gap-3', colors.bg)}>
      <div className="flex items-start justify-between">
        <div className={cn('p-2.5 rounded-xl', colors.icon)}>
          {icon}
        </div>
        {trend !== undefined && (
          <div className={cn(
            'flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full',
            trend >= 0
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
              : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
          )}>
            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</p>
        <p className={cn('text-2xl font-bold mt-0.5', colors.amount)}>
          {formatCurrency(amount)}{suffix}
        </p>
        {subtitle && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  )
}
