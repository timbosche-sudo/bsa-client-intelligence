import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { Wordmark } from '@/brand/Wordmark';
import { NavList } from './Sidebar';
import { PrototypeBadge } from './PrototypeBadge';

/** Slide-in navigation drawer for phones and iPad portrait (<1024px). */
export function MobileNav({ open, onClose, clientId }: { open: boolean; onClose(): void; clientId: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { pathname } = useLocation();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  useEffect(() => onClose(), [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <dialog
      ref={ref}
      onCancel={(e) => (e.preventDefault(), onClose())}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label="Navigation"
      className="m-0 h-dvh max-h-dvh w-[min(20rem,85vw)] max-w-none border-r border-line bg-surface p-0 text-ink backdrop:bg-black/60 lg:hidden"
    >
      <div className="flex h-full flex-col safe-top safe-bottom">
        <div className="flex h-16 items-center justify-between border-b border-line pl-5 pr-2">
          <Wordmark />
          <button type="button" onClick={onClose} className="inline-flex size-11 items-center justify-center rounded-lg text-muted hover:bg-surface-3" aria-label="Close navigation">
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-3" aria-label="Primary">
          <NavList clientId={clientId} />
        </nav>
        <div className="border-t border-line p-3">
          <PrototypeBadge variant="panel" />
        </div>
      </div>
    </dialog>
  );
}
