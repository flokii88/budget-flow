import { useState } from 'react'
import { CSVFieldMapping } from '@/lib/types'
import Select from '@/components/ui/Select'
import { ArrowRight } from 'lucide-react'
import { useTranslation } from '@/i18n'

interface FieldMapperProps {
  columns: string[]
  onConfirm: (mapping: CSVFieldMapping) => void
  onCancel: () => void
}

export default function FieldMapper({ columns, onConfirm, onCancel }: FieldMapperProps) {
  const { t } = useTranslation()
  const [mapping, setMapping] = useState<Partial<CSVFieldMapping>>({})

  const APP_FIELDS = [
    { key: 'date', label: t('mapper.date'), required: true },
    { key: 'libelle_operation', label: t('mapper.opLabel'), required: true },
    { key: 'libelle_simplifie', label: t('mapper.shortLabel'), required: false },
    { key: 'debit', label: t('mapper.debit'), required: true },
    { key: 'credit', label: t('mapper.credit'), required: true },
    { key: 'categorie', label: t('mapper.category'), required: false },
  ] as const

  const columnOptions = [
    { value: '', label: t('mapper.ignore') },
    ...columns.map(c => ({ value: c, label: c }))
  ]

  const isValid = mapping.date && mapping.libelle_operation && mapping.debit && mapping.credit

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {t('mapper.desc')}
      </p>

      <div className="space-y-3">
        {APP_FIELDS.map(field => (
          <div key={field.key} className="flex items-center gap-4">
            <div className="w-48 flex-shrink-0">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
            <Select
              options={columnOptions}
              value={(mapping as Record<string, string>)[field.key] || ''}
              onChange={e => setMapping(prev => ({ ...prev, [field.key]: e.target.value }))}
              className="flex-1"
            />
          </div>
        ))}
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <button onClick={onCancel} className="btn-secondary">{t('common.back')}</button>
        <button
          onClick={() => isValid && onConfirm(mapping as CSVFieldMapping)}
          disabled={!isValid}
          className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t('mapper.importBtn')}
        </button>
      </div>
    </div>
  )
}
