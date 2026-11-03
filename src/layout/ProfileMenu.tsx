import { Download, Moon, Sun, UserRound } from 'lucide-react';
import { prototypeAuth } from '@/auth/session';
import { buildBackup, backupFilename, downloadJson } from '@/services/backup';
import { usePopover } from '@/lib/usePopover';
import { usePreferences } from '@/state/preferences';
import { useDataStore } from '@/state/store';
import { PrototypeBadge } from './PrototypeBadge';

export function ProfileMenu() {
  const { open, setOpen, toggle, ref } = usePopover();
  const user = prototypeAuth.getCurrentUser();
  const theme = usePreferences((s) => s.theme);
  const setTheme = usePreferences((s) => s.setTheme);
  const data = useDataStore((s) => s.data);

  const exportBackup = async () => {
    if (!data) return;
    await useDataStore.getState().flush();
    downloadJson(backupFilename(), buildBackup(useDataStore.getState().data ?? data));
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Profile and settings"
        className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-surface-2 text-muted hover:text-ink"
      >
        <UserRound size={18} aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-2 w-72 rounded-xl border border-line bg-surface p-1.5 shadow-2xl">
          <div className="px-2.5 py-2.5">
            <p className="text-sm font-semibold">{user.displayName}</p>
            <p className="mt-0.5 text-xs text-subtle">Not signed in · role shown for layout only</p>
            <PrototypeBadge className="mt-2.5" />
          </div>
          <div className="border-t border-line pt-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm hover:bg-surface-3"
            >
              {theme === 'dark' ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
              {theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            </button>
            <button type="button" role="menuitem" onClick={exportBackup} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm hover:bg-surface-3">
              <Download size={16} aria-hidden /> Export backup (JSON)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
