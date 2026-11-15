import { Sun, Moon, ChevronLeft, ChevronRight, Menu, Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { getAvailableMonths, moisToLabel } from '@/lib/utils'
import { useMemo, useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { subscribeSyncStatus, checkPocketBaseHealth, SyncStatus } from '@/lib/sync'
import { useTransactions, invalidateAllBudgetQueries } from '@/lib/queries'
import { showToast } from '@/components/ui/Toaster'
import pb from '@/lib/pocketbase'
import { useTranslation } from '@/i18n'

export default function TopBar() {
  const { theme, setTheme, selectedMonth, setSelectedMonth } = useStore()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: transactions = [] } = useTransactions()
  const [menuOpen, setMenuOpen] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: false,
    isSyncing: false,
    lastSyncTime: null,
    error: null,
  })

  useEffect(() => {
    return subscribeSyncStatus(setSyncStatus)
  }, [])

  const months = useMemo(() => getAvailableMonths(transactions), [transactions])

  const currentIdx = months.indexOf(selectedMonth)
  const canPrev = currentIdx < months.length - 1
  const canNext = currentIdx > 0

  const navigateMonth = (dir: 'prev' | 'next') => {
    if (dir === 'prev' && canPrev) setSelectedMonth(months[currentIdx + 1])
    if (dir === 'next' && canNext) setSelectedMonth(months[currentIdx - 1])
  }

  const handleManualSync = async () => {
    const online = await checkPocketBaseHealth()
    if (!online) {
      showToast(t('topbar.pbNotConnected', { url: pb.baseUrl }), 'error')
      return
    }
    await invalidateAllBudgetQueries(queryClient)
  }

  return (
    <header className="h-16 px-4 md:px-6 flex items-center justify-between bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-30">
      {/* Left: mobile menu + month nav */}
      <div className="flex items-center gap-3">
        <button
          className="md:hidden p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={() => navigateMonth('prev')}
            disabled={!canPrev}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="min-w-[160px] text-center">
            <p className="text-sm font-semibold capitalize">
              {moisToLabel(selectedMonth)}
            </p>
          </div>

          <button
            onClick={() => navigateMonth('next')}
            disabled={!canNext}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Right: sync badge + theme toggle */}
      <div className="flex items-center gap-3">
        {/* PocketBase status pill */}
        <button
          onClick={handleManualSync}
          disabled={syncStatus.isSyncing}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
            syncStatus.isOnline
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
              : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800'
          }`}
          title={
            syncStatus.isOnline
              ? t('topbar.onlineTitle', { url: pb.baseUrl })
              : t('topbar.offlineTitle', { url: pb.baseUrl })
          }
        >
          {syncStatus.isSyncing ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600 dark:text-emerald-400" />
          ) : syncStatus.isOnline ? (
            <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
          )}
          <span>{syncStatus.isSyncing ? t('topbar.syncing') : syncStatus.isOnline ? t('topbar.online') : t('topbar.offline')}</span>
        </button>

        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
          title={theme === 'dark' ? t('topbar.lightMode') : t('topbar.darkMode')}
        >
          {theme === 'dark'
            ? <Sun className="w-4 h-4 text-amber-400" />
            : <Moon className="w-4 h-4 text-gray-600" />
          }
        </button>
      </div>
    </header>
  )
}

