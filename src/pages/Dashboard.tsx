import { useState, useMemo } from 'react'
import { Euro, TrendingUp, TrendingDown, Wallet, Calendar, Scale, Sparkles, ArrowRight } from 'lucide-react'
import { PocketBaseGuard } from '@/components/ui/PocketBaseRequiredState'
import { useStore } from '@/store/useStore'
import { useTransactions, useBudgetRules, QUERY_KEYS } from '@/lib/queries'
import { useQueryClient } from '@tanstack/react-query'
import { DEFAULT_BUDGET_RULES } from '@/lib/constants'
import { computeDashboard, moisToLabel, formatCurrency, getAvailableMonths } from '@/lib/utils'
import KPICard from '@/components/dashboard/KPICard'
import BudgetGauge from '@/components/dashboard/BudgetGauge'
import SavingsModule from '@/components/dashboard/SavingsModule'
import MonthlyChart from '@/components/dashboard/MonthlyChart'
import FixedExpensesTracker from '@/components/dashboard/FixedExpensesTracker'
import ReconciliationModal from '@/components/transactions/ReconciliationModal'
import { useTranslation } from '@/i18n'

export default function Dashboard() {
  const { selectedMonth, setSelectedMonth } = useStore()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: transactions = [], isLoading, error, refetch } = useTransactions()
  const { data: budgetRules = DEFAULT_BUDGET_RULES } = useBudgetRules()
  const [showReconcilModal, setShowReconcilModal] = useState(false)

  const loading = isLoading
  const errorMessage = error ? (error as Error).message || t('common.pbUnreachable') : null
  const loadTransactions = () => {
    refetch()
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.budgetRules })
  }

  const dashboard = useMemo(
    () => computeDashboard(transactions, selectedMonth, budgetRules),
    [transactions, selectedMonth, budgetRules]
  )

  const months = useMemo(() => getAvailableMonths(transactions), [transactions])
  const allDashboards = useMemo(
    () => months.map(m => computeDashboard(transactions, m, budgetRules)),
    [months, transactions, budgetRules]
  )

  // Solde bancaire cumulé (toutes transactions confondues)
  const totalGlobalBalance = useMemo(() => {
    const credits = transactions.reduce((sum, t) => sum + (t.credit || 0), 0)
    const debits = transactions.reduce((sum, t) => sum + (t.debit || 0), 0)
    return credits - debits
  }, [transactions])

  const soldeIsPositive = dashboard.solde_theorique >= 0

  return (
    <PocketBaseGuard
      error={errorMessage}
      isLoading={loading}
      loadingLabel={t('dashboard.loading')}
      onRetry={loadTransactions}
    >
    <div className="space-y-6 animate-fade-in">
      {/* Header avec sélecteur de mois unique et réconciliation */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('dashboard.title')}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {t('dashboard.subtitle')}
            </p>
          </div>

          {/* Sélecteur de mois unique & compact */}
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="input text-sm font-semibold py-1.5 pl-3 pr-8 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl cursor-pointer shadow-sm appearance-none capitalize"
            >
              {months.map(m => (
                <option key={m} value={m}>
                  {moisToLabel(m)}
                </option>
              ))}
            </select>
            <Calendar className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Badge solde actuel + Bouton forcer la réconciliation */}
        <div className="flex items-center gap-2">
          <div className="p-2 px-3 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-800 text-right">
            <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">{t('dashboard.bankBalance')}</p>
            <p className="text-base font-bold text-gray-900 dark:text-white">
              {formatCurrency(totalGlobalBalance)}
            </p>
          </div>

          <button
            onClick={() => setShowReconcilModal(true)}
            className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 text-primary-600 dark:text-primary-400 hover:border-primary-300 dark:hover:border-primary-700 shadow-sm"
            title={t('dashboard.reconcileTitle')}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>{t('dashboard.reconcile')}</span>
          </button>
        </div>
      </div>

      {/* Bannière de premier démarrage si revenus non configurés */}
      {(!budgetRules.revenus_theoriques || budgetRules.revenus_theoriques <= 0) && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-primary-500/10 via-indigo-500/10 to-emerald-500/10 border border-primary-200 dark:border-primary-900/50 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary-500 text-white shadow-md shadow-primary-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                {t('dashboard.setupTitle')}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('dashboard.setupDesc')}
              </p>
            </div>
          </div>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-setup-wizard'))}
            className="btn-primary text-xs py-2 px-4 flex items-center gap-2 shadow-md shadow-primary-500/20"
          >
            <span>{t('dashboard.launchWizard')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          title={t('dashboard.kpiRealIncome')}
          amount={dashboard.total_revenus_reels}
          subtitle={t('dashboard.kpiTarget', { amount: formatCurrency(dashboard.total_revenus_theoriques) })}
          icon={<TrendingUp className="w-4 h-4" />}
          color="blue"
        />
        <KPICard
          title={t('dashboard.kpiTotalExpenses')}
          amount={dashboard.total_depenses}
          icon={<TrendingDown className="w-4 h-4" />}
          color="red"
        />
        <KPICard
          title={t('dashboard.kpiMonthBalance')}
          amount={dashboard.solde_theorique}
          subtitle={t('dashboard.kpiGlobalAccount', { amount: formatCurrency(totalGlobalBalance) })}
          icon={<Wallet className="w-4 h-4" />}
          color={soldeIsPositive ? 'green' : 'red'}
        />
        <KPICard
          title={t('dashboard.kpiRealSavings')}
          amount={dashboard.reel_epargne}
          subtitle={t('dashboard.kpiTarget', { amount: formatCurrency(dashboard.budget_epargne) })}
          icon={<Euro className="w-4 h-4" />}
          color="purple"
        />
      </div>

      {/* Suivi des dépenses fixes (passées vs en attente) */}
      <FixedExpensesTracker
        transactions={transactions}
        selectedMonth={selectedMonth}
      />

      {/* Budget 55/25/20 + Savings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Budget Gauges */}
        <div className="lg:col-span-2 card p-5 space-y-5">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            {t('dashboard.ruleTitle')}
          </h3>
          <BudgetGauge
            label={t('dashboard.gaugeEssential')}
            budget={dashboard.budget_essentielle}
            reel={dashboard.reel_essentielle}
            ecart={dashboard.ecart_essentielle}
            taux={budgetRules.taux_essentielle}
            color="#6366f1"
          />
          <div className="border-t border-gray-100 dark:border-gray-800 pt-5">
            <BudgetGauge
              label={t('dashboard.gaugeLeisure')}
              budget={dashboard.budget_loisirs}
              reel={dashboard.reel_loisirs}
              ecart={dashboard.ecart_loisirs}
              taux={budgetRules.taux_loisirs}
              color="#f59e0b"
            />
          </div>
          <div className="border-t border-gray-100 dark:border-gray-800 pt-5">
            <BudgetGauge
              label={t('dashboard.gaugeSavings')}
              budget={dashboard.budget_epargne}
              reel={dashboard.reel_epargne}
              ecart={dashboard.ecart_epargne}
              taux={budgetRules.taux_epargne}
              color="#10b981"
            />
          </div>
        </div>

        {/* Savings allocation */}
        {dashboard.savings && <SavingsModule savings={dashboard.savings} />}
      </div>

      {/* Monthly chart */}
      {allDashboards.length > 1 && (
        <MonthlyChart data={allDashboards} />
      )}

      {/* Empty state */}
      {transactions.length === 0 && (
        <div className="card p-12 text-center">
          <Wallet className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-700 mb-4" />
          <h3 className="text-base font-semibold text-gray-600 dark:text-gray-400 mb-2">
            {t('dashboard.emptyTitle')}
          </h3>
          <p className="text-sm text-gray-400">
            {t('dashboard.emptyDesc')}
          </p>
        </div>
      )}

      {/* Modale de réconciliation manuelle / forcée */}
      <ReconciliationModal
        open={showReconcilModal}
        onClose={() => setShowReconcilModal(false)}
        onSuccess={loadTransactions}
      />
    </div>
    </PocketBaseGuard>
  )
}
