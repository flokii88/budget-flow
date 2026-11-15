import Modal from './Modal'
import { AlertTriangle } from 'lucide-react'
import { useTranslation } from '@/i18n'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
}

export default function ConfirmDialog({
  open, onClose, onConfirm, title, message,
  confirmLabel,
  danger = false,
}: ConfirmDialogProps) {
  const { t } = useTranslation()
  const resolvedConfirmLabel = confirmLabel ?? t('common.confirm')

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-xl ${danger ? 'bg-red-50 dark:bg-red-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
            <AlertTriangle className={`w-4 h-4 ${danger ? 'text-red-500' : 'text-amber-500'}`} />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">{t('common.cancel')}</button>
          <button
            onClick={() => { onConfirm(); onClose() }}
            className={danger ? 'btn-danger' : 'btn-primary'}
          >
            {resolvedConfirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
