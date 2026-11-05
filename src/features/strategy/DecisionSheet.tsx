import { useState } from 'react';
import { Info } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { DateField, FormSection, SelectField, TextArea, TextField } from '@/components/form/fields';
import { PeoplePicker } from '@/components/form/PeoplePicker';
import type { ClientWorkspace } from '@/data/repository';
import { blankDecision, deleteDecision, findDecisionReferences, setDecisionArchived, upsertDecision, validateDecision } from '@/data/strategyMutations';
import { DECISION_STATUS_LABELS } from '@/domain/labels';
import type { Decision, DecisionStatus } from '@/domain/types';
import { run } from '@/state/actions';
import { useDataStore } from '@/state/store';
import { SheetFooter } from './SheetFooter';
import { useStrategyOptions, withCurrent } from './options';

export interface DecisionSheetProps {
  ws: ClientWorkspace;
  decisionId: string | null;
  defaults?: Partial<Decision>;
  onClose(): void;
}

export function DecisionSheet({ ws, decisionId, defaults, onClose }: DecisionSheetProps) {
  const data = useDataStore((s) => s.data)!;
  const existing = decisionId ? ws.decisions.find((x) => x.id === decisionId) ?? null : null;
  const [x, setX] = useState<Decision>(() => structuredClone(existing ?? blankDecision(ws.client.id, defaults)));
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const o = useStrategyOptions(ws);
  const set = (patch: Partial<Decision>) => (setX((v) => ({ ...v, ...patch })), setDirty(true));
  const approval = x.approval ?? { approvedById: null, approvedAt: null, note: '' };
  const setApproval = (patch: Partial<typeof approval>) => set({ approval: { ...approval, ...patch } });
  const others = ws.decisions.filter((d) => d.id !== x.id && !d.archivedAt).map((d) => ({ value: d.id, label: `${d.title} (${DECISION_STATUS_LABELS[d.status]})` }));

  const save = () => {
    const problems = validateDecision(data, x);
    if (problems.length) return setError(problems[0]);
    const r = run((d) => upsertDecision(d, x), { clientId: ws.client.id, entity: 'decision', entityId: x.id, summary: `${existing ? 'Updated' : 'Recorded'} decision "${x.title.trim()}" (${DECISION_STATUS_LABELS[x.status]})` });
    if (r.ok) onClose();
    else setError(r.error ?? '');
  };

  return (
    <Sheet
      open
      onClose={onClose}
      confirmClose={dirty}
      title={existing ? 'Edit decision' : 'Record decision'}
      description="Decisions are separate from actions and notes. Nothing is marked Approved without a recorded approval."
      footer={
        <SheetFooter
          isNew={!existing}
          noun="decision"
          error={error}
          onCancel={onClose}
          onSave={save}
          archived={!!existing?.archivedAt}
          onArchiveToggle={() => {
            const r = run((d) => setDecisionArchived(d, x.id, !existing?.archivedAt), { clientId: ws.client.id, entity: 'decision', entityId: x.id, summary: `${existing?.archivedAt ? 'Restored' : 'Archived'} decision "${x.title}"` });
            if (r.ok) onClose();
          }}
          onDelete={() => {
            const r = run((d) => deleteDecision(d, x.id), { clientId: ws.client.id, entity: 'decision', entityId: x.id, summary: `Deleted decision "${x.title}"` });
            if (r.ok) onClose();
          }}
          deleteBlockers={existing ? findDecisionReferences(data, existing.id) : []}
        />
      }
    >
      <div className="flex flex-col gap-8">
        <FormSection title="Decision">
          <TextField label="Decision" required value={x.title} onChange={(v) => set({ title: v })} className="sm:col-span-2" />
          <TextArea label="Description" value={x.description} onChange={(v) => set({ description: v })} className="sm:col-span-2" />
          <SelectField label="Status" value={x.status} onChange={(v) => set({ status: v as DecisionStatus })} options={Object.entries(DECISION_STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
          <DateField label="Decision date" value={x.date} onChange={(v) => set({ date: v })} />
          <SelectField label="Confidentiality" value={x.confidentiality} onChange={(v) => set({ confidentiality: v as Decision['confidentiality'] })} options={o.confidentialityOptions} hint="Only “Approved for Client Release” content may appear in client-facing reports." />
        </FormSection>

        {(x.status === 'approved' || x.status === 'superseded') && (
          <FormSection title="Approval record" description="Required for Approved. Record who approved the decision and when — discussion alone is not approval.">
            <SelectField label="Approved by" required value={approval.approvedById} onChange={(v) => setApproval({ approvedById: v || null })} placeholder="Select a person…" options={withCurrent(o.personOptions, approval.approvedById, 'Inactive person')} />
            <DateField label="Approval date" required value={approval.approvedAt?.slice(0, 10) ?? null} onChange={(v) => setApproval({ approvedAt: v ? `${v}T00:00:00.000Z` : null })} />
            <TextArea label="Approval note" value={approval.note} onChange={(v) => setApproval({ note: v })} rows={2} className="sm:col-span-2" hint="e.g. confirmed at the Client Team kickoff, or by email." />
          </FormSection>
        )}
        {x.status === 'superseded' && (
          <FormSection title="Superseded by">
            <SelectField label="Superseding decision" required value={x.supersededById} onChange={(v) => set({ supersededById: v || null })} placeholder="Select a decision…" options={others} className="sm:col-span-2" />
          </FormSection>
        )}

        <FormSection title="Basis">
          <TextArea label="Supporting rationale" value={x.rationale} onChange={(v) => set({ rationale: v })} className="sm:col-span-2" />
          <TextArea label="Alternatives considered" value={x.alternatives} onChange={(v) => set({ alternatives: v })} className="sm:col-span-2" />
          <TextArea label="Dependencies" value={x.dependencies} onChange={(v) => set({ dependencies: v })} rows={2} className="sm:col-span-2" />
        </FormSection>

        <FormSection title="Accountability">
          <SelectField label="Decision owner" value={x.ownerId} onChange={(v) => set({ ownerId: v || null })} placeholder="Unassigned" options={withCurrent(o.personOptions, x.ownerId, 'Inactive person')} className="sm:col-span-2" />
          <PeoplePicker label="Participants" people={o.people} value={x.participantIds} onChange={(v) => set({ participantIds: v })} exclude={x.ownerId ? [x.ownerId] : []} />
          <PeoplePicker label="Consulted" people={o.people} value={x.consultedIds} onChange={(v) => set({ consultedIds: v })} />
          <PeoplePicker label="Informed" people={o.people} value={x.informedIds} onChange={(v) => set({ informedIds: v })} />
        </FormSection>

        <FormSection title="Links">
          <SelectField label="Initiative" value={x.workstreamId} onChange={(v) => set({ workstreamId: v || null })} placeholder="None" options={withCurrent(o.workstreamOptions, x.workstreamId, 'Archived initiative')} />
          <SelectField label="Action plan" value={x.initiativeId} onChange={(v) => set({ initiativeId: v || null })} placeholder="None" options={withCurrent(o.initiativeOptions, x.initiativeId, 'Archived action plan')} />
          <SelectField label="Related project" value={x.projectId} onChange={(v) => set({ projectId: v || null })} placeholder="None" options={withCurrent(o.projectOptions, x.projectId, 'Archived project')} className="sm:col-span-2" />
        </FormSection>

        {x.status === 'proposed' && (
          <p className="flex items-start gap-2 text-xs text-subtle">
            <Info size={14} className="mt-px shrink-0" aria-hidden /> Proposed decisions appear as pending until reviewed. Change the status only when the outcome is explicitly confirmed.
          </p>
        )}
      </div>
    </Sheet>
  );
}
