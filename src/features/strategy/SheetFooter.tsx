import { useState } from 'react';
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FieldError } from '@/components/form/fields';

interface Props {
  isNew: boolean;
  noun: string;
  error?: string;
  onCancel(): void;
  onSave(): void;
  archived?: boolean;
  onArchiveToggle?(): void;
  onDelete?(): void;
  /** References that block deletion (shown instead of the delete confirmation). */
  deleteBlockers?: string[];
}

/** Consistent footer for record sheets: save, archive/restore, and guarded permanent delete. */
export function SheetFooter({ isNew, noun, error, onCancel, onSave, archived, onArchiveToggle, onDelete, deleteBlockers = [] }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <>
      {error && <span className="w-full sm:mr-auto sm:w-auto"><FieldError>{error}</FieldError></span>}
      {!isNew && (onArchiveToggle || onDelete) && (
        <div className="mr-auto flex gap-1">
          {onArchiveToggle && (
            <Button size="sm" variant="ghost" icon={archived ? <ArchiveRestore size={15} /> : <Archive size={15} />} onClick={onArchiveToggle}>
              {archived ? 'Restore' : 'Archive'}
            </Button>
          )}
          {onDelete && (
            <Button size="sm" variant="ghost" icon={<Trash2 size={15} />} onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          )}
        </div>
      )}
      <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      <Button variant="primary" onClick={onSave}>{isNew ? `Add ${noun}` : 'Save changes'}</Button>
      {onDelete && (
        <ConfirmDialog
          open={confirmDelete}
          title={`Delete this ${noun}?`}
          confirmLabel="Delete permanently"
          tone="danger"
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            onDelete();
          }}
          blockedReason={
            deleteBlockers.length ? (
              <>
                It is linked to other records, so deleting it would break history. {onArchiveToggle ? 'Archive it instead.' : ''}
                <ul className="mt-2 list-disc pl-5 text-muted">
                  {deleteBlockers.slice(0, 5).map((r, i) => <li key={i}>{r}</li>)}
                  {deleteBlockers.length > 5 && <li>+ {deleteBlockers.length - 5} more</li>}
                </ul>
              </>
            ) : undefined
          }
        >
          Permanent deletion cannot be undone.
        </ConfirmDialog>
      )}
    </>
  );
}
