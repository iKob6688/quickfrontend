import { create } from 'zustand'

export type ToastTone = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  tone: ToastTone
  title: string
  message?: string
  createdAt: number
}

interface ToastState {
  toasts: ToastItem[]
  push: (toast: Omit<ToastItem, 'id' | 'createdAt'> & { id?: string }) => string
  remove: (id: string) => void
  clear: () => void
}

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (toast) => {
    const id = toast.id ?? uid()
    const item: ToastItem = {
      id,
      tone: toast.tone,
      title: toast.title,
      message: toast.message,
      createdAt: Date.now(),
    }
    set({ toasts: [...get().toasts, item].slice(-5) })
    return id
  },
  remove: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  clear: () => set({ toasts: [] }),
}))

export const toast = {
  success: (title: string, message?: string) =>
    useToastStore.getState().push({ tone: 'success', title, message }),
  error: (title: string, message?: string) =>
    useToastStore.getState().push({ tone: 'error', title, message }),
  info: (title: string, message?: string) =>
    useToastStore.getState().push({ tone: 'info', title, message }),
}


