import { useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { DateField, FormSection, SelectField, TextArea, TextField } from '@/components/form/fields';
import { PeoplePicker } from '@/components/form/PeoplePicker';
import type { ClientWorkspace } from '@/data/repository';
import { blankInitiative, deleteInitiative, findInitiativeReferences, setInitiativeArchived, upsertInitiative } from '@/data/strategyMutations';
import { INITIATIVE_STATUS_LABELS } from '@/domain/labels';
import type { Initiative, InitiativeStatus } from '@/domain/types';
import { run } from '@/state/actions';
import { useDataStore } from '@/state/store';
import { SheetFooter } from './SheetFooter';
import { useStrategyOptions, withCurrent } from './options';

export function InitiativeSheet({ ws, initiativeId, defaults, onClose, onDeleted }: { ws: ClientWorkspace; initiativeId: string | null; defaults?: Partial<Initiative>; onClose(): void; onDeleted?(): void }) {
  const data = useDataStore((s) => s.data)!;
  const existing = initiativeId ? ws.initiatives.find((i) => i.id === initiativeId) ?? null : null;
  const [x, setX] = useState<Initiative>(() => structuredClone(existing ?? { ...blankInitiative(ws.client.id), ...defaults }));
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const o = useStrategyOptions(ws);
  const set = (patch: Partial<Initiative>) => (setX((v) => ({ ...v, ...patch })), setDirty(true));
  const save = () => {
    if (!x.title.trim()) return setError('Give the initiative a title.');
    const r = run((d) => upsertInitiative(d, x), { clientId: ws.client.id, entity: 'initiative', entityId: x.id, summary: `${existing ? 'Updated' : 'Added'} initiative "${x.title.trim()}"` });
    if (r.ok) onClose();
    else setError(r.error ?? '');
  };
  const projects = o.projectOptions.filter((p) => !x.relatedProjectIds.includes(p.value));
  return (
    <Sheet
      open
      onClose={onClose}
      confirmClose={dirty}
      title={existing ? 'Edit initiative' : 'New initiative'}
      description="A strategic effort within a workstream, led by an accountable champion."
      footer={
        <SheetFooter
          isNew={!existing}
          noun="initiative"
          error={error}
          onCancel={onClose}
          onSave={save}
          archived={!!existing?.archivedAt}
          onArchiveToggle={() => {
            const r = run((d) => setInitiativeArchived(d, x.id, !existing?.archivedAt), { clientId: ws.client.id, entity: 'initiative', entityId: x.id, summary: `${existing?.archivedAt ? 'Restored' : 'Archived'} initiative "${x.title}"` });
            if (r.ok) onClose();
          }}
          onDelete={() => {
            const r = run((d) => deleteInitiative(d, x.id), { clientId: ws.client.id, entity: 'initiative', entityId: x.id, summary: `Deleted initiative "${x.title}"` });
            if (r.ok) (onClose(), onDeleted?.());
          }}
          deleteBlockers={existing ? findInitiativeReferences(data, existing.id) : []}
        />
      }
    >
      <div className="flex flex-col gap-8">
        <FormSection title="Initiative">
          <TextField label="Title" required value={x.title} onChange={(v) => set({ title: v })} className="sm:col-span-2" />
          <TextArea label="Description" value={x.description} onChange={(v) => set({ description: v })} className="sm:col-span-2" />
          <TextArea label="Desired outcome" value={x.desiredOutcome} onChange={(v) => set({ desiredOutcome: v })} rows={2} className="sm:col-span-2" />
          <SelectField label="Workstream" value={x.workstreamId} onChange={(v) => set({ workstreamId: v || null })} placeholder="None" options={withCurrent(o.workstreamOptions, x.workstreamId, 'Archived workstream')} />
          <SelectField label="Status" value={x.status} onChange={(v) => set({ status: v as InitiativeStatus })} options={Object.entries(INITIATIVE_STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
          <DateField label="Target date" value={x.targetDate} onChange={(v) => set({ targetDate: v })} />
          <SelectField label="Confidentiality" value={x.confidentiality} onChange={(v) => set({ confidentiality: v as Initiative['confidentiality'] })} options={o.confidentialityOptions} />
        </FormSection>
        <FormSection title="Accountability">
          <SelectField label="Accountable champion" value={x.championId} onChange={(v) => set({ championId: v || null })} placeholder="Unassigned" options={withCurrent(o.personOptions, x.championId, 'Inactive person')} className="sm:col-span-2" />
          <PeoplePicker label="Supporting participants" people={o.people} value={x.participantIds} onChange={(v) => set({ participantIds: v })} exclude={x.championId ? [x.championId] : []} />
          <PeoplePicker label="Consulted" people={o.people} value={x.consultedIds} onChange={(v) => set({ consultedIds: v })} />
          <PeoplePicker label="Informed" people={o.people} value={x.informedIds} onChange={(v) => set({ informedIds: v })} />
        </FormSection>
        <FormSection title="Related projects & notes">
          <div className="flex flex-col gap-2 sm:col-span-2">
            {x.relatedProjectIds.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {x.relatedProjectIds.map((id) => (
                  <li key={id} className="flex items-center gap-1 rounded-full border border-line bg-surface-2 pl-3 text-sm">
                    {o.projectOptions.find((p) => p.value === id)?.label ?? 'Archived project'}
                    <button type="button" aria-label="Remove project" onClick={() => set({ relatedProjectIds: x.relatedProjectIds.filter((p) => p !== id) })} className="inline-flex size-9 items-center justify-center rounded-full text-subtle hover:text-ink">×</button>
                  </li>
                ))}
              </ul>
            )}
            <SelectField label="Add related project" value="" onChange={(v) => v && set({ relatedProjectIds: [...x.relatedProjectIds, v] })} placeholder={projects.length ? 'Select a project…' : 'No other projects'} options={projects} />
          </div>
          <TextArea label="Notes" value={x.notes} onChange={(v) => set({ notes: v })} className="sm:col-span-2" />
        </FormSection>
      </div>
    </Sheet>
  );
}
