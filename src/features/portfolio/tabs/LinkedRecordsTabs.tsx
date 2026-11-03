import { AlertTriangle, Lightbulb } from 'lucide-react';
import { StageNotice } from '@/components/ui/StageNotice';
import { ActionStatusBadge, DecisionStatusBadge, PriorityBadge } from '@/components/status';
import { personName, type ClientWorkspace } from '@/data/repository';
import type { Project } from '@/domain/types';
import { formatDate } from '@/lib/format';
import { Section } from './shared';

export function RisksDecisionsTab({ ws, project }: { ws: ClientWorkspace; project: Project }) {
  const risks = ws.risks.filter((r) => r.projectId === project.id && !r.archivedAt);
  const decisions = ws.decisions.filter((d) => d.projectId === project.id && !d.archivedAt);
  return (
    <div className="flex flex-col gap-8">
      <StageNotice stage={3}>Creating and linking risks and decisions to projects.</StageNotice>
      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="Key risks & opportunities">
          {risks.length === 0 ? (
            <p className="text-sm text-subtle">No risks linked to this project.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {risks.map((r) => (
                <li key={r.id} className="flex gap-3 text-sm">
                  {r.kind === 'opportunity' ? <Lightbulb size={16} className="mt-0.5 text-accent" aria-hidden /> : <AlertTriangle size={16} className="mt-0.5 text-caution" aria-hidden />}
                  <span><span className="font-bold">{r.title}</span><span className="block text-muted">{r.description}</span></span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Open decisions">
          {decisions.length === 0 ? (
            <p className="text-sm text-subtle">No decisions linked to this project.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {decisions.map((d) => (
                <li key={d.id} className="flex items-start gap-3 py-2.5 text-sm">
                  <span className="flex-1 font-bold">{d.title}</span>
                  <DecisionStatusBadge status={d.status} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}

export function ActionsTab({ ws, project }: { ws: ClientWorkspace; project: Project }) {
  const actions = ws.actions.filter((a) => a.projectId === project.id && !a.archivedAt);
  return (
    <div className="flex flex-col gap-8">
      <StageNotice stage={3}>Creating actions and assigning owners from the project.</StageNotice>
      <Section title="Next actions">
        {actions.length === 0 ? (
          <p className="text-sm text-subtle">No actions linked to this project.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {actions.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{a.title}</span>
                  <span className="text-xs text-subtle">{personName(ws, a.ownerId) ?? 'Unassigned'} · {a.dueDate ? formatDate(a.dueDate) : 'No due date'}</span>
                </span>
                <PriorityBadge priority={a.priority} />
                <ActionStatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
