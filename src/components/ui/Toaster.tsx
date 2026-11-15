import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
}

type ToastListener = (message: string, type: ToastType) => void
const toastListeners = new Set<ToastListener>()

export function showToast(message: string, type: ToastType = 'success') {
  toastListeners.forEach(listener => listener(message, type))
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

export const ToastContext = createContext<ToastContextValue>({ toast: showToast })

export function useToast() {
  return useContext(ToastContext)
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500)
  }, [])

  useEffect(() => {
    toastListeners.add(toast)
    return () => {
      toastListeners.delete(toast)
    }
  }, [toast])

  const remove = (id: string) => setToasts(prev => prev.filter(t => t.id !== id))

  const icons = {
    success: <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />,
    error: <XCircle className="w-4 h-4 text-red-500 shrink-0" />,
    info: <Info className="w-4 h-4 text-blue-500 shrink-0" />,
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none max-w-sm">
        {toasts.map(t => (
          <div
            key={t.id}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border pointer-events-auto animate-fade-in',
              t.type === 'error'
                ? 'bg-red-50 dark:bg-red-950/90 border-red-200 dark:border-red-800 text-red-900 dark:text-red-100'
                : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-200'
            )}
          >
            {icons[t.type]}
            <p className="text-sm font-medium">{t.message}</p>
            <button onClick={() => remove(t.id)} className="ml-2 p-0.5 hover:bg-black/5 dark:hover:bg-white/10 rounded">
              <X className="w-3 h-3 opacity-60" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
