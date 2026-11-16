import { useState, useEffect } from 'react'
import { useSearchParams, Navigate } from 'react-router-dom'
import { Settings as SettingsIcon, Database, Receipt, Tag, Columns3, Sparkles, Languages } from 'lucide-react'
import FixedExpensesManager from '@/components/settings/FixedExpensesManager'
import BudgetRulesEditor from '@/components/settings/BudgetRulesEditor'
import CategoriesTypesManager from '@/components/settings/CategoriesTypesManager'
import SwimlaneRulesManager from '@/components/settings/SwimlaneRulesManager'
import DataManagement from '@/components/settings/DataManagement'
import { useTranslation } from '@/i18n'
import { Language } from '@/lib/types'

type Tab = 'budget' | 'categories' | 'swimlanes' | 'depenses' | 'data'
const VALID_TABS: Tab[] = ['budget', 'categories', 'swimlanes', 'depenses', 'data']

export default function Settings() {
  const { t, language, setLanguage } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab')
  const paramTab = rawTab as Tab | null
  const [tab, setTab] = useState<Tab>(paramTab && VALID_TABS.includes(paramTab) ? paramTab : 'budget')

  useEffect(() => {
    if (paramTab && VALID_TABS.includes(paramTab) && paramTab !== tab) {
      setTab(paramTab)
    }
  }, [paramTab, tab])

  if (rawTab === 'security') {
    return <Navigate to="/security" replace />
  }

  const handleSelectTab = (id: Tab) => {
    setTab(id)
    setSearchParams({ tab: id })
  }

  const tabs: { id: Tab; label: string; icon: typeof SettingsIcon }[] = [
    { id: 'budget', label: t('settings.tabBudget'), icon: SettingsIcon },
    { id: 'categories', label: t('settings.tabCategories'), icon: Tag },
    { id: 'swimlanes', label: t('settings.tabSwimlanes'), icon: Columns3 },
    { id: 'depenses', label: t('settings.tabFixed'), icon: Receipt },
    { id: 'data', label: t('settings.tabData'), icon: Database },
  ]

  const languages: { code: Language; label: string }[] = [
    { code: 'fr', label: 'Français' },
    { code: 'en', label: 'English' },
  ]

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-primary-500" />
            {t('settings.title')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {t('settings.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Language selector */}
          <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800/70 p-1 rounded-xl border border-gray-200/70 dark:border-gray-700/70">
            <Languages className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 ml-2" />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mr-1 hidden sm:inline">
              {t('settings.language')} :
            </span>
            {languages.map(lang => (
              <button
                key={lang.code}
                type="button"
                onClick={() => setLanguage(lang.code)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  language === lang.code
                    ? 'bg-white dark:bg-gray-900 text-primary-600 dark:text-primary-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-setup-wizard'))}
            className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-2 border-primary-200 dark:border-primary-800 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/30 transition-all shadow-sm"
            title={t('settings.relaunchWizardTitle')}
          >
            <Sparkles className="w-4 h-4 text-primary-500" />
            <span>{t('settings.relaunchWizard')}</span>
          </button>
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

      {tab === 'budget' && <BudgetRulesEditor />}
      {tab === 'categories' && <CategoriesTypesManager />}
      {tab === 'swimlanes' && <SwimlaneRulesManager />}
      {tab === 'depenses' && <FixedExpensesManager />}
      {tab === 'data' && <DataManagement />}
    </div>
  )
}
