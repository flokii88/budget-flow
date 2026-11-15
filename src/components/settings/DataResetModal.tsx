import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import {
  AlertTriangle,
  Cloud,
  RefreshCw,
  Wifi,
  WifiOff,
  Sliders,
  List,
} from 'lucide-react'
import pb from '@/lib/pocketbase'
import { useTranslation } from '@/i18n'

export interface DataResetModalProps {
  open: boolean
  onClose: () => void
  type: 'transactions' | 'config' | 'all' | null
  pbStats: {
    isOnline: boolean
    counts: {
      transactions: number
      fixedExpenses: number
      categories: number
      types: number
      rules: number
      budgetRules: number
    }
  }
  onConfirm: (onProgress: (msg: string) => void) => Promise<void>
}

export default function DataResetModal({
  open,
  onClose,
  type,
  pbStats,
  onConfirm,
}: DataResetModalProps) {
  const { t } = useTranslation()
  const [isProcessing, setIsProcessing] = useState(false)
  const [progressMessage, setProgressMessage] = useState('')

  useEffect(() => {
    if (open) {
      setIsProcessing(false)
      setProgressMessage('')
    }
  }, [open])

  if (!open || !type) return null

  const handleExecute = async () => {
    if (!pbStats.isOnline) return
    setIsProcessing(true)
    try {
      await onConfirm((msg) => {
        setProgressMessage(msg)
      })
    } catch (err: any) {
      setIsProcessing(false)
      setProgressMessage(`${t('reset.errGeneric')}: ${err?.message || ''}`)
    }
  }

  const isAll = type === 'all'
  const isTx = type === 'transactions'
  const isConfig = type === 'config'

  const title = isAll
    ? t('reset.titleAll')
    : isTx
    ? t('reset.titleTx')
    : t('reset.titleConfig')

  return (
    <Modal open={open} onClose={() => !isProcessing && onClose()} title={title} size="lg">
      <div className="space-y-5 text-gray-800 dark:text-gray-200">
        {/* Bandeau d'alerte contextuel */}
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 ${
            isAll
              ? 'bg-red-50/70 border-red-200 dark:bg-red-950/20 dark:border-red-900/40 text-red-900 dark:text-red-300'
              : isTx
              ? 'bg-blue-50/70 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900/40 text-blue-900 dark:text-blue-300'
              : 'bg-amber-50/70 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/40 text-amber-900 dark:text-amber-300'
          }`}
        >
          <div
            className={`p-2 rounded-lg shrink-0 ${
              isAll
                ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'
                : isTx
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
                : 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400'
            }`}
          >
            {isAll ? (
              <AlertTriangle className="w-5 h-5" />
            ) : isTx ? (
              <List className="w-5 h-5" />
            ) : (
              <Sliders className="w-5 h-5" />
            )}
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold">
              {isAll
                ? t('reset.warnAll')
                : isTx
                ? t('reset.warnTx')
                : t('reset.warnConfig')}
            </h4>
            <p className="text-xs leading-relaxed opacity-90">
              {isAll
                ? t('reset.descAll')
                : isTx
                ? t('reset.descTx', { count: pbStats.counts.transactions })
                : t('reset.descConfig')}
            </p>
          </div>
        </div>

        {/* État de la base PocketBase */}
        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
              <Cloud className="w-4 h-4 text-emerald-500" />
              {t('reset.pbDb')}
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${
                pbStats.isOnline
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
              }`}
            >
              {pbStats.isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {pbStats.isOnline ? t('reset.online') : t('reset.offline')}
            </span>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-[11px] leading-relaxed">
            {t('reset.serverDesc', { url: pb.baseUrl })}
          </p>
          {pbStats.isOnline ? (
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-1 text-gray-700 dark:text-gray-300 font-mono text-[11px]">
              {isTx && (
                <div>
                  {t('reset.txToDelete', { count: pbStats.counts.transactions })}
                </div>
              )}
              {isConfig && (
                <div>
                  {t('reset.configToReset', { cats: pbStats.counts.categories, types: pbStats.counts.types })}
                </div>
              )}
              {isAll && (
                <>
                  <div>{t('reset.allTx', { count: pbStats.counts.transactions })}</div>
                  <div>{t('reset.allCatsTypes', { cats: pbStats.counts.categories, types: pbStats.counts.types })}</div>
                  <div>{t('reset.allRulesFixed', { rules: pbStats.counts.rules, fixed: pbStats.counts.fixedExpenses })}</div>
                </>
              )}
            </div>
          ) : (
            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-[11px] font-sans">
              {t('reset.offlineWarning')}
            </div>
          )}
        </div>

        {/* Message d'état / progression pendant la suppression */}
        {isProcessing && (
          <div className="p-3.5 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center gap-3 text-xs text-gray-800 dark:text-gray-200 animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin text-primary-600 shrink-0" />
            <span className="font-medium">{progressMessage || t('reset.processing')}</span>
          </div>
        )}

        {/* Actions du footer */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
          <p className="text-[11px] text-gray-500 italic">{t('reset.irreversible')}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="btn-secondary text-xs px-3 py-2 disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleExecute}
              disabled={isProcessing || !pbStats.isOnline}
              className={`text-xs px-4 py-2 font-medium rounded-xl text-white shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50 ${
                isAll
                  ? 'bg-red-600 hover:bg-red-700'
                  : isTx
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {isProcessing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              {t('reset.confirmBtn')}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
