import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface DialogProps {
  open: boolean;
  onClose(): void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Position at the top (command palette style) instead of centered. */
  placement?: 'center' | 'top';
}

/** Accessible modal built on the native <dialog> element (focus trap, Esc, inert background). */
export function Dialog({ open, onClose, title, description, children, footer, size = 'md', placement = 'center' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className={cn(
        'w-[calc(100%-2rem)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm',
        placement === 'top' ? 'mx-auto mt-[10vh]' : 'm-auto',
        { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' }[size],
      )}
    >
      {open && (
        <div className="flex max-h-[80dvh] flex-col">
          <header className="flex items-start gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold">{title}</h2>
              {description && <p className="mt-1 text-sm text-muted">{description}</p>}
            </div>
            <button type="button" onClick={onClose} className="-m-2 inline-flex size-11 items-center justify-center rounded-lg text-muted hover:bg-surface-3 hover:text-ink" aria-label="Close">
              <X size={18} />
            </button>
          </header>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
