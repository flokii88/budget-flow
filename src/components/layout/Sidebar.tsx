import { NavLink } from 'react-router-dom'
import { LayoutDashboard, List, Upload, Settings, ShieldCheck, TrendingUp, X, LogOut, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import LogoIcon from '@/components/ui/LogoIcon'
import { useState, useEffect } from 'react'
import { useTranslation } from '@/i18n'
import { AuthUser, getCurrentUser, subscribeAuth, logoutUser } from '@/lib/auth'
import { useStore } from '@/store/useStore'

export default function Sidebar() {
  const mobileOpen = useStore(s => s.mobileMenuOpen)
  const setMobileOpen = useStore(s => s.setMobileMenuOpen)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(getCurrentUser())
  const { t } = useTranslation()

  useEffect(() => {
    return subscribeAuth(setCurrentUser)
  }, [])

  const NAV_ITEMS = [
    { to: '/', icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: '/transactions', icon: List, label: t('nav.transactions') },
    { to: '/import', icon: Upload, label: t('nav.import') },
    { to: '/settings', icon: Settings, label: t('nav.settings') },
    { to: '/security', icon: ShieldCheck, label: t('nav.security') },
  ]

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed md:sticky md:top-0 inset-y-0 left-0 z-50 flex flex-col w-full md:w-64 h-screen max-h-screen overflow-y-auto bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 transition-transform duration-300 md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <LogoIcon className="w-8 h-8 shadow-sm" />
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">Budget</p>
              <p className="text-xs font-semibold text-primary-600 dark:text-primary-400 leading-tight">Flow</p>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                )
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-800 space-y-2 shrink-0">
          {currentUser && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/80">
              <div className="flex items-center gap-2 min-w-0">
                <User className="w-4 h-4 text-primary-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                    {currentUser.name || currentUser.email}
                  </p>
                  {currentUser.name && (
                    <p className="text-[11px] text-gray-400 truncate">{currentUser.email}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={logoutUser}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0"
                title={t('auth.logout')}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800">
            <TrendingUp className="w-4 h-4 text-primary-500" />
            <div>
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{t('nav.methodTitle')}</p>
              <p className="text-xs text-gray-400">{t('nav.methodSubtitle')}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

export function SidebarToggle() {
  const toggleMobileMenu = useStore(s => s.toggleMobileMenu)
  return (
    <button
      onClick={toggleMobileMenu}
      className="md:hidden p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
    >
      <LayoutDashboard className="w-5 h-5" />
    </button>
  )
}
