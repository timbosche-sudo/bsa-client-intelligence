import type { ReactNode } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm(): void;
  onClose(): void;
  tone?: 'danger' | 'default';
  /** When set, confirmation is blocked and this explanation is shown instead. */
  blockedReason?: ReactNode;
}

export function ConfirmDialog({ open, title, children, confirmLabel, onConfirm, onClose, tone = 'default', blockedReason }: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {blockedReason ? 'Close' : 'Cancel'}
          </Button>
          {!blockedReason && (
            <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          )}
        </>
      }
    >
      <div className="text-sm text-muted">{children}</div>
      {blockedReason && <div className="mt-3 border-l-2 border-brand bg-surface-2 px-3 py-2 text-sm text-ink">{blockedReason}</div>}
    </Dialog>
  );
}
