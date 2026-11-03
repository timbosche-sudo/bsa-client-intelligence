import { CheckCircle2, Info, X, AlertCircle } from 'lucide-react';
import { useToasts } from '@/state/toast';

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 safe-bottom sm:items-end">
      {toasts.map((t) => (
        <div key={t.id} role={t.tone === 'error' ? 'alert' : 'status'} className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-line-strong bg-surface-2 px-4 py-3 text-sm text-ink shadow-2xl">
          {t.tone === 'success' ? <CheckCircle2 size={18} className="shrink-0 text-positive" aria-hidden /> : t.tone === 'error' ? <AlertCircle size={18} className="shrink-0 fill-brand text-white" aria-hidden /> : <Info size={18} className="shrink-0 text-accent" aria-hidden />}
          <p className="flex-1">{t.message}</p>
          <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="-m-2 inline-flex size-9 items-center justify-center rounded-full text-subtle hover:text-ink">
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}
