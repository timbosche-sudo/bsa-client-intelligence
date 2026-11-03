import { useId } from 'react';
import { X } from 'lucide-react';
import type { Person } from '@/domain/types';
import { PersonAvatar } from '../PersonAvatar';

/** Multi-select for people: removable chips plus a native "Add" select (touch-friendly, accessible). */
export function PeoplePicker({ label, hint, people, value, onChange, exclude = [] }: { label: string; hint?: string; people: Person[]; value: string[]; onChange(ids: string[]): void; exclude?: string[] }) {
  const id = useId();
  const selected = value.map((v) => people.find((p) => p.id === v)).filter((p): p is Person => !!p);
  const available = people.filter((p) => !value.includes(p.id) && !exclude.includes(p.id) && p.active && !p.archivedAt);
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-bold">{label}</label>
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={`${label}: selected`}>
          {selected.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-full border border-line bg-surface-2 py-1 pl-1 pr-1 text-sm">
              <PersonAvatar person={p} size="sm" className="size-7" />
              <span>{p.fullName}</span>
              <button type="button" onClick={() => onChange(value.filter((v) => v !== p.id))} className="inline-flex size-9 items-center justify-center rounded-full text-subtle hover:bg-surface-3 hover:text-ink" aria-label={`Remove ${p.fullName}`}>
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <select
        id={id}
        value=""
        onChange={(e) => e.target.value && onChange([...value, e.target.value])}
        disabled={!available.length}
        className="h-12 w-full rounded-lg border border-line bg-surface px-3 text-base text-muted outline-none focus:border-accent disabled:opacity-50 sm:text-sm"
      >
        <option value="">{available.length ? 'Add a person…' : 'No other people available'}</option>
        {available.map((p) => (
          <option key={p.id} value={p.id}>
            {p.fullName}
            {p.affiliation === 'client' ? ' (client)' : p.affiliation === 'external' ? ' (external)' : ''}
          </option>
        ))}
      </select>
      {hint && <p className="text-xs text-subtle">{hint}</p>}
    </div>
  );
}
