import { RefreshCw } from 'lucide-react';
import { create } from 'zustand';

/** Set when a newer deployed version has taken over the app's offline cache while this tab was open. */
export const useAppUpdate = create<{ available: boolean }>(() => ({ available: false }));

/** Prompts the user to reload so an open tab never keeps running an outdated version. Data is saved locally. */
export function UpdateBanner() {
  const available = useAppUpdate((s) => s.available);
  if (!available) return null;
  return (
    <div role="status" className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-xl items-center gap-3 rounded-xl border border-line-strong bg-surface p-3 pl-4 shadow-lg safe-bottom">
      <p className="flex-1 text-sm">A new version of the app is available.</p>
      <button type="button" onClick={() => window.location.reload()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-bold text-brand-contrast hover:bg-brand-strong">
        <RefreshCw size={15} aria-hidden /> Reload
      </button>
    </div>
  );
}
