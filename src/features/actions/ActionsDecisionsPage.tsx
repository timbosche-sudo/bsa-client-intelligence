import { useState } from 'react';
import { AlertTriangle, ClipboardCheck, Gavel, Lightbulb } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { StageNotice } from '@/components/ui/StageNotice';
import { ActionStatusBadge, ConfidentialityBadge, DecisionStatusBadge, PriorityBadge } from '@/components/status';
import { SEVERITY_LABELS } from '@/domain/labels';
import { active, isOverdue, openActions, personName } from '@/data/repository';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { useRequiredWorkspace } from '@/state/useWorkspace';

export function ActionsDecisionsPage() {
  const ws = useRequiredWorkspace();
  const [showAll, setShowAll] = useState(false);
  const actions = showAll ? active(ws.actions) : openActions(ws);
  const decisions = active(ws.decisions);
  const risks = active(ws.risks);
  const wsTitle = (id: string | null) => ws.workstreams.find((w) => w.id === id)?.title ?? null;

  return (
    <>
      <PageHeader eyebrow={ws.client.name} title="Actions & Decisions" description="Commitments stay visible across meetings until closed. Decisions are recorded separately from actions and notes." />
      <StageNotice stage={3} className="mb-6">
        Creating and editing actions, decisions, risks; owner, participant and RACI assignment; individual accountability views.
      </StageNotice>

      <div className="flex flex-col gap-4">
        <Panel
          title="Actions"
          icon={<ClipboardCheck size={18} />}
          actions={
            <div role="group" aria-label="Action filter" className="flex rounded-lg border border-line p-0.5 text-xs">
              {[
                { v: false, l: 'Open' },
                { v: true, l: 'All' },
              ].map((o) => (
                <button key={o.l} type="button" aria-pressed={showAll === o.v} onClick={() => setShowAll(o.v)} className={cn('h-9 rounded-md px-3 pointer-coarse:h-10', showAll === o.v ? 'bg-surface-3 text-ink' : 'text-subtle hover:text-ink')}>
                  {o.l}
                </button>
              ))}
            </div>
          }
          bodyClassName="p-0"
        >
          {actions.length === 0 ? (
            <EmptyState compact title={showAll ? 'No actions recorded' : 'No open actions'} className="py-8" />
          ) : (
            <ul className="divide-y divide-line">
              <li className="hidden grid-cols-[minmax(0,1fr)_10rem_8rem_6rem_7rem] gap-4 px-5 py-2.5 text-xs text-subtle md:grid" aria-hidden>
                <span>Action</span><span>Owner</span><span>Due</span><span>Priority</span><span>Status</span>
              </li>
              {actions.map((a) => {
                const overdue = isOverdue(a);
                return (
                  <li key={a.id} className="grid gap-2 px-5 py-3.5 md:grid-cols-[minmax(0,1fr)_10rem_8rem_6rem_7rem] md:items-center md:gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="truncate text-xs text-subtle">{wsTitle(a.workstreamId) ?? 'No workstream'}</p>
                    </div>
                    <p className="text-sm text-muted"><span className="text-subtle md:hidden">Owner: </span>{personName(ws, a.ownerId) ?? 'Unassigned'}</p>
                    <p className={cn('tabular text-sm', overdue ? 'text-caution' : 'text-muted')}>
                      <span className="text-subtle md:hidden">Due: </span>{a.dueDate ? formatDate(a.dueDate) : 'No due date'}{overdue && ' · Overdue'}
                    </p>
                    <div className="flex gap-2 md:contents">
                      <span><PriorityBadge priority={a.priority} /></span>
                      <span><ActionStatusBadge status={a.status} /></span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="Decisions" icon={<Gavel size={18} />}>
            {decisions.length === 0 ? (
              <EmptyState compact title="No decisions recorded" />
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {decisions.map((d) => (
                  <li key={d.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start gap-3">
                      <p className="min-w-0 flex-1 text-sm font-medium">{d.title}</p>
                      <DecisionStatusBadge status={d.status} />
                    </div>
                    {d.description && <p className="mt-1 text-sm text-muted">{d.description}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-subtle">
                      <span>Owner: {personName(ws, d.ownerId) ?? 'Unassigned'}</span>
                      <span>·</span>
                      <span>{d.date ? formatDate(d.date) : 'Not yet dated'}</span>
                      <ConfidentialityBadge level={d.confidentiality} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Risks, issues & opportunities" icon={<AlertTriangle size={18} />}>
            {risks.length === 0 ? (
              <EmptyState compact title="No risks, issues or opportunities recorded" />
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {risks.map((r) => (
                  <li key={r.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start gap-3">
                      {r.kind === 'opportunity' ? <Lightbulb size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden /> : <AlertTriangle size={16} className="mt-0.5 shrink-0 text-caution" aria-hidden />}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{r.title}</p>
                        <p className="mt-0.5 text-sm text-muted">{r.description}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge tone="outline">{r.kind === 'opportunity' ? 'Opportunity' : r.kind === 'issue' ? 'Issue' : 'Risk'}</Badge>
                          <Badge tone="neutral">Severity: {SEVERITY_LABELS[r.severity]}</Badge>
                          <ConfidentialityBadge level={r.confidentiality} />
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
