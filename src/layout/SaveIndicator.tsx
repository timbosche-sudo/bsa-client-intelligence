import { AlertTriangle, Check, Loader2, Dot } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { useDataStore } from '@/state/store';

/** Reports the true persistence state from the store — never shows "Saved" before the write completes. */
export function SaveIndicator() {
  const { saveState, lastSavedAt, saveError } = useDataStore();
  const map = {
    saved: { icon: <Check size={14} />, text: 'Saved locally', cls: 'text-subtle' },
    pending: { icon: <Dot size={14} />, text: 'Unsaved changes', cls: 'text-caution' },
    saving: { icon: <Loader2 size={14} className="animate-spin" />, text: 'Saving…', cls: 'text-muted' },
    error: { icon: <AlertTriangle size={14} />, text: 'Save failed', cls: 'text-negative' },
  }[saveState];
  const title = saveState === 'error' ? saveError ?? 'Save failed' : lastSavedAt ? `Last saved ${formatDateTime(lastSavedAt)} in this browser` : 'Saved in this browser';
  return (
    <span role="status" aria-live="polite" title={title} className={`hidden items-center gap-1 text-xs xl:inline-flex ${map.cls}`}>
      {map.icon}
      {map.text}
    </span>
  );
}
