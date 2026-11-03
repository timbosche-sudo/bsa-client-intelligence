import { Check, ChevronsUpDown, Settings2 } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CLIENT_STATUS_LABELS } from '@/domain/labels';
import type { Client } from '@/domain/types';
import { listClients } from '@/data/repository';
import { cn } from '@/lib/cn';
import { usePopover } from '@/lib/usePopover';
import { useDataStore } from '@/state/store';

export function Monogram({ client, size = 'md', className }: { client: Pick<Client, 'monogram'>; size?: 'sm' | 'md'; className?: string }) {
  return (
    <span className={cn(className, 'inline-flex shrink-0 items-center justify-center rounded-md bg-accent-soft font-semibold text-accent', size === 'sm' ? 'size-7 text-[10px]' : 'size-8 text-[11px]')}>
      {client.monogram}
    </span>
  );
}

/** Global client selector. Switching keeps the user in the same module of the new workspace. */
export function ClientSelector({ current }: { current: Client }) {
  const data = useDataStore((s) => s.data);
  const { open, setOpen, toggle, ref } = usePopover();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const clients = data ? listClients(data) : [];
  const section = pathname.split('/')[3] ?? 'overview';

  const choose = (id: string) => {
    setOpen(false);
    navigate(`/c/${id}/${section}`);
  };

  return (
    <div ref={ref} className="relative inline-flex min-w-0 max-w-full">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-11 min-w-0 max-w-full items-center gap-2 rounded-lg border border-line bg-surface-2 pl-3 pr-2 text-left hover:border-line-strong sm:max-w-xs sm:gap-2.5 sm:pl-1.5 sm:pr-2.5"
      >
        <Monogram client={current} className="max-sm:hidden" />
        <span className="min-w-0 flex-1">
          <span className="hidden text-[10px] uppercase tracking-[0.12em] text-subtle sm:block">Client workspace</span>
          <span className="block truncate text-sm font-semibold leading-tight">{current.name}</span>
        </span>
        <ChevronsUpDown size={15} className="shrink-0 text-subtle" aria-hidden />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-2 w-72 rounded-xl border border-line bg-surface p-1.5 shadow-2xl">
          <p className="eyebrow px-2.5 pb-1.5 pt-2">Switch client</p>
          <ul role="listbox" aria-label="Client workspaces">
            {clients.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={c.id === current.id}
                  onClick={() => choose(c.id)}
                  className="flex min-h-12 w-full items-center gap-3 rounded-lg px-2.5 text-left hover:bg-surface-3"
                >
                  <Monogram client={c} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{c.name}</span>
                    <span className="block text-xs text-subtle">{CLIENT_STATUS_LABELS[c.status]}</span>
                  </span>
                  {c.id === current.id && <Check size={16} className="text-accent" aria-hidden />}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-1 border-t border-line pt-1">
            <Link
              to={`/c/${current.id}/admin`}
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center gap-3 rounded-lg px-2.5 text-sm text-muted hover:bg-surface-3 hover:text-ink"
            >
              <Settings2 size={16} aria-hidden /> Manage clients
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
