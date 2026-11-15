import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { WifiOff, RefreshCw, Database, Loader2 } from 'lucide-react'
import { checkPocketBaseHealth, subscribeSyncStatus, SyncStatus } from '@/lib/sync'
import { useQueryClient } from '@tanstack/react-query'
import { invalidateAllBudgetQueries } from '@/lib/queries'
import { useTranslation } from '@/i18n'

interface PocketBaseOfflineCardProps {
  error?: string | null
  onRetry?: () => void
  showConfigLink?: boolean
}

export function PocketBaseOfflineCard({
  error,
  onRetry,
  showConfigLink = true,
}: PocketBaseOfflineCardProps) {
  const queryClient = useQueryClient()
  const [retrying, setRetrying] = useState(false)
  const { t } = useTranslation()

  const handleRetry = async () => {
    setRetrying(true)
    const online = await checkPocketBaseHealth()
    if (online) {
      await invalidateAllBudgetQueries(queryClient)
      onRetry?.()
    }
    setRetrying(false)
  }

  return (
    <div className="p-5 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/70 text-red-900 dark:text-red-200 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 shrink-0">
            <WifiOff className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-red-900 dark:text-red-100">
              {t('offline.cardTitle')}
            </h3>
            <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
              {t('offline.cardDesc')}
              {error ? ` (${error})` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-100/60 dark:hover:bg-red-900/40 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} />
            {t('common.retry')}
          </button>
          {showConfigLink && (
            <Link
              to="/settings?tab=data"
              className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Database className="w-3.5 h-3.5" />
              {t('offline.configurePb')}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

interface PocketBaseGuardProps {
  error?: string | null
  isLoading?: boolean
  loadingLabel?: string
  onRetry?: () => void
  showConfigLink?: boolean
  children: React.ReactNode
}

export function PocketBaseGuard({
  error,
  isLoading = false,
  loadingLabel,
  onRetry,
  showConfigLink = true,
  children,
}: PocketBaseGuardProps) {
  const { t } = useTranslation()
  const resolvedLoadingLabel = loadingLabel ?? t('common.loading')
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: false,
    isSyncing: true,
    lastSyncTime: null,
    error: null,
  })

  useEffect(() => {
    return subscribeSyncStatus(setSyncStatus)
  }, [])

  const isOffline = !syncStatus.isOnline && !syncStatus.isSyncing

  if (error || isOffline) {
    return (
      <div className="space-y-6">
        <PocketBaseOfflineCard
          error={error || syncStatus.error}
          onRetry={onRetry}
          showConfigLink={showConfigLink}
        />
        <div
          className="blur-sm pointer-events-none select-none opacity-50 transition-all duration-300"
          aria-disabled="true"
        >
          {children}
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
        <span className="text-sm font-medium">{resolvedLoadingLabel}</span>
      </div>
    )
  }

  return <>{children}</>
}
