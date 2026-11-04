import { useEffect } from 'react'
import type { Toast, ToastKind } from '../store/toastStore'
import { useToastStore } from '../store/toastStore'

const toastClass: Record<ToastKind, string> = {
  error: 'border-red-800 bg-red-950/95 text-red-100',
  info: 'border-sky-800 bg-sky-950/95 text-sky-100',
  success: 'border-emerald-800 bg-emerald-950/95 text-emerald-100',
}

const ToastItem = ({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) => {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 6000)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm shadow-xl ${toastClass[toast.kind]}`}
      role="alert"
    >
      <span className="break-words">{toast.message}</span>
      <button
        aria-label="Dismiss"
        className="shrink-0 text-current/60 hover:text-current"
        onClick={() => onDismiss(toast.id)}
      >
        ×
      </button>
    </div>
  )
}

export const Toasts = () => {
  const toasts = useToastStore((state) => state.toasts)
  const dismiss = useToastStore((state) => state.dismiss)
  return toasts.length === 0 ? null : (
    <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
    </div>
  )
}
