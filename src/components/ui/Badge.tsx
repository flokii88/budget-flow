import { cn } from '@/lib/utils'
import { TYPE_BG_COLORS } from '@/lib/constants'
import { TransactionType } from '@/lib/types'
import { useTranslation, translateType } from '@/i18n'

interface BadgeProps {
  type: TransactionType | string
  className?: string
}

export default function Badge({ type, className }: BadgeProps) {
  const { language } = useTranslation()
  return (
    <span className={cn('badge', TYPE_BG_COLORS[type] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', className)}>
      {translateType(type, language)}
    </span>
  )
}
