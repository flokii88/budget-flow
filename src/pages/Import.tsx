import { useState } from 'react'
import { Transaction } from '@/lib/types'
import CSVImporter from '@/components/import/CSVImporter'
import { Upload } from 'lucide-react'
import { useTranslation } from '@/i18n'

export default function Import() {
  const { t } = useTranslation()
  const [importCount, setImportCount] = useState(0)

  const handleImport = (transactions: Omit<Transaction, 'id' | 'created' | 'updated'>[]) => {
    // CSVImporter enregistre déjà les transactions dans handleFinalizeImport
    setImportCount(prev => prev + transactions.length)
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Upload className="w-6 h-6 text-primary-500" />
          {t('import.title')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {t('import.subtitle')}
        </p>
      </div>

      {/* Tips */}
      <div className="card p-4 bg-primary-50 dark:bg-primary-950/20 border border-primary-100 dark:border-primary-900/40">
        <p className="text-xs font-semibold text-primary-700 dark:text-primary-300 mb-2">{t('import.tipsTitle')}</p>
        <ul className="text-xs text-primary-600 dark:text-primary-400 space-y-1 list-disc list-inside">
          <li>{t('import.tip1')}</li>
          <li>{t('import.tip2')}</li>
          <li>{t('import.tip3')}</li>
          <li>{t('import.tip4')}</li>
        </ul>
      </div>

      <CSVImporter onImport={handleImport} />

      {importCount > 0 && (
        <div className="text-center text-sm text-gray-400">
          {importCount > 1
            ? t('import.sessionCountPlural', { count: importCount })
            : t('import.sessionCountSingular', { count: importCount })}
        </div>
      )}
    </div>
  )
}
