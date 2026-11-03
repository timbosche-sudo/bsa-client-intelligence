import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface SheetProps {
  open: boolean;
  onClose(): void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'md' | 'lg' | 'xl';
  /** Ask before closing when there are unsaved edits. */
  confirmClose?: boolean;
}

/**
 * Side sheet for editing (right edge on tablet/desktop, full screen on phones).
 * Built on <dialog> for focus trapping, Escape and inert background.
 */
export function Sheet({ open, onClose, title, description, children, footer, width = 'lg', confirmClose }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const requestClose = () => {
    if (confirmClose && !window.confirm('Discard unsaved changes?')) return;
    onClose();
  };

  return (
    <dialog
      ref={ref}
      onCancel={(e) => (e.preventDefault(), requestClose())}
      onClick={(e) => e.target === ref.current && requestClose()}
      aria-label={title}
      className={cn(
        'm-0 ml-auto h-dvh max-h-dvh w-full max-w-none border-l border-line bg-bg p-0 text-ink backdrop:bg-black/70',
        { md: 'sm:w-[min(32rem,100vw)]', lg: 'sm:w-[min(42rem,100vw)]', xl: 'sm:w-[min(56rem,100vw)]' }[width],
      )}
    >
      {open && (
        <div className="flex h-full flex-col safe-top safe-bottom">
          <header className="flex items-start gap-4 border-b border-line-strong px-5 py-4 sm:px-6">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-black tracking-tight">{title}</h2>
              {description && <div className="mt-1 text-sm text-muted">{description}</div>}
            </div>
            <button type="button" onClick={requestClose} className="-m-2 inline-flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface-3 hover:text-ink" aria-label="Close">
              <X size={20} />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
          {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line-strong bg-surface px-5 py-3 sm:px-6">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
