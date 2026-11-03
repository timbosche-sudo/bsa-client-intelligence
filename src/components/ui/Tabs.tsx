import { useRef, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';

export interface TabDef {
  id: string;
  label: string;
  count?: number;
}

/** Accessible tablist (arrow-key navigation), horizontally scrollable on narrow screens. */
export function Tabs({ tabs, value, onChange, label, idPrefix }: { tabs: TabDef[]; value: string; onChange(id: string): void; label: string; idPrefix: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (i + delta + tabs.length) % tabs.length;
    refs.current[next]?.focus();
    onChange(tabs[next].id);
  };
  return (
    <div role="tablist" aria-label={label} className="-mx-4 flex gap-1 overflow-x-auto border-b border-line-strong px-4 sm:mx-0 sm:px-0">
      {tabs.map((t, i) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            id={`${idPrefix}-tab-${t.id}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${t.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              'relative inline-flex min-h-12 shrink-0 items-center gap-2 px-3 text-sm transition-colors',
              selected ? 'font-bold text-ink' : 'text-subtle hover:text-ink',
            )}
          >
            {t.label}
            {t.count !== undefined && <span className="tabular text-xs text-subtle">{t.count}</span>}
            {selected && <span className="absolute inset-x-2 -bottom-px h-0.5 bg-brand" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ idPrefix, id, children }: { idPrefix: string; id: string; children: React.ReactNode }) {
  return (
    <div role="tabpanel" id={`${idPrefix}-panel-${id}`} aria-labelledby={`${idPrefix}-tab-${id}`} className="pt-6" tabIndex={0}>
      {children}
    </div>
  );
}
