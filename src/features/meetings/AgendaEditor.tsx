import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ListField, NumberField, TextArea, TextField } from '@/components/form/fields';
import { agendaMinutes } from '@/data/meetingSelectors';
import { newId } from '@/domain/ids';
import type { AgendaItem } from '@/domain/types';

/** Editable agenda: titles, durations, purpose and prompts; add, remove and reorder. */
export function AgendaEditor({ agenda, onChange }: { agenda: AgendaItem[]; onChange(a: AgendaItem[]): void }) {
  const set = (id: string, patch: Partial<AgendaItem>) => onChange(agenda.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const move = (i: number, d: number) => {
    const next = [...agenda];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x);
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <p className="eyebrow text-ink">Agenda</p>
        <p className="tabular text-sm text-muted">Total {agendaMinutes(agenda)} min</p>
      </div>
      <ol className="flex flex-col gap-3">
        {agenda.map((a, i) => (
          <li key={a.id} className="rounded-lg border border-line bg-surface p-3">
            <div className="mb-2 flex items-center gap-1">
              <span className="tabular flex size-8 items-center justify-center rounded-full border border-line-strong text-xs font-bold">{i + 1}</span>
              <span className="flex-1" />
              <Button size="sm" variant="ghost" iconOnly icon={<ArrowUp size={15} />} aria-label={`Move ${a.title || 'item'} up`} disabled={i === 0} onClick={() => move(i, -1)} />
              <Button size="sm" variant="ghost" iconOnly icon={<ArrowDown size={15} />} aria-label={`Move ${a.title || 'item'} down`} disabled={i === agenda.length - 1} onClick={() => move(i, 1)} />
              <Button size="sm" variant="ghost" iconOnly icon={<Trash2 size={15} />} aria-label={`Remove ${a.title || 'item'}`} onClick={() => onChange(agenda.filter((x) => x.id !== a.id))} />
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
              <TextField label="Topic" required value={a.title} onChange={(v) => set(a.id, { title: v })} />
              <NumberField label="Minutes" value={a.minutes} onChange={(v) => set(a.id, { minutes: v ?? 0 })} min={0} step={1} />
              <TextArea label="Purpose" rows={2} value={a.purpose} onChange={(v) => set(a.id, { purpose: v })} className="sm:col-span-2" />
              <ListField label="Facilitator prompts" rows={2} value={a.prompts} onChange={(v) => set(a.id, { prompts: v })} className="sm:col-span-2" />
            </div>
          </li>
        ))}
      </ol>
      <Button className="self-start" icon={<Plus size={16} />} onClick={() => onChange([...agenda, { id: newId('ag'), title: '', minutes: 10, purpose: '', prompts: [] }])}>
        Add agenda item
      </Button>
    </div>
  );
}
