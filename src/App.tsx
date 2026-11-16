import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { useStore } from '@/store/useStore'
import AppShell from '@/components/layout/AppShell'
import Dashboard from '@/pages/Dashboard'
import Transactions from '@/pages/Transactions'
import Import from '@/pages/Import'
import Settings from '@/pages/Settings'
import Security from '@/pages/Security'
import SetupWizard from '@/components/onboarding/SetupWizard'
import AuthScreen from '@/components/auth/AuthScreen'
import {
  checkPocketBaseHealth,
  checkOnboardingCompletedPB,
  seedDefaultCategoriesAndTypesPB,
  subscribeSyncStatus,
  SyncStatus,
} from '@/lib/sync'
import {
  getCurrentUser,
  subscribeAuth,
  refreshAuthSession,
} from '@/lib/auth'
import { useQueryClient } from '@tanstack/react-query'
import { invalidateAllBudgetQueries, useBudgetRules } from '@/lib/queries'
import { setActiveCurrency } from '@/lib/utils'
import { useTranslation, setActiveLanguage } from '@/i18n'
import { WifiOff, RefreshCw, X } from 'lucide-react'
import { Toaster } from '@/components/ui/Toaster'

export default function App() {
  const theme = useStore(s => s.theme)
  const currency = useStore(s => s.currency)
  const { t, language } = useTranslation()
  const queryClient = useQueryClient()

  const [isSessionReady, setIsSessionReady] = useState<boolean>(() => {
    const u = getCurrentUser()
    return !!u && !u.must_change_password
  })
  const [showSetupWizard, setShowSetupWizard] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: false,
    isSyncing: false,
    lastSyncTime: null,
    error: null,
  })
  const [showOfflineBanner, setShowOfflineBanner] = useState(false)
  const [retrying, setRetrying] = useState(false)

  useBudgetRules()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    setActiveCurrency(currency)
  }, [currency])

  useEffect(() => {
    setActiveLanguage(language)
    document.documentElement.lang = language
  }, [language])

  const initializeAuthenticatedWorkspace = useCallback(async () => {
    const online = await checkPocketBaseHealth()
    if (!online) {
      setShowOfflineBanner(true)
      return
    }
    await seedDefaultCategoriesAndTypesPB()
    await invalidateAllBudgetQueries(queryClient)
    const completed = await checkOnboardingCompletedPB()
    if (!completed) {
      setShowSetupWizard(true)
    }
  }, [queryClient])

  useEffect(() => {
    // Subscribe to auth state changes (e.g. logout or token expiration)
    const unsubscribeAuth = subscribeAuth(user => {
      if (!user) {
        setIsSessionReady(false)
        setShowSetupWizard(false)
        queryClient.clear()
      }
    })

    // Subscribe to sync status to show offline banner
    const unsubscribeSync = subscribeSyncStatus(status => {
      setSyncStatus(status)
      if (!status.isOnline && !status.isSyncing) {
        setShowOfflineBanner(true)
      } else if (status.isOnline) {
        setShowOfflineBanner(false)
      }
    })

    // Refresh existing session if present at startup
    const initialUser = getCurrentUser()
    if (initialUser && !initialUser.must_change_password) {
      refreshAuthSession().then(user => {
        if (user && !user.must_change_password) {
          setIsSessionReady(true)
          initializeAuthenticatedWorkspace()
        } else {
          setIsSessionReady(false)
        }
      })
    }

    // Listen for setup wizard trigger (from Settings, Dashboard, etc.)
    const handleOpenWizard = () => setShowSetupWizard(true)
    window.addEventListener('open-setup-wizard', handleOpenWizard)
    return () => {
      window.removeEventListener('open-setup-wizard', handleOpenWizard)
      unsubscribeAuth()
      unsubscribeSync()
    }
  }, [initializeAuthenticatedWorkspace, queryClient])

  const handleAuthenticated = async () => {
    setIsSessionReady(true)
    await initializeAuthenticatedWorkspace()
  }

  const handleRetry = async () => {
    setRetrying(true)
    const online = await checkPocketBaseHealth()
    if (online) {
      await invalidateAllBudgetQueries(queryClient)
    }
    setRetrying(false)
  }

  if (!isSessionReady) {
    return (
      <>
        <AuthScreen onAuthenticated={handleAuthenticated} />
        <Toaster />
      </>
    )
  }

  return (
    <BrowserRouter>
      {/* Offline banner */}
      {showOfflineBanner && !syncStatus.isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-3 px-4 py-2.5 bg-red-600 text-white text-sm font-medium shadow-lg">
          <div className="flex items-center gap-2 min-w-0">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span className="truncate">{t('offline.bannerText')}</span>
            {syncStatus.error && (
              <span className="text-red-100 text-xs hidden sm:inline truncate">({syncStatus.error})</span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/settings?tab=data"
              className="px-3 py-1 rounded-lg bg-white text-red-700 hover:bg-red-50 transition-colors text-xs font-semibold shadow-sm"
            >
              {t('offline.configurePb')}
            </Link>
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-xs font-semibold disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} />
              {t('common.retry')}
            </button>
            <button
              onClick={() => setShowOfflineBanner(false)}
              className="p-1 rounded-lg hover:bg-white/20 transition-colors"
              title={t('common.close')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className={showOfflineBanner && !syncStatus.isOnline ? 'pt-11' : ''}>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="import" element={<Import />} />
            <Route path="settings" element={<Settings />} />
            <Route path="security" element={<Security />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </div>

      {/* Assistant de configuration initiale pas à pas */}
      <SetupWizard
        isOpen={showSetupWizard}
        onClose={() => setShowSetupWizard(false)}
        onFinish={() => setShowSetupWizard(false)}
      />

      <Toaster />
    </BrowserRouter>
  )
}
