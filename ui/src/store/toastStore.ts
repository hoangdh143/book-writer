import { create } from 'zustand'
import { errorMessage } from '../domain/text'

export type ToastKind = 'error' | 'info' | 'success'

export interface Toast {
  readonly id: number
  readonly kind: ToastKind
  readonly message: string
}

interface ToastStore {
  readonly toasts: readonly Toast[]
  readonly push: (kind: ToastKind, message: string) => void
  readonly dismiss: (id: number) => void
}

const nextId = (toasts: readonly Toast[]): number =>
  Math.max(-1, ...toasts.map((toast) => toast.id)) + 1

export const useToastStore = create<ToastStore>()((set) => ({
  toasts: [],
  push: (kind, message) =>
    set((state) => ({ toasts: [...state.toasts, { id: nextId(state.toasts), kind, message }] })),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}))

export const reportMutationError = (error: unknown): void => {
  useToastStore.getState().push('error', errorMessage(error))
}
