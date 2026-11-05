import { useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { FormSection, ListField, SelectField, TextArea, TextField } from '@/components/form/fields';
import { active, type ClientWorkspace } from '@/data/repository';
import { blankWorkstream, deleteWorkstream, findWorkstreamReferences, setWorkstreamArchived, upsertWorkstream } from '@/data/strategyMutations';
import { WORKSTREAM_STATUS_LABELS } from '@/domain/labels';
import type { Workstream, WorkstreamStatus } from '@/domain/types';
import { run } from '@/state/actions';
import { useDataStore } from '@/state/store';
import { SheetFooter } from './SheetFooter';
import { useStrategyOptions, withCurrent } from './options';

export function WorkstreamSheet({ ws, workstreamId, onClose }: { ws: ClientWorkspace; workstreamId: string | null; onClose(): void }) {
  const data = useDataStore((s) => s.data)!;
  const existing = workstreamId ? ws.workstreams.find((w) => w.id === workstreamId) ?? null : null;
  const [w, setW] = useState<Workstream>(() => structuredClone(existing ?? blankWorkstream(ws.client.id, active(ws.workstreams).length + 1)));
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const o = useStrategyOptions(ws);
  const set = (patch: Partial<Workstream>) => (setW((x) => ({ ...x, ...patch })), setDirty(true));
  const save = () => {
    if (!w.title.trim()) return setError('Give the initiative a title.');
    const r = run((d) => upsertWorkstream(d, w), { clientId: ws.client.id, entity: 'workstream', entityId: w.id, summary: `${existing ? 'Updated' : 'Added'} initiative "${w.title.trim()}"` });
    if (r.ok) onClose();
    else setError(r.error ?? '');
  };
  return (
    <Sheet
      open
      onClose={onClose}
      confirmClose={dirty}
      title={existing ? 'Edit initiative' : 'New initiative'}
      footer={
        <SheetFooter
          isNew={!existing}
          noun="initiative"
          error={error}
          onCancel={onClose}
          onSave={save}
          archived={!!existing?.archivedAt}
          onArchiveToggle={() => {
            const r = run((d) => setWorkstreamArchived(d, w.id, !existing?.archivedAt), { clientId: ws.client.id, entity: 'workstream', entityId: w.id, summary: `${existing?.archivedAt ? 'Restored' : 'Archived'} initiative "${w.title}"` });
            if (r.ok) onClose();
          }}
          onDelete={() => {
            const r = run((d) => deleteWorkstream(d, w.id), { clientId: ws.client.id, entity: 'workstream', entityId: w.id, summary: `Deleted initiative "${w.title}"` });
            if (r.ok) onClose();
          }}
          deleteBlockers={existing ? findWorkstreamReferences(data, existing.id) : []}
        />
      }
    >
      <div className="flex flex-col gap-8">
        <FormSection title="Initiative">
          <TextField label="Title" required value={w.title} onChange={(v) => set({ title: v })} className="sm:col-span-2" />
          <TextArea label="Purpose" value={w.purpose} onChange={(v) => set({ purpose: v })} className="sm:col-span-2" />
          <ListField label="Focus areas" value={w.topics} onChange={(v) => set({ topics: v })} rows={6} className="sm:col-span-2" />
          <TextField label="Desired outcome / deliverable" value={w.deliverable} onChange={(v) => set({ deliverable: v })} className="sm:col-span-2" />
          <SelectField label="Accountable champion" value={w.championId} onChange={(v) => set({ championId: v || null })} placeholder="Unassigned" options={withCurrent(o.personOptions, w.championId, 'Inactive person')} />
          <SelectField label="Status" value={w.status} onChange={(v) => set({ status: v as WorkstreamStatus })} options={Object.entries(WORKSTREAM_STATUS_LABELS).filter(([k]) => k !== 'archived').map(([value, label]) => ({ value, label }))} />
        </FormSection>
        <FormSection title="Confidentiality">
          <SelectField label="Classification" value={w.confidentiality} onChange={(v) => set({ confidentiality: v as Workstream['confidentiality'] })} options={o.confidentialityOptions} />
          <TextArea label="Confidentiality note" value={w.confidentialityNote} onChange={(v) => set({ confidentialityNote: v })} rows={2} hint="e.g. internal performance discussions are Internal Only." />
        </FormSection>
      </div>
    </Sheet>
  );
}
