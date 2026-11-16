import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ShieldCheck, User, Users } from 'lucide-react'
import SecurityManager, { SecurityTab } from '@/components/settings/SecurityManager'
import { useTranslation } from '@/i18n'

const VALID_TABS: SecurityTab[] = ['account', 'household']

export default function Security() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const paramTab = searchParams.get('tab') as SecurityTab | null
  const [tab, setTab] = useState<SecurityTab>(
    paramTab && VALID_TABS.includes(paramTab) ? paramTab : 'account'
  )

  useEffect(() => {
    if (paramTab && VALID_TABS.includes(paramTab) && paramTab !== tab) {
      setTab(paramTab)
    }
  }, [paramTab, tab])

  const handleSelectTab = (id: SecurityTab) => {
    setTab(id)
    setSearchParams({ tab: id })
  }

  const tabs: { id: SecurityTab; label: string; icon: typeof User }[] = [
    { id: 'account', label: t('security.tabAccount'), icon: User },
    { id: 'household', label: t('security.tabHousehold'), icon: Users },
  ]

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary-500" />
            {t('security.pageTitle')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {t('security.pageSubtitle')}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800/50 p-1 rounded-xl w-fit flex-wrap">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => handleSelectTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              tab === id
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      <SecurityManager activeTab={tab} />
    </div>
  )
}
