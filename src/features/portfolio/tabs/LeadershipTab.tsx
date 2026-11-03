import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PersonAvatar } from '@/components/PersonAvatar';
import type { ClientWorkspace } from '@/data/repository';
import type { Project } from '@/domain/types';
import { Section } from './shared';

export function LeadershipTab({ ws, project: p, onEdit }: { ws: ClientWorkspace; project: Project; onEdit(): void }) {
  const d = p.delivery;
  const person = (id: string | null) => (id ? ws.people.find((x) => x.id === id) ?? null : null);
  const roles: [string, string | null][] = [
    ['Project executive', d.projectExecutiveId],
    ['Project manager', d.projectManagerId],
    ['Design leader', d.designLeaderId],
    ['Planning leader', d.planningLeaderId],
    ['Engineering leader', d.engineeringLeaderId],
    ...d.disciplineLeads.map((l): [string, string | null] => [`${l.discipline} lead`, l.personId]),
  ];
  return (
    <div className="flex flex-col gap-8">
      <Section title="Delivery leadership" actions={<Button size="sm" icon={<Pencil size={15} />} onClick={onEdit}>Edit</Button>}>
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {roles.map(([role, id]) => {
            const per = person(id);
            return (
              <li key={role} className={`flex items-center gap-3 rounded-lg border p-3 ${per ? 'border-line bg-surface' : 'border-dashed border-line-strong'}`}>
                <PersonAvatar person={per} />
                <div className="min-w-0">
                  <p className={`truncate text-sm font-bold ${per ? '' : 'text-muted'}`}>{per?.fullName ?? 'Unassigned'}</p>
                  <p className="truncate text-xs text-subtle">{role}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </Section>
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
