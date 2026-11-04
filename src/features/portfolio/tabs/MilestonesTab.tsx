import { useState } from 'react';
import { Flag, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { DateField, SelectField, TextField, Toggle } from '@/components/form/fields';
import { blankMilestone, deleteMilestone, upsertMilestone } from '@/data/mutations';
import type { ClientWorkspace } from '@/data/repository';
import { CONFIDENTIALITY_LABELS, type Milestone, type Project } from '@/domain/types';
import { formatDate, TBC } from '@/lib/format';
import { run } from '@/state/actions';
import { Section } from './shared';

const STATUS = { upcoming: 'Upcoming', complete: 'Complete', missed: 'Missed', cancelled: 'Cancelled' } as const;

export function MilestonesTab({ ws, project }: { ws: ClientWorkspace; project: Project }) {
  const [editing, setEditing] = useState<Milestone | null>(null);
  const list = ws.milestones.filter((m) => m.projectId === project.id && !m.archivedAt).sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));
  return (
    <Section title="Major milestones" actions={<Button size="sm" variant="primary" icon={<Plus size={15} />} onClick={() => setEditing(blankMilestone(ws.client.id, project.id))}>Add milestone</Button>}>
      {list.length === 0 ? (
        <p className="text-sm text-subtle">No milestones recorded for this project.</p>
      ) : (
        <ol className="flex flex-col divide-y divide-line">
          {list.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => setEditing(m)} className="flex min-h-14 w-full items-center gap-4 py-3 text-left hover:bg-surface-2">
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${m.confirmed ? 'bg-ink text-bg' : 'border border-dashed border-line-strong text-subtle'}`}>
                  <Flag size={15} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{m.title}</span>
                  <span className="block text-xs text-subtle">
                    {m.date ? formatDate(m.date) : m.timingNote || TBC}
                    {!m.confirmed && ' · Unconfirmed'}
                  </span>
                </span>
                <Badge tone={m.status === 'complete' ? 'positive' : m.status === 'missed' ? 'negative' : 'outline'}>{STATUS[m.status]}</Badge>
              </button>
            </li>
          ))}
        </ol>
      )}
      {editing && <MilestoneSheet ws={ws} milestone={editing} onClose={() => setEditing(null)} />}
    </Section>
  );
}

export function MilestoneSheet({ ws, milestone, onClose }: { ws: ClientWorkspace; milestone: Milestone; onClose(): void }) {
  const [m, setM] = useState(milestone);
  const [error, setError] = useState('');
  const isNew = !ws.milestones.some((x) => x.id === milestone.id);
  const save = () => {
    if (!m.title.trim()) return setError('Name the milestone.');
    const r = run((d) => upsertMilestone(d, { ...m, title: m.title.trim() }), { clientId: ws.client.id, entity: 'milestone', entityId: m.id, summary: `${isNew ? 'Added' : 'Updated'} milestone "${m.title.trim()}"` });
    if (r.ok) onClose();
  };
  return (
    <Sheet
      open
      onClose={onClose}
      width="md"
      title={isNew ? 'Add milestone' : 'Edit milestone'}
      footer={
        <>
          {!isNew && (
            <Button
              variant="ghost"
              size="sm"
              className="mr-auto"
              icon={<Trash2 size={15} />}
              onClick={() => {
                if (window.confirm('Delete this milestone?')) {
                  const r = run((d) => deleteMilestone(d, m.id), { clientId: ws.client.id, entity: 'milestone', entityId: m.id, summary: `Deleted milestone "${m.title}"` });
                  if (r.ok) onClose();
                }
              }}
            >
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>Save</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField label="Milestone" required value={m.title} onChange={(v) => setM({ ...m, title: v })} error={error} />
        <DateField label="Date" value={m.date} onChange={(v) => setM({ ...m, date: v })} hint="Leave blank if only approximate timing is known." />
        <TextField label="Timing note" value={m.timingNote} onChange={(v) => setM({ ...m, timingNote: v })} placeholder="e.g. Q2 2027 — anticipated" />
        <SelectField label="Status" value={m.status} onChange={(v) => setM({ ...m, status: v as Milestone['status'] })} options={Object.entries(STATUS).map(([value, label]) => ({ value, label }))} />
        <Toggle label="Confirmed" description="Only confirm dates agreed with the client or leadership." checked={m.confirmed} onChange={(v) => setM({ ...m, confirmed: v })} />
        <SelectField
          label="Confidentiality"
          value={m.confidentiality}
          onChange={(v) => setM({ ...m, confidentiality: v as Milestone['confidentiality'] })}
          options={Object.entries(CONFIDENTIALITY_LABELS).map(([value, label]) => ({ value, label }))}
          hint="Only “Approved for Client Release” milestones appear in client-facing reports."
        />
      </div>
    </Sheet>
  );
}
