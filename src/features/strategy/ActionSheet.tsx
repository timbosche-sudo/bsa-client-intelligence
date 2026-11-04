import { useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { DateField, FormSection, SelectField, TextArea, TextField } from '@/components/form/fields';
import { PeoplePicker } from '@/components/form/PeoplePicker';
import type { ClientWorkspace } from '@/data/repository';
import { blankAction, deleteAction, upsertAction } from '@/data/strategyMutations';
import { ACTION_STATUS_LABELS, PRIORITY_LABELS } from '@/domain/labels';
import type { ActionItem, ActionStatus, Priority } from '@/domain/types';
import { run } from '@/state/actions';
import { SheetFooter } from './SheetFooter';
import { useStrategyOptions, withCurrent } from './options';

export interface ActionSheetProps {
  ws: ClientWorkspace;
  actionId: string | null;
  defaults?: Partial<ActionItem>;
  onClose(): void;
}

export function ActionSheet({ ws, actionId, defaults, onClose }: ActionSheetProps) {
  const existing = actionId ? ws.actions.find((a) => a.id === actionId) ?? null : null;
  const [a, setA] = useState<ActionItem>(() => structuredClone(existing ?? blankAction(ws.client.id, defaults)));
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const o = useStrategyOptions(ws);
  const set = (patch: Partial<ActionItem>) => (setA((x) => ({ ...x, ...patch })), setDirty(true));

  const save = () => {
    if (!a.title.trim()) return setError('Describe the action.');
    const r = run((d) => upsertAction(d, a), { clientId: ws.client.id, entity: 'action', entityId: a.id, summary: `${existing ? 'Updated' : 'Added'} action "${a.title.trim()}"` });
    if (r.ok) onClose();
    else setError(r.error ?? '');
  };

  return (
    <Sheet
      open
      onClose={onClose}
      confirmClose={dirty}
      title={existing ? 'Edit action' : 'New action'}
      description="Actions stay visible across meetings until they are completed or cancelled."
      footer={
        <SheetFooter
          isNew={!existing}
          noun="action"
          error={error}
          onCancel={onClose}
          onSave={save}
          onDelete={() => {
            const r = run((d) => deleteAction(d, a.id), { clientId: ws.client.id, entity: 'action', entityId: a.id, summary: `Deleted action "${a.title}"` });
            if (r.ok) onClose();
          }}
          deleteBlockers={existing?.meetingId ? ['Recorded in a meeting — set its status to Cancelled instead.'] : []}
        />
      }
    >
      <div className="flex flex-col gap-8">
        <FormSection title="Action">
          <TextField label="Action" required value={a.title} onChange={(v) => set({ title: v })} className="sm:col-span-2" />
          <TextArea label="Description" value={a.description} onChange={(v) => set({ description: v })} className="sm:col-span-2" />
          <SelectField label="Status" value={a.status} onChange={(v) => set({ status: v as ActionStatus })} options={Object.entries(ACTION_STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
          <SelectField label="Priority" value={a.priority} onChange={(v) => set({ priority: v as Priority })} options={Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }))} />
          <DateField label="Due date" value={a.dueDate} onChange={(v) => set({ dueDate: v })} />
          <SelectField label="Confidentiality" value={a.confidentiality} onChange={(v) => set({ confidentiality: v as ActionItem['confidentiality'] })} options={o.confidentialityOptions} />
          <SelectField
            label="Commitment"
            value={a.commitment}
            onChange={(v) => set({ commitment: v as ActionItem['commitment'] })}
            options={[{ value: 'proposed', label: 'Proposed request' }, { value: 'confirmed', label: 'Confirmed commitment' }]}
            hint="For client-owned items: mark Confirmed only once the responsible person has agreed."
          />
          {a.status === 'complete' && (
            <>
              <DateField label="Date completed" value={a.completedAt} onChange={(v) => set({ completedAt: v })} hint="Defaults to today when left blank." />
              <TextArea label="Completion notes" value={a.completionNotes} onChange={(v) => set({ completionNotes: v })} className="sm:col-span-2" />
            </>
          )}
        </FormSection>

        <FormSection title="Accountability" description="The owner is accountable. Supporting participants help deliver. Consulted and informed are optional.">
          <SelectField label="Accountable owner" value={a.ownerId} onChange={(v) => set({ ownerId: v || null })} placeholder="Unassigned" options={withCurrent(o.personOptions, a.ownerId, 'Inactive person')} className="sm:col-span-2" />
          <PeoplePicker label="Supporting participants" people={o.people} value={a.participantIds} onChange={(v) => set({ participantIds: v })} exclude={a.ownerId ? [a.ownerId] : []} />
          <PeoplePicker label="Consulted" people={o.people} value={a.consultedIds} onChange={(v) => set({ consultedIds: v })} />
          <PeoplePicker label="Informed" people={o.people} value={a.informedIds} onChange={(v) => set({ informedIds: v })} />
        </FormSection>

        <FormSection title="Links">
          <SelectField label="Workstream" value={a.workstreamId} onChange={(v) => set({ workstreamId: v || null })} placeholder="None" options={withCurrent(o.workstreamOptions, a.workstreamId, 'Archived workstream')} />
          <SelectField label="Initiative" value={a.initiativeId} onChange={(v) => set({ initiativeId: v || null })} placeholder="None" options={withCurrent(o.initiativeOptions, a.initiativeId, 'Archived initiative')} />
          <SelectField label="Related project" value={a.projectId} onChange={(v) => set({ projectId: v || null })} placeholder="None" options={withCurrent(o.projectOptions, a.projectId, 'Archived project')} className="sm:col-span-2" />
          {a.meetingId && <p className="text-xs text-subtle sm:col-span-2">Recorded in a meeting.</p>}
        </FormSection>
      </div>
    </Sheet>
  );
}
