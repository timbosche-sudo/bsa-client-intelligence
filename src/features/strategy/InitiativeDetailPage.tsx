import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ClipboardPlus, Flag, Gavel, Pencil, Plus, ShieldPlus } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PersonAvatar } from '@/components/PersonAvatar';
import { ConfidentialityBadge, InitiativeStatusBadge } from '@/components/status';
import { RACI_LABELS, type RaciRole } from '@/data/accountability';
import { blankMilestone } from '@/data/mutations';
import { active, type ClientWorkspace } from '@/data/repository';
import type { Initiative, Milestone } from '@/domain/types';
import { formatDate, TBC } from '@/lib/format';
import { useRequiredWorkspace } from '@/state/useWorkspace';
import { MilestoneSheet } from '@/features/portfolio/tabs/MilestonesTab';
import { ActionList, DecisionList, RiskList } from './RecordRows';
import { useRecordSheet } from './useRecordSheet';

export function InitiativeDetailPage() {
  const ws = useRequiredWorkspace();
  const { initiativeId } = useParams();
  const navigate = useNavigate();
  const { open, sheet } = useRecordSheet(ws);
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [showDone, setShowDone] = useState(false);
  const i = ws.initiatives.find((x) => x.id === initiativeId);

  if (!i) {
    return (
      <Card>
        <EmptyState title="Action plan not found in this workspace" action={<Link to={`/c/${ws.client.id}/workstreams`} className="font-bold text-accent hover:underline">Back to initiatives</Link>} />
      </Card>
    );
  }

  const workstream = ws.workstreams.find((w) => w.id === i.workstreamId);
  const champion = ws.people.find((p) => p.id === i.championId);
  const actions = active(ws.actions).filter((a) => a.initiativeId === i.id && (showDone || !['complete', 'cancelled'].includes(a.status)));
  const decisions = active(ws.decisions).filter((d) => d.initiativeId === i.id);
  const risks = active(ws.risks).filter((r) => r.initiativeId === i.id);
  const milestones = active(ws.milestones).filter((m) => m.initiativeId === i.id).sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));
  const projects = i.relatedProjectIds.map((id) => ws.projects.find((p) => p.id === id)).filter((p) => !!p);
  const linkDefaults = { initiativeId: i.id, workstreamId: i.workstreamId };

  return (
    <>
      <Link to={`/c/${ws.client.id}/workstreams`} className="-ml-2 mb-4 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm text-muted hover:text-ink">
        <ChevronLeft size={16} aria-hidden /> Accountable Initiatives
      </Link>

      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="eyebrow">{workstream ? `Initiative ${workstream.order} · ${workstream.title}` : 'No initiative'}</p>
            <InitiativeStatusBadge status={i.status} />
            <ConfidentialityBadge level={i.confidentiality} />
            {i.archivedAt && <Badge tone="caution">Archived</Badge>}
          </div>
          <h1 className="text-2xl font-black tracking-tight text-balance md:text-[32px] md:leading-tight">{i.title}</h1>
          {i.description && <p className="mt-2 max-w-3xl text-sm text-muted md:text-[15px]">{i.description}</p>}
        </div>
        <Button variant="primary" icon={<Pencil size={16} />} onClick={() => open({ kind: 'initiative', id: i.id, onDeleted: () => navigate(`/c/${ws.client.id}/workstreams`) })} className="self-start">
          Edit action plan
        </Button>
      </header>

      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        <Card className="flex items-center gap-4 p-5">
          <PersonAvatar person={champion} size="lg" />
          <div>
            <p className="eyebrow">Accountable champion</p>
            <p className={champion ? 'font-bold' : 'text-subtle'}>{champion?.fullName ?? 'Unassigned'}</p>
            {champion?.title && <p className="text-xs text-subtle">{champion.title}</p>}
          </div>
        </Card>
        <Card className="p-5">
          <p className="eyebrow">Desired outcome</p>
          <p className={`mt-1 text-sm ${i.desiredOutcome ? '' : 'text-subtle'}`}>{i.desiredOutcome || TBC}</p>
        </Card>
        <Card className="p-5">
          <p className="eyebrow">Target date</p>
          <p className={`mt-1 text-sm ${i.targetDate ? 'font-bold' : 'text-subtle'}`}>{formatDate(i.targetDate)}</p>
          {projects.length > 0 && (
            <>
              <p className="eyebrow mt-4">Related projects</p>
              <ul className="mt-1 flex flex-col">
                {projects.map((p) => (
                  <li key={p!.id}><Link to={`/c/${ws.client.id}/portfolio/${p!.id}`} className="inline-flex min-h-11 items-center text-sm font-bold hover:underline">{p!.name}</Link></li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      <RaciGrid ws={ws} initiative={i} />

      <div className="flex flex-col gap-6">
        <Section
          title="Actions"
          action={
            <div className="flex items-center gap-2">
              <label className="flex h-11 items-center gap-2 text-sm text-muted">
                <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="size-4 accent-[var(--accent)]" /> Include closed
              </label>
              <Button size="sm" variant="primary" icon={<ClipboardPlus size={15} />} onClick={() => open({ kind: 'action', id: null, defaults: linkDefaults })}>Add action</Button>
            </div>
          }
        >
          <ActionList ws={ws} actions={actions} onOpen={(id) => open({ kind: 'action', id })} empty={showDone ? 'No actions' : 'No open actions'} />
        </Section>
        <div className="grid gap-6 xl:grid-cols-2">
          <Section title="Decisions" action={<Button size="sm" icon={<Gavel size={15} />} onClick={() => open({ kind: 'decision', id: null, defaults: linkDefaults })}>Record decision</Button>}>
            <DecisionList ws={ws} decisions={decisions} onOpen={(id) => open({ kind: 'decision', id })} />
          </Section>
          <Section title="Risks, issues & opportunities" action={<Button size="sm" icon={<ShieldPlus size={15} />} onClick={() => open({ kind: 'risk', id: null, defaults: linkDefaults })}>Add</Button>}>
            <RiskList ws={ws} risks={risks} onOpen={(id) => open({ kind: 'risk', id })} />
          </Section>
        </div>
        <Section title="Milestones" action={<Button size="sm" icon={<Plus size={15} />} onClick={() => setMilestone({ ...blankMilestone(ws.client.id, null), initiativeId: i.id, workstreamId: i.workstreamId })}>Add milestone</Button>}>
          {milestones.length ? (
            <ul className="divide-y divide-line">
              {milestones.map((m) => (
                <li key={m.id}>
                  <button type="button" onClick={() => setMilestone(m)} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2 sm:px-5">
                    <span className={`flex size-8 items-center justify-center rounded-full ${m.confirmed ? 'bg-ink text-bg' : 'border border-dashed border-line-strong text-subtle'}`}><Flag size={14} aria-hidden /></span>
                    <span className="flex-1">
                      <span className="block text-sm font-bold">{m.title}</span>
                      <span className="block text-xs text-subtle">{m.date ? formatDate(m.date) : m.timingNote || TBC}{!m.confirmed && ' · Unconfirmed'}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact title="No milestones" className="py-6" />
          )}
        </Section>
        {i.notes && (
          <Card className="p-5">
            <p className="eyebrow mb-2">Notes</p>
            <p className="whitespace-pre-wrap text-sm">{i.notes}</p>
          </Card>
        )}
      </div>

      {sheet}
      {milestone && <MilestoneSheet ws={ws} milestone={milestone} onClose={() => setMilestone(null)} />}
    </>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-strong px-4 py-3 sm:px-5">
        <h2 className="font-black tracking-tight">{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

/** Lightweight RACI view: people involved in the initiative and its linked actions/decisions. */
function RaciGrid({ ws, initiative: i }: { ws: ClientWorkspace; initiative: Initiative }) {
  const rows: { personId: string; role: RaciRole }[] = [];
  const add = (personId: string | null, role: RaciRole) => personId && !rows.some((r) => r.personId === personId) && rows.push({ personId, role });
  add(i.championId, 'accountable');
  i.participantIds.forEach((p) => add(p, 'supporting'));
  i.consultedIds.forEach((p) => add(p, 'consulted'));
  i.informedIds.forEach((p) => add(p, 'informed'));
  const actions = active(ws.actions).filter((a) => a.initiativeId === i.id && !['complete', 'cancelled'].includes(a.status));
  if (!rows.length) return null;
  return (
    <Card className="mb-6 overflow-x-auto">
      <div className="border-b border-line-strong px-4 py-3 sm:px-5">
        <h2 className="font-black tracking-tight">Who is involved</h2>
        <p className="text-xs text-subtle">RACI for the action plan, with each person’s open actions on it.</p>
      </div>
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-subtle">
            <th className="px-5 py-2 font-normal">Person</th>
            <th className="px-3 py-2 font-normal">Role on action plan</th>
            <th className="px-3 py-2 text-right font-normal">Open actions owned</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const p = ws.people.find((x) => x.id === r.personId);
            const owned = actions.filter((a) => a.ownerId === r.personId).length;
            return (
              <tr key={r.personId} className="border-t border-line">
                <td className="px-5 py-2.5">
                  <Link to={`/c/${ws.client.id}/actions?tab=accountability&person=${r.personId}`} className="inline-flex min-h-11 items-center gap-2 font-bold hover:underline">
                    <PersonAvatar person={p} size="sm" /> {p?.fullName ?? 'Unknown'}
                  </Link>
                </td>
                <td className="px-3"><Badge tone={r.role === 'accountable' ? 'accent' : 'outline'}>{RACI_LABELS[r.role]}</Badge></td>
                <td className="tabular px-3 text-right">{owned}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
