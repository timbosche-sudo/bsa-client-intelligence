import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { FieldError, SelectField, TextField } from '@/components/form/fields';
import { PersonAvatar } from '@/components/PersonAvatar';
import { removeProjectSeat, upsertProjectSeat } from '@/data/mutations';
import type { ClientWorkspace } from '@/data/repository';
import { newId } from '@/domain/ids';
import type { Project, ProjectSeat } from '@/domain/types';
import { currentUserName, run } from '@/state/actions';
import { useStrategyOptions, withCurrent } from '@/features/strategy/options';
import { Section } from './shared';

export function LeadershipTab({ ws, project: p, onEdit }: { ws: ClientWorkspace; project: Project; onEdit(): void }) {
  const d = p.delivery;
  const person = (id: string | null) => (id ? ws.people.find((x) => x.id === id) ?? null : null);
  const [editing, setEditing] = useState<ProjectSeat | null>(null);
  return (
    <div className="flex flex-col gap-8">
      <Section
        title="Delivery leadership"
        actions={
          <div className="flex gap-2">
            <Button size="sm" icon={<Plus size={15} />} onClick={() => setEditing({ id: newId('pseat'), role: '', personId: null })}>Add seat</Button>
            <Button size="sm" variant="ghost" icon={<Pencil size={15} />} onClick={onEdit}>Edit project</Button>
          </div>
        }
      >
        {d.seats.length === 0 ? (
          <p className="text-sm text-subtle">No leadership seats. Use “Add seat” to define the roles this project needs.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {d.seats.map((seat) => {
              const per = person(seat.personId);
              return (
                <li key={seat.id}>
                  <button type="button" onClick={() => setEditing(seat)} className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:border-line-strong hover:bg-surface-2 ${per ? 'border-line bg-surface' : 'border-dashed border-line-strong'}`}>
                    <PersonAvatar person={per} />
                    <span className="min-w-0">
                      <span className={`block truncate text-sm font-bold ${per ? '' : 'text-muted'}`}>{per?.fullName ?? 'Unassigned'}</span>
                      <span className="block truncate text-xs text-subtle">{seat.role}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-2 text-xs text-subtle">Tap a seat to assign someone, rename it or remove it.</p>
      </Section>
      {editing && <SeatDialog ws={ws} project={p} seat={editing} onClose={() => setEditing(null)} />}
      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="Team assignments & resource commitments">
          <p className={`whitespace-pre-wrap text-sm ${d.resourceNotes ? '' : 'text-subtle'}`}>{d.resourceNotes || 'No resource commitments recorded.'}</p>
        </Section>
        <Section title="Dependencies">
          {d.dependencies.length ? (
            <ul className="flex flex-col gap-2 text-sm">
              {d.dependencies.map((x, i) => (
                <li key={i} className="flex gap-2.5"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-ink" aria-hidden />{x}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-subtle">No dependencies recorded.</p>
          )}
        </Section>
      </div>
    </div>
  );
}

function SeatDialog({ ws, project, seat, onClose }: { ws: ClientWorkspace; project: Project; seat: ProjectSeat; onClose(): void }) {
  const o = useStrategyOptions(ws);
  const isNew = !project.delivery.seats.some((s) => s.id === seat.id);
  const [draft, setDraft] = useState(seat);
  const [error, setError] = useState('');
  const save = () => {
    const r = run((d) => upsertProjectSeat(d, project.id, draft, currentUserName()), { clientId: ws.client.id, entity: 'project', entityId: project.id, summary: `${isNew ? 'Added' : 'Updated'} leadership seat "${draft.role.trim()}" on "${project.name}"` });
    if (r.ok) onClose();
    else setError(r.error ?? '');
  };
  const remove = () => {
    if (seat.personId && !window.confirm(`Remove the "${seat.role}" seat? ${ws.people.find((x) => x.id === seat.personId)?.fullName ?? 'The assigned person'} will no longer be listed in it.`)) return;
    const r = run((d) => removeProjectSeat(d, project.id, seat.id, currentUserName()), { clientId: ws.client.id, entity: 'project', entityId: project.id, summary: `Removed leadership seat "${seat.role}" from "${project.name}"` });
    if (r.ok) onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={isNew ? 'Add leadership seat' : 'Leadership seat'}
      size="sm"
      footer={
        <>
          {!isNew && <Button variant="ghost" className="mr-auto" icon={<Trash2 size={15} />} onClick={remove}>Remove seat</Button>}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>{isNew ? 'Add seat' : 'Save'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField label="Seat / role" required value={draft.role} onChange={(v) => setDraft({ ...draft, role: v })} placeholder="e.g. Operational planner" />
        <SelectField label="Assigned to" value={draft.personId} onChange={(v) => setDraft({ ...draft, personId: v || null })} placeholder="Unassigned" options={withCurrent(o.personOptions, draft.personId, 'Inactive person')} />
        {error && <FieldError>{error}</FieldError>}
      </div>
    </Dialog>
  );
}
