import { useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { FormSection, SelectField, TextArea, TextField } from '@/components/form/fields';
import type { ClientWorkspace } from '@/data/repository';
import { blankRisk, deleteRisk, upsertRisk } from '@/data/strategyMutations';
import { SEVERITY_LABELS } from '@/domain/labels';
import type { Risk, RiskKind, RiskSeverity } from '@/domain/types';
import { run } from '@/state/actions';
import { SheetFooter } from './SheetFooter';
import { useStrategyOptions, withCurrent } from './options';

export const RISK_KIND_LABELS: Record<RiskKind, string> = { risk: 'Risk', issue: 'Issue', opportunity: 'Opportunity' };
export const RISK_STATUS_LABELS: Record<Risk['status'], string> = { open: 'Open', monitoring: 'Monitoring', closed: 'Closed' };

export function RiskSheet({ ws, riskId, defaults, onClose }: { ws: ClientWorkspace; riskId: string | null; defaults?: Partial<Risk>; onClose(): void }) {
  const existing = riskId ? ws.risks.find((r) => r.id === riskId) ?? null : null;
  const [r, setR] = useState<Risk>(() => structuredClone(existing ?? blankRisk(ws.client.id, defaults)));
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const o = useStrategyOptions(ws);
  const set = (patch: Partial<Risk>) => (setR((x) => ({ ...x, ...patch })), setDirty(true));
  const save = () => {
    if (!r.title.trim()) return setError('Give it a title.');
    const res = run((d) => upsertRisk(d, r), { clientId: ws.client.id, entity: 'risk', entityId: r.id, summary: `${existing ? 'Updated' : 'Added'} ${RISK_KIND_LABELS[r.kind].toLowerCase()} "${r.title.trim()}"` });
    if (res.ok) onClose();
    else setError(res.error ?? '');
  };
  return (
    <Sheet
      open
      onClose={onClose}
      confirmClose={dirty}
      title={existing ? `Edit ${RISK_KIND_LABELS[r.kind].toLowerCase()}` : 'New risk, issue or opportunity'}
      description="Severity stays Not Assessed until someone accountable assesses it."
      footer={
        <SheetFooter
          isNew={!existing}
          noun={RISK_KIND_LABELS[r.kind].toLowerCase()}
          error={error}
          onCancel={onClose}
          onSave={save}
          onDelete={() => {
            const res = run((d) => deleteRisk(d, r.id), { clientId: ws.client.id, entity: 'risk', entityId: r.id, summary: `Deleted "${r.title}"` });
            if (res.ok) onClose();
          }}
          deleteBlockers={existing?.meetingId ? ['Flagged in a meeting — set its status to Closed instead.'] : []}
        />
      }
    >
      <div className="flex flex-col gap-8">
        <FormSection title="Details">
          <SelectField label="Type" value={r.kind} onChange={(v) => set({ kind: v as RiskKind })} options={Object.entries(RISK_KIND_LABELS).map(([value, label]) => ({ value, label }))} />
          <SelectField label="Status" value={r.status} onChange={(v) => set({ status: v as Risk['status'] })} options={Object.entries(RISK_STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
          <TextField label="Title" required value={r.title} onChange={(v) => set({ title: v })} className="sm:col-span-2" />
          <TextArea label="Description" value={r.description} onChange={(v) => set({ description: v })} className="sm:col-span-2" />
          <SelectField label="Severity" value={r.severity} onChange={(v) => set({ severity: v as RiskSeverity })} options={Object.entries(SEVERITY_LABELS).map(([value, label]) => ({ value, label }))} hint="High and Critical open risks and issues appear on the Client Overview." />
          <SelectField label="Owner" value={r.ownerId} onChange={(v) => set({ ownerId: v || null })} placeholder="Unassigned" options={withCurrent(o.personOptions, r.ownerId, 'Inactive person')} />
          <TextArea label={r.kind === 'opportunity' ? 'Pursuit approach' : 'Mitigation / response'} value={r.mitigation} onChange={(v) => set({ mitigation: v })} className="sm:col-span-2" />
          <SelectField label="Confidentiality" value={r.confidentiality} onChange={(v) => set({ confidentiality: v as Risk['confidentiality'] })} options={o.confidentialityOptions} />
        </FormSection>
        <FormSection title="Links">
          <SelectField label="Workstream" value={r.workstreamId} onChange={(v) => set({ workstreamId: v || null })} placeholder="None" options={withCurrent(o.workstreamOptions, r.workstreamId, 'Archived workstream')} />
          <SelectField label="Initiative" value={r.initiativeId} onChange={(v) => set({ initiativeId: v || null })} placeholder="None" options={withCurrent(o.initiativeOptions, r.initiativeId, 'Archived initiative')} />
          <SelectField label="Related project" value={r.projectId} onChange={(v) => set({ projectId: v || null })} placeholder="None" options={withCurrent(o.projectOptions, r.projectId, 'Archived project')} className="sm:col-span-2" />
        </FormSection>
      </div>
    </Sheet>
  );
}
