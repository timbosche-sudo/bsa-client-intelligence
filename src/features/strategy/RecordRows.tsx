import { AlertTriangle, Clock, Lightbulb, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { PersonAvatar } from '@/components/PersonAvatar';
import { ConfidentialityBadge, DecisionStatusBadge, PriorityBadge } from '@/components/status';
import { isOverdue, type ClientWorkspace } from '@/data/repository';
import { setActionStatus } from '@/data/strategyMutations';
import { ACTION_STATUS_LABELS, SEVERITY_LABELS } from '@/domain/labels';
import type { ActionItem, ActionStatus, Decision, Risk } from '@/domain/types';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { run } from '@/state/actions';
import { RISK_KIND_LABELS, RISK_STATUS_LABELS } from './RiskSheet';

const linkLabels = (ws: ClientWorkspace, r: { workstreamId: string | null; projectId: string | null; initiativeId: string | null }) =>
  [
    ws.workstreams.find((w) => w.id === r.workstreamId)?.title,
    ws.initiatives.find((i) => i.id === r.initiativeId)?.title,
    ws.projects.find((p) => p.id === r.projectId)?.name,
  ].filter(Boolean) as string[];

/* ───────────────────────── Actions ───────────────────────── */

export function ActionRow({ ws, action: a, onOpen, showLinks = true }: { ws: ClientWorkspace; action: ActionItem; onOpen(): void; showLinks?: boolean }) {
  const owner = ws.people.find((p) => p.id === a.ownerId);
  const overdue = isOverdue(a);
  const done = a.status === 'complete' || a.status === 'cancelled';
  const links = showLinks ? linkLabels(ws, a) : [];
  const changeStatus = (status: ActionStatus) => {
    run((d) => setActionStatus(d, a.id, status), { clientId: ws.client.id, entity: 'action', entityId: a.id, summary: `"${a.title}" → ${ACTION_STATUS_LABELS[status]}` });
  };
  return (
    <li className={cn('flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-5', overdue && 'border-l-2 border-l-bsa-yellow')}>
      <button type="button" onClick={onOpen} className="flex min-h-11 min-w-0 flex-1 items-start gap-3 text-left">
        <PersonAvatar person={owner} size="sm" className="mt-0.5" />
        <span className="min-w-0">
          <span className={cn('block text-sm font-bold', done && 'text-muted line-through decoration-line-strong')}>{a.title}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-subtle">
            <span>{owner?.fullName ?? 'Unassigned'}</span>
            <span aria-hidden>·</span>
            <span className={cn('inline-flex items-center gap-1', overdue && 'font-bold text-caution')}>
              {overdue && <Clock size={12} aria-hidden />}
              {a.status === 'complete' ? `Completed ${formatDate(a.completedAt, '')}` : a.dueDate ? `Due ${formatDate(a.dueDate)}` : 'No due date'}
              {overdue && ' · Overdue'}
            </span>
            {links.length > 0 && <span className="truncate">· {links.join(' · ')}</span>}
          </span>
        </span>
      </button>
      <div className="flex items-center gap-2 pl-11 sm:pl-0">
        <PriorityBadge priority={a.priority} />
        {a.confidentiality !== 'internal' && <ConfidentialityBadge level={a.confidentiality} />}
        <select
          value={a.status}
          onChange={(e) => changeStatus(e.target.value as ActionStatus)}
          aria-label={`Status of ${a.title}`}
          className={cn('h-10 rounded-lg border bg-surface px-2 text-sm pointer-coarse:h-11', a.status === 'blocked' ? 'border-brand' : a.status === 'complete' ? 'border-bsa-green' : 'border-line')}
        >
          {Object.entries(ACTION_STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>
    </li>
  );
}

export function ActionList({ ws, actions, onOpen, empty = 'No actions', showLinks }: { ws: ClientWorkspace; actions: ActionItem[]; onOpen(id: string): void; empty?: string; showLinks?: boolean }) {
  if (!actions.length) return <EmptyState compact title={empty} className="py-6" />;
  return (
    <ul className="divide-y divide-line">
      {actions.map((a) => (
        <ActionRow key={a.id} ws={ws} action={a} onOpen={() => onOpen(a.id)} showLinks={showLinks} />
      ))}
    </ul>
  );
}

/* ───────────────────────── Decisions ───────────────────────── */

export function DecisionList({ ws, decisions, onOpen, empty = 'No decisions' }: { ws: ClientWorkspace; decisions: Decision[]; onOpen(id: string): void; empty?: string }) {
  if (!decisions.length) return <EmptyState compact title={empty} className="py-6" />;
  return (
    <ul className="divide-y divide-line">
      {decisions.map((d) => {
        const owner = ws.people.find((p) => p.id === d.ownerId);
        const approver = ws.people.find((p) => p.id === d.approval?.approvedById);
        const links = linkLabels(ws, d);
        return (
          <li key={d.id}>
            <button type="button" onClick={() => onOpen(d.id)} className="flex min-h-14 w-full flex-col gap-2 px-4 py-3.5 text-left hover:bg-surface-2 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
              <span className="min-w-0 flex-1">
                <span className={cn('block text-sm font-bold', d.status === 'superseded' && 'text-muted line-through')}>{d.title}</span>
                <span className="mt-0.5 block text-xs text-subtle">
                  Owner: {owner?.fullName ?? 'Unassigned'}
                  {d.date && ` · ${formatDate(d.date)}`}
                  {d.status === 'approved' && approver && ` · Approved by ${approver.fullName}`}
                  {links.length > 0 && ` · ${links.join(' · ')}`}
                </span>
              </span>
              <span className="flex flex-wrap gap-2">
                {d.archivedAt && <Badge tone="outline">Archived</Badge>}
                {d.confidentiality !== 'internal' && <ConfidentialityBadge level={d.confidentiality} />}
                <DecisionStatusBadge status={d.status} />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ───────────────────────── Risks ───────────────────────── */

const severityTone = { critical: 'negative', high: 'negative', medium: 'caution', low: 'neutral', not_assessed: 'outline' } as const;

export function RiskList({ ws, risks, onOpen, empty = 'Nothing recorded' }: { ws: ClientWorkspace; risks: Risk[]; onOpen(id: string): void; empty?: string }) {
  if (!risks.length) return <EmptyState compact title={empty} className="py-6" />;
  return (
    <ul className="divide-y divide-line">
      {risks.map((r) => {
        const Icon = r.kind === 'opportunity' ? Lightbulb : r.kind === 'issue' ? ShieldAlert : AlertTriangle;
        const owner = ws.people.find((p) => p.id === r.ownerId);
        const links = linkLabels(ws, r);
        return (
          <li key={r.id}>
            <button type="button" onClick={() => onOpen(r.id)} className="flex min-h-14 w-full flex-col gap-2 px-4 py-3.5 text-left hover:bg-surface-2 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
              <span className="flex min-w-0 flex-1 gap-3">
                <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', r.kind === 'opportunity' ? 'bg-accent-soft text-accent' : 'bg-surface-3 text-caution')}>
                  <Icon size={15} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className={cn('block text-sm font-bold', r.status === 'closed' && 'text-muted line-through')}>{r.title}</span>
                  <span className="mt-0.5 block text-xs text-subtle">
                    {RISK_KIND_LABELS[r.kind]} · {owner?.fullName ?? 'Owner unassigned'} · {RISK_STATUS_LABELS[r.status]}
                    {links.length > 0 && ` · ${links.join(' · ')}`}
                  </span>
                </span>
              </span>
              <span className="flex flex-wrap gap-2 pl-11 sm:pl-0">
                {r.confidentiality !== 'internal' && <ConfidentialityBadge level={r.confidentiality} />}
                <Badge tone={severityTone[r.severity]}>{SEVERITY_LABELS[r.severity]}</Badge>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
