import { useState } from 'react';
import { ClipboardPlus, Gavel, ShieldPlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { active, type ClientWorkspace } from '@/data/repository';
import type { Project } from '@/domain/types';
import { ActionList, DecisionList, RiskList } from '@/features/strategy/RecordRows';
import { useRecordSheet } from '@/features/strategy/useRecordSheet';
import { Section } from './shared';

export function RisksDecisionsTab({ ws, project }: { ws: ClientWorkspace; project: Project }) {
  const { open, sheet } = useRecordSheet(ws);
  const risks = active(ws.risks).filter((r) => r.projectId === project.id);
  const decisions = active(ws.decisions).filter((d) => d.projectId === project.id);
  return (
    <div className="grid gap-8 xl:grid-cols-2">
      <Section title="Key risks, issues & opportunities" actions={<Button size="sm" icon={<ShieldPlus size={15} />} onClick={() => open({ kind: 'risk', id: null, defaults: { projectId: project.id } })}>Add</Button>}>
        <div className="-mx-4 sm:-mx-5">
          <RiskList ws={ws} risks={risks} onOpen={(id) => open({ kind: 'risk', id })} empty="No risks linked to this project" />
        </div>
      </Section>
      <Section title="Decisions" actions={<Button size="sm" icon={<Gavel size={15} />} onClick={() => open({ kind: 'decision', id: null, defaults: { projectId: project.id } })}>Record</Button>}>
        <div className="-mx-4 sm:-mx-5">
          <DecisionList ws={ws} decisions={decisions} onOpen={(id) => open({ kind: 'decision', id })} empty="No decisions linked to this project" />
        </div>
      </Section>
      {sheet}
    </div>
  );
}

export function ActionsTab({ ws, project }: { ws: ClientWorkspace; project: Project }) {
  const { open, sheet } = useRecordSheet(ws);
  const [showClosed, setShowClosed] = useState(false);
  const actions = active(ws.actions)
    .filter((a) => a.projectId === project.id && (showClosed || !['complete', 'cancelled'].includes(a.status)))
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
  return (
    <Section
      title="Next actions"
      actions={
        <div className="flex items-center gap-2">
          <label className="flex h-11 items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} className="size-4 accent-[var(--accent)]" /> Include closed
          </label>
          <Button size="sm" variant="primary" icon={<ClipboardPlus size={15} />} onClick={() => open({ kind: 'action', id: null, defaults: { projectId: project.id } })}>Add action</Button>
        </div>
      }
    >
      <div className="-mx-4 sm:-mx-5">
        <ActionList ws={ws} actions={actions} onOpen={(id) => open({ kind: 'action', id })} empty={showClosed ? 'No actions linked to this project' : 'No open actions for this project'} />
      </div>
      {sheet}
    </Section>
  );
}
