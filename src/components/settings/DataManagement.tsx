import { useState, useEffect, useMemo } from 'react'
import {
  List,
  Sliders,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Database,
  Tag,
  Columns3,
  Receipt,
  FileSpreadsheet,
  Scale,
  Wifi,
  WifiOff,
  Settings2,
  Cloud,
} from 'lucide-react'
import { DEFAULT_BUDGET_RULES } from '@/lib/constants'
import { countDuplicateTransactions } from '@/lib/utils'
import pb, { updatePocketBaseUrl } from '@/lib/pocketbase'
import {
  subscribeSyncStatus,
  checkPocketBaseHealth,
  clearPocketBaseTransactions,
  clearPocketBaseConfigurations,
  resetPocketBaseAllData,
  seedDefaultCategoriesAndTypesPB,
  saveBudgetRulesPB,
  deduplicateTransactionsPB,
  SyncStatus,
} from '@/lib/sync'
import {
  useTransactions,
  useCategories,
  useBudgetTypes,
  useCategorizationRules,
  useFixedExpenses,
  usePocketBaseStats,
  invalidateAllBudgetQueries,
  QUERY_KEYS,
} from '@/lib/queries'
import { useQueryClient } from '@tanstack/react-query'
import ReconciliationModal from '@/components/transactions/ReconciliationModal'
import DataResetModal from './DataResetModal'
import { showToast } from '@/components/ui/Toaster'
import { useTranslation } from '@/i18n'

export default function DataManagement() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: txList = [] } = useTransactions()
  const { data: categoriesList = [] } = useCategories()
  const { data: typesList = [] } = useBudgetTypes()
  const { data: rulesList = [] } = useCategorizationRules()
  const { data: expensesList = [] } = useFixedExpenses()
  const { data: pbStats = {
    isOnline: false,
    counts: { transactions: 0, fixedExpenses: 0, categories: 0, types: 0, rules: 0, budgetRules: 0 },
  } } = usePocketBaseStats()

  const duplicatesCount = useMemo(() => countDuplicateTransactions(txList), [txList])
  const [showReconcilModal, setShowReconcilModal] = useState(false)
  const [resetModalType, setResetModalType] = useState<'transactions' | 'config' | 'all' | null>(null)

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: false,
    isSyncing: false,
    lastSyncTime: null,
    error: null,
  })

  const [pbUrlInput, setPbUrlInput] = useState(pb.baseUrl)
  const [isEditingUrl, setIsEditingUrl] = useState(false)

  const [notification, setNotification] = useState<{
    type: 'success' | 'info'
    message: string
  } | null>(null)

  const showNotification = (message: string, type: 'success' | 'info' = 'success') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 4500)
  }

  useEffect(() => {
    return subscribeSyncStatus(setSyncStatus)
  }, [])

  const reloadData = async () => {
    const online = await checkPocketBaseHealth()
    if (!online) {
      showToast(`Aucun serveur PocketBase n'est connecté (${pb.baseUrl}).`, 'error')
      return
    }
    await invalidateAllBudgetQueries(queryClient)
  }

  const handleSavePbUrl = async () => {
    updatePocketBaseUrl(pbUrlInput)
    setIsEditingUrl(false)
    await reloadData()
    showNotification(`URL PocketBase mise à jour : ${pb.baseUrl}`)
  }

  const handleCleanDuplicates = async () => {
    const cleaned = await deduplicateTransactionsPB(txList)
    await invalidateAllBudgetQueries(queryClient)
    showNotification(`${cleaned} transaction(s) en doublon ont été nettoyées dans PocketBase.`)
  }

  const handleOpenReset = async (type: 'transactions' | 'config' | 'all') => {
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pbStats })
    setResetModalType(type)
  }

  const handleExecuteReset = async (onProgress: (msg: string) => void) => {
    if (!resetModalType) return

    if (resetModalType === 'transactions') {
      onProgress('Suppression des transactions sur PocketBase...')
      await clearPocketBaseTransactions(onProgress)
      await invalidateAllBudgetQueries(queryClient)
      setResetModalType(null)
      showNotification('Toutes les transactions ont été supprimées de PocketBase.')
    } else if (resetModalType === 'config') {
      onProgress('Suppression des anciennes configurations sur PocketBase...')
      await clearPocketBaseConfigurations(onProgress)
      onProgress('Restauration des réglages par défaut sur PocketBase...')
      await seedDefaultCategoriesAndTypesPB()
      await saveBudgetRulesPB(DEFAULT_BUDGET_RULES)
      await invalidateAllBudgetQueries(queryClient)
      setResetModalType(null)
      showNotification('Configuration réinitialisée aux réglages par défaut sur PocketBase.')
    } else if (resetModalType === 'all') {
      onProgress('Nettoyage complet de PocketBase...')
      await resetPocketBaseAllData((msg) => onProgress(msg))
      onProgress('Réinitialisation des types et catégories de base...')
      await seedDefaultCategoriesAndTypesPB()
      await invalidateAllBudgetQueries(queryClient)
      setResetModalType(null)
      showNotification('Base PocketBase remise à zéro avec succès.')
    }
  }

  return (
    <div className="space-y-6">
      {/* PocketBase Connection Banner */}
      <div className="card p-5 border-l-4 border-l-emerald-500 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div
              className={`p-2 rounded-xl ${
                syncStatus.isOnline
                  ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                  : 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
              }`}
            >
              {syncStatus.isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                Serveur PocketBase (Source unique)
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                    syncStatus.isOnline
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300'
                  }`}
                >
                  {syncStatus.isOnline ? 'Connecté' : 'Non connecté'}
                </span>
              </h3>
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                <span>
                  URL :{' '}
                  <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded font-mono text-gray-700 dark:text-gray-300">
                    {pb.baseUrl}
                  </code>
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditingUrl(!isEditingUrl)}
                  className="text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1 font-medium"
                >
                  <Settings2 className="w-3 h-3" />
                  {isEditingUrl ? 'Fermer' : "Changer l'URL"}
                </button>
              </div>
              {isEditingUrl && (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    value={pbUrlInput}
                    onChange={(e) => setPbUrlInput(e.target.value)}
                    placeholder="http://127.0.0.1:8090"
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 w-64"
                  />
                  <button
                    type="button"
                    onClick={handleSavePbUrl}
                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-sm"
                  >
                    Tester & Valider
                  </button>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1">
                {syncStatus.isOnline
                  ? 'Toutes vos données sont lues et enregistrées directement sur PocketBase, accessibles depuis tous vos appareils.'
                  : `Serveur non joignable sur ${pb.baseUrl}. Vérifiez que PocketBase est démarré.`}
              </p>
            </div>
          </div>

          <button
            onClick={reloadData}
            disabled={syncStatus.isSyncing}
            className="px-3.5 py-2 text-xs font-medium rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncStatus.isSyncing ? 'animate-spin' : ''}`} />
            Rafraîchir PocketBase
          </button>
        </div>
      </div>

      {/* Notifications banner */}
      {notification && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 animate-fade-in shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      {/* Sections ci-dessous floutées si PocketBase n'est pas connecté */}
      <div
        className={`space-y-6 transition-all duration-300 ${
          !syncStatus.isOnline ? 'blur-sm pointer-events-none select-none opacity-50' : ''
        }`}
        aria-disabled={!syncStatus.isOnline}
      >
        {/* Snapshot des données actuelles */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/40 rounded-xl text-primary-600 dark:text-primary-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {t('data.stateTitle')}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('data.stateDesc')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowReconcilModal(true)}
              className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 text-primary-600 dark:text-primary-400 hover:border-primary-300 shadow-sm"
              title={t('data.reconcileTitle')}
            >
              <Scale className="w-3.5 h-3.5" />
              {t('data.reconcileBtn')}
            </button>
            <button
              onClick={reloadData}
              className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 text-gray-600 dark:text-gray-300"
              title={t('data.refreshBtn')}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {t('data.refreshBtn')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
          <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-800 text-center">
            <FileSpreadsheet className="w-4 h-4 text-blue-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{txList.length}</p>
            <p className="text-[11px] text-gray-500">{t('data.statTx')}</p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-800 text-center">
            <Tag className="w-4 h-4 text-indigo-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{categoriesList.length}</p>
            <p className="text-[11px] text-gray-500">{t('data.statCats')}</p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-800 text-center">
            <Sliders className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{typesList.length}</p>
            <p className="text-[11px] text-gray-500">{t('data.statTypes')}</p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-800 text-center">
            <Columns3 className="w-4 h-4 text-amber-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{rulesList.length}</p>
            <p className="text-[11px] text-gray-500">{t('data.statRules')}</p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-800 text-center">
            <Receipt className="w-4 h-4 text-purple-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{expensesList.length}</p>
            <p className="text-[11px] text-gray-500">{t('data.statFixed')}</p>
          </div>
        </div>
      </div>

      {/* Cartes d'actions de suppression et réinitialisation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Action 1 : Suppression des transactions */}
        <div className="card p-5 border-l-4 border-l-blue-500 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-xl text-blue-600 dark:text-blue-400">
                <List className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t('data.delTxTitle')}
                </h4>
                <p className="text-[11px] text-gray-500">{t('data.delTxSub')}</p>
              </div>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              {t('data.delTxDesc', { count: txList.length })}
            </p>
            <div className="space-y-1.5 text-[11px]">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 text-blue-800 dark:text-blue-300">
                {t('data.delTxKeep')}
              </div>
              <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                <Cloud className="w-3 h-3 text-emerald-500" />
                <span>{t('data.delTxDirect')}</span>
              </div>
            </div>

            {duplicatesCount > 0 && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-2">
                <div className="text-xs text-amber-800 dark:text-amber-300 font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  {t('data.dupsDetected', { count: duplicatesCount })}
                </div>
                <button
                  onClick={handleCleanDuplicates}
                  className="btn-primary w-full text-xs py-1.5 flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <RefreshCw className="w-3 h-3" /> {t('data.cleanDupsBtn', { count: duplicatesCount })}
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => handleOpenReset('transactions')}
            disabled={txList.length === 0 && pbStats.counts.transactions === 0}
            className="btn-danger w-full text-xs py-2 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t('data.delTxBtn')}
          </button>
        </div>

        {/* Action 2 : Réinitialisation de la configuration */}
        <div className="card p-5 border-l-4 border-l-amber-500 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-xl text-amber-600 dark:text-amber-400">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t('data.resetCfgTitle')}
                </h4>
                <p className="text-[11px] text-gray-500">{t('data.resetCfgSub')}</p>
              </div>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              {t('data.resetCfgDesc')}
            </p>
            <div className="space-y-1.5 text-[11px]">
              <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 text-amber-800 dark:text-amber-300">
                {t('data.resetCfgKeep')}
              </div>
              <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                <Cloud className="w-3 h-3 text-emerald-500" />
                <span>{t('data.resetCfgDirect')}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => handleOpenReset('config')}
            className="btn-secondary w-full text-xs py-2 flex items-center justify-center gap-2 text-amber-700 dark:text-amber-400 hover:border-amber-300 dark:hover:border-amber-800"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t('data.resetCfgBtn')}
          </button>
        </div>
      </div>

      {/* Action 3 : Zone de danger ultime (Tout effacer / Factory Reset) */}
      <div className="card p-5 border border-red-200 dark:border-red-900/40 bg-red-50/40 dark:bg-red-950/10 space-y-3">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-xl text-red-600 dark:text-red-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-red-800 dark:text-red-300 uppercase tracking-wide flex items-center gap-2">
                {t('data.dangerTitle')}
              </h4>
              <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed max-w-2xl">
                {t('data.dangerDesc')}
              </p>
            </div>
          </div>
          <button
            onClick={() => handleOpenReset('all')}
            className="btn-danger text-xs py-2 px-4 whitespace-nowrap shrink-0 shadow-sm"
          >
            {t('data.dangerBtn')}
          </button>
        </div>
      </div>
      </div>

      {/* Modale de réconciliation bancaire */}
      <ReconciliationModal
        open={showReconcilModal}
        onClose={() => setShowReconcilModal(false)}
        onSuccess={reloadData}
      />

      {/* Modale interactive et détaillée de suppression / réinitialisation */}
      <DataResetModal
        open={resetModalType !== null}
        onClose={() => setResetModalType(null)}
        type={resetModalType}
        pbStats={pbStats}
        onConfirm={handleExecuteReset}
      />
    </div>
  )
}
