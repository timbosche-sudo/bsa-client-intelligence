import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, ClipboardPlus, FileCheck2, Gavel, Pencil, Plus, ShieldPlus, Target } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { PersonAvatar } from '@/components/PersonAvatar';
import { ConfidentialityBadge, InitiativeStatusBadge, WorkstreamStatusBadge } from '@/components/status';
import { active, isOverdue, openActions, pendingDecisions, type ClientWorkspace } from '@/data/repository';
import { reorderWorkstreams } from '@/data/strategyMutations';
import type { Initiative, Workstream } from '@/domain/types';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { run } from '@/state/actions';
import { useRequiredWorkspace } from '@/state/useWorkspace';
import { ActionList, DecisionList, RiskList } from '@/features/strategy/RecordRows';
import { useRecordSheet, type SheetRequest } from '@/features/strategy/useRecordSheet';

export function WorkstreamsPage() {
  const ws = useRequiredWorkspace();
  const { open, sheet } = useRecordSheet(ws);
  const [showArchived, setShowArchived] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(active(ws.workstreams).sort((a, b) => a.order - b.order).slice(0, 1).map((w) => w.id)));
  const streams = ws.workstreams.filter((w) => showArchived || !w.archivedAt).sort((a, b) => a.order - b.order);
  const activeIds = streams.filter((w) => !w.archivedAt).map((w) => w.id);

  const move = (id: string, delta: number) => {
    const i = activeIds.indexOf(id);
    const next = [...activeIds];
    next.splice(i, 1);
    next.splice(i + delta, 0, id);
    run((d) => reorderWorkstreams(d, ws.client.id, next), { clientId: ws.client.id, entity: 'workstream', entityId: id, summary: 'Reordered initiatives' }, false);
  };
  const toggle = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <>
      <PageHeader
        eyebrow={ws.client.name}
        title="Accountable Initiatives"
        description="Internal initiatives ensure readiness and consistency, while external initiatives drive proactive client value."
        actions={
          <>
            <label className="flex h-11 items-center gap-2 rounded-lg border border-line px-3 text-sm text-muted">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="size-4 accent-[var(--accent)]" />
              Show archived
            </label>
            <Button icon={<Target size={16} />} onClick={() => open({ kind: 'initiative', id: null })}>New action plan</Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => open({ kind: 'workstream', id: null })}>New initiative</Button>
          </>
        }
      />

      {streams.length === 0 ? (
        <Card>
          <EmptyState title="No initiatives yet" action={<Button variant="primary" size="sm" onClick={() => open({ kind: 'workstream', id: null })}>Create an initiative</Button>}>
            Initiatives organize action plans, actions, decisions and risks.
          </EmptyState>
        </Card>
      ) : (
        <ol className="flex flex-col gap-4">
          {streams.map((w) => (
            <li key={w.id}>
              <WorkstreamCard
                ws={ws}
                w={w}
                expanded={expanded.has(w.id)}
                onToggle={() => toggle(w.id)}
                onOpen={open}
                canUp={!w.archivedAt && activeIds.indexOf(w.id) > 0}
                canDown={!w.archivedAt && activeIds.indexOf(w.id) < activeIds.length - 1}
                onMove={(d) => move(w.id, d)}
              />
            </li>
          ))}
        </ol>
      )}

      {/* Records not assigned to a workstream remain visible. */}
      <Unassigned ws={ws} onOpen={open} />
      {sheet}
    </>
  );
}

function WorkstreamCard({ ws, w, expanded, onToggle, onOpen, canUp, canDown, onMove }: { ws: ClientWorkspace; w: Workstream; expanded: boolean; onToggle(): void; onOpen(r: SheetRequest): void; canUp: boolean; canDown: boolean; onMove(d: number): void }) {
  const champion = ws.people.find((p) => p.id === w.championId);
  const initiatives = active(ws.initiatives).filter((i) => i.workstreamId === w.id);
  const actions = openActions(ws).filter((a) => a.workstreamId === w.id);
  const overdue = actions.filter((a) => isOverdue(a)).length;
  const decisions = pendingDecisions(ws).filter((d) => d.workstreamId === w.id);
  const risks = active(ws.risks).filter((r) => r.workstreamId === w.id && r.status !== 'closed');
  const panelId = `ws-panel-${w.id}`;

  return (
    <Card className={cn('overflow-hidden', w.archivedAt && 'opacity-60')}>
      <div className="flex items-start gap-3 p-4 sm:gap-4 sm:p-5">
        <span className="tabular flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-black text-accent-contrast">{w.order}</span>
        <button type="button" onClick={onToggle} aria-expanded={expanded} aria-controls={panelId} className="min-h-11 min-w-0 flex-1 text-left">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-black tracking-tight">{w.title}</span>
            <WorkstreamStatusBadge status={w.status} />
            <ConfidentialityBadge level={w.confidentiality} />
          </span>
          <span className="mt-1 block text-sm text-muted">{w.purpose}</span>
          <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-subtle">
            <span className="inline-flex items-center gap-1.5">
              <PersonAvatar person={champion} size="sm" className="size-6" /> Champion: {champion?.fullName ?? 'Unassigned'}
            </span>
            <span>{initiatives.length} action plan{initiatives.length === 1 ? '' : 's'}</span>
            <span>{actions.length} open action{actions.length === 1 ? '' : 's'}{overdue ? ` (${overdue} overdue)` : ''}</span>
            <span>{decisions.length} pending decision{decisions.length === 1 ? '' : 's'}</span>
            <span>{risks.length} open risk/issue{risks.length === 1 ? '' : 's'}</span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button size="sm" variant="ghost" iconOnly icon={<ArrowUp size={16} />} aria-label={`Move ${w.title} up`} disabled={!canUp} onClick={() => onMove(-1)} className="max-sm:hidden" />
          <Button size="sm" variant="ghost" iconOnly icon={<ArrowDown size={16} />} aria-label={`Move ${w.title} down`} disabled={!canDown} onClick={() => onMove(1)} className="max-sm:hidden" />
          <Button size="sm" variant="ghost" iconOnly icon={<Pencil size={16} />} aria-label={`Edit ${w.title}`} onClick={() => onOpen({ kind: 'workstream', id: w.id })} />
          <Button size="sm" variant="ghost" iconOnly icon={<ChevronDown size={18} className={cn('transition-transform', expanded && 'rotate-180')} />} aria-label={expanded ? 'Collapse' : 'Expand'} onClick={onToggle} />
        </div>
      </div>

      {expanded && (
        <div id={panelId} className="flex flex-col gap-6 border-t border-line p-4 sm:p-5">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="eyebrow mb-3 text-ink">Focus areas</p>
              <ul className="flex flex-col gap-2">
                {w.topics.map((t, i) => (
                  <li key={i} className="flex gap-2.5 text-sm"><span className="mt-2 size-1 shrink-0 rounded-full bg-ink" aria-hidden />{t}</li>
                ))}
                {!w.topics.length && <li className="text-sm text-subtle">No focus areas recorded.</li>}
              </ul>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <p className="eyebrow mb-2 text-ink">Desired outcome / deliverable</p>
                <p className="flex items-start gap-2 text-sm"><FileCheck2 size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />{w.deliverable || 'Not defined'}</p>
              </div>
              {w.confidentialityNote && <p className="border-l-2 border-line-strong bg-surface-2 px-3 py-2 text-xs text-muted">{w.confidentialityNote}</p>}
            </div>
          </div>

          <Block title="Action plans" action={<Button size="sm" icon={<Target size={15} />} onClick={() => onOpen({ kind: 'initiative', id: null, defaults: { workstreamId: w.id } })}>Add action plan</Button>}>
            {initiatives.length ? (
              <ul className="flex flex-col gap-2">
                {initiatives.map((i) => <ActionPlanRow key={i.id} ws={ws} plan={i} onOpen={onOpen} />)}
              </ul>
            ) : (
              <p className="text-sm text-subtle">No action plans yet.</p>
            )}
          </Block>

          <Block title="Open actions" action={<Button size="sm" icon={<ClipboardPlus size={15} />} onClick={() => onOpen({ kind: 'action', id: null, defaults: { workstreamId: w.id } })}>Add action</Button>}>
            <div className="-mx-4 sm:-mx-5"><ActionList ws={ws} actions={actions} onOpen={(id) => onOpen({ kind: 'action', id })} empty="No open actions" /></div>
          </Block>

          <div className="grid gap-6 lg:grid-cols-2">
            <Block title="Pending decisions" action={<Button size="sm" icon={<Gavel size={15} />} onClick={() => onOpen({ kind: 'decision', id: null, defaults: { workstreamId: w.id } })}>Record</Button>}>
              <div className="-mx-4 sm:-mx-5"><DecisionList ws={ws} decisions={decisions} onOpen={(id) => onOpen({ kind: 'decision', id })} empty="No pending decisions" /></div>
            </Block>
            <Block title="Open risks & issues" action={<Button size="sm" icon={<ShieldPlus size={15} />} onClick={() => onOpen({ kind: 'risk', id: null, defaults: { workstreamId: w.id } })}>Add</Button>}>
              <div className="-mx-4 sm:-mx-5"><RiskList ws={ws} risks={risks} onOpen={(id) => onOpen({ kind: 'risk', id })} empty="None recorded" /></div>
            </Block>
          </div>
        </div>
      )}
    </Card>
  );
}

/** An action plan within an initiative: a summary row that expands in place to show its details and linked records. */
function ActionPlanRow({ ws, plan: i, onOpen }: { ws: ClientWorkspace; plan: Initiative; onOpen(r: SheetRequest): void }) {
  const [open, setOpen] = useState(false);
  const ch = ws.people.find((p) => p.id === i.championId);
  const acts = openActions(ws).filter((a) => a.initiativeId === i.id);
  const decisions = pendingDecisions(ws).filter((d) => d.initiativeId === i.id);
  const risks = active(ws.risks).filter((r) => r.initiativeId === i.id && r.status !== 'closed');
  const people = (ids: string[] | undefined) => (ids ?? []).map((id) => ws.people.find((p) => p.id === id)?.fullName).filter(Boolean).join(', ');
  const projects = i.relatedProjectIds.map((id) => ws.projects.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p);
  const bodyId = `plan-${i.id}`;
  return (
    <li className="rounded-lg border border-line bg-surface-2">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={bodyId} className="flex min-h-16 w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-surface-3">
        <PersonAvatar person={ch} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">{i.title}</span>
          <span className="block text-xs text-subtle">{ch?.fullName ?? 'Champion unassigned'} · {acts.length} open action{acts.length === 1 ? '' : 's'}{i.targetDate ? ` · Target ${formatDate(i.targetDate)}` : ''}</span>
        </span>
        <InitiativeStatusBadge status={i.status} />
        <ChevronDown size={16} className={cn('shrink-0 text-subtle transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div id={bodyId} className="flex flex-col gap-4 border-t border-line p-3 sm:p-4">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {i.description && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-subtle">Description</dt>
                <dd className="whitespace-pre-wrap">{i.description}</dd>
              </div>
            )}
            <div className="sm:col-span-2">
              <dt className="text-xs text-subtle">Desired outcome</dt>
              <dd className={cn(!i.desiredOutcome && 'text-subtle')}>{i.desiredOutcome || 'Not recorded'}</dd>
            </div>
            <div>
              <dt className="text-xs text-subtle">Champion (accountable)</dt>
              <dd>{ch?.fullName ?? 'Unassigned'}</dd>
            </div>
            <div>
              <dt className="text-xs text-subtle">Target date</dt>
              <dd>{i.targetDate ? formatDate(i.targetDate) : 'Not set'}</dd>
            </div>
            {people(i.participantIds) && (
              <div>
                <dt className="text-xs text-subtle">Responsible</dt>
                <dd>{people(i.participantIds)}</dd>
              </div>
            )}
            {people(i.consultedIds) && (
              <div>
                <dt className="text-xs text-subtle">Consulted</dt>
                <dd>{people(i.consultedIds)}</dd>
              </div>
            )}
            {projects.length > 0 && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-subtle">Related projects</dt>
                <dd className="flex flex-wrap gap-x-3">
                  {projects.map((p) => <Link key={p.id} to={`/c/${ws.client.id}/portfolio/${p.id}`} className="font-bold hover:underline">{p.name}</Link>)}
                </dd>
              </div>
            )}
          </dl>
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="eyebrow text-ink">Open actions</p>
              <Button size="sm" variant="ghost" icon={<ClipboardPlus size={15} />} onClick={() => onOpen({ kind: 'action', id: null, defaults: { workstreamId: i.workstreamId, initiativeId: i.id } })}>Add action</Button>
            </div>
            <div className="-mx-3 sm:-mx-4"><ActionList ws={ws} actions={acts} onOpen={(id) => onOpen({ kind: 'action', id })} empty="No open actions" /></div>
          </div>
          {(decisions.length > 0 || risks.length > 0) && (
            <div className="grid gap-4 lg:grid-cols-2">
              {decisions.length > 0 && (
                <div>
                  <p className="eyebrow mb-1 text-ink">Pending decisions</p>
                  <div className="-mx-3 sm:-mx-4"><DecisionList ws={ws} decisions={decisions} onOpen={(id) => onOpen({ kind: 'decision', id })} /></div>
                </div>
              )}
              {risks.length > 0 && (
                <div>
                  <p className="eyebrow mb-1 text-ink">Open risks &amp; issues</p>
                  <div className="-mx-3 sm:-mx-4"><RiskList ws={ws} risks={risks} onOpen={(id) => onOpen({ kind: 'risk', id })} /></div>
                </div>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon={<Pencil size={15} />} onClick={() => onOpen({ kind: 'initiative', id: i.id })}>Edit action plan</Button>
            <Link to={`/c/${ws.client.id}/initiatives/${i.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-bold text-accent hover:underline pointer-coarse:h-11">
              Open full page <ChevronRight size={15} aria-hidden />
            </Link>
          </div>
        </div>
      )}
    </li>
  );
}

function Block({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-t border-line-strong pt-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="eyebrow text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Unassigned({ ws, onOpen }: { ws: ClientWorkspace; onOpen(r: SheetRequest): void }) {
  const initiatives = active(ws.initiatives).filter((i) => !i.workstreamId);
  const actions = openActions(ws).filter((a) => !a.workstreamId);
  if (!initiatives.length && !actions.length) return null;
  return (
    <Card className="mt-6 p-4 sm:p-5">
      <p className="font-black tracking-tight">Not assigned to an initiative</p>
      {initiatives.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 text-sm">
          {initiatives.map((i) => (
            <li key={i.id}><Link to={`/c/${ws.client.id}/initiatives/${i.id}`} className="inline-flex min-h-11 items-center font-bold hover:underline">{i.title}</Link></li>
          ))}
        </ul>
      )}
      {actions.length > 0 && <div className="-mx-4 mt-2 sm:-mx-5"><ActionList ws={ws} actions={actions} onOpen={(id) => onOpen({ kind: 'action', id })} /></div>}
    </Card>
  );
}
