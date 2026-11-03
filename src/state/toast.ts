import { create } from 'zustand';

export interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'info';
}

interface ToastState {
  toasts: Toast[];
  push(message: string, tone?: Toast['tone']): void;
  dismiss(id: number): void;
}

let seq = 0;
export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push(message, tone = 'success') {
    const id = ++seq;
    set({ toasts: [...get().toasts, { id, message, tone }].slice(-4) });
    setTimeout(() => get().dismiss(id), tone === 'error' ? 8000 : 4000);
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

export const toast = (message: string, tone?: Toast['tone']) => useToasts.getState().push(message, tone);
