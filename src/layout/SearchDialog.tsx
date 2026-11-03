import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, ClipboardCheck, Gavel, Layers, Search, Target, User } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { searchWorkspace, type ClientWorkspace, type SearchKind } from '@/data/repository';
import { cn } from '@/lib/cn';

const icons: Record<SearchKind, typeof Search> = {
  project: BarChart3,
  person: User,
  workstream: Layers,
  initiative: Target,
  action: ClipboardCheck,
  decision: Gavel,
};

/** Workspace-scoped search: only records of the current client are searchable. */
export function SearchDialog({ open, onClose, workspace }: { open: boolean; onClose(): void; workspace: ClientWorkspace }) {
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const navigate = useNavigate();
  const results = useMemo(() => searchWorkspace(workspace, q), [workspace, q]);

  useEffect(() => {
    if (open) {
      setQ('');
      setCursor(0);
    }
  }, [open]);
  useEffect(() => setCursor(0), [q]);

  const go = (i: number) => {
    const r = results[i];
    if (!r) return;
    onClose();
    navigate(r.path);
  };

  return (
    <Dialog open={open} onClose={onClose} title={`Search ${workspace.client.name}`} placement="top" size="md">
      <div className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 focus-within:border-accent">
        <Search size={18} className="text-subtle" aria-hidden />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') (e.preventDefault(), setCursor((c) => Math.min(c + 1, results.length - 1)));
            if (e.key === 'ArrowUp') (e.preventDefault(), setCursor((c) => Math.max(c - 1, 0)));
            if (e.key === 'Enter') go(cursor);
          }}
          placeholder="Projects, people, workstreams, actions…"
          aria-label="Search query"
          className="h-12 flex-1 bg-transparent text-base outline-none placeholder:text-subtle"
        />
      </div>
      <div className="mt-3 min-h-24">
        {q.trim().length < 2 ? (
          <p className="px-1 py-6 text-center text-sm text-subtle">Type at least two characters. Search covers this client workspace only.</p>
        ) : results.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-subtle">No matching records in {workspace.client.name}.</p>
        ) : (
          <ul role="listbox" aria-label="Search results" className="flex flex-col gap-0.5">
            {results.map((r, i) => {
              const Icon = icons[r.kind];
              return (
                <li key={`${r.kind}-${r.id}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === cursor}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => go(i)}
                    className={cn('flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left', i === cursor ? 'bg-surface-3' : 'hover:bg-surface-2')}
                  >
                    <Icon size={16} className="shrink-0 text-subtle" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{r.title}</span>
                      <span className="block truncate text-xs text-subtle">{r.subtitle}</span>
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-subtle">{r.kind}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
