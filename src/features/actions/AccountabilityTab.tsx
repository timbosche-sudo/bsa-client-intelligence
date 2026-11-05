import { Link } from 'react-router-dom';
import { AlertCircle, ChevronLeft, ChevronRight, FileText, ListChecks } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PersonAvatar } from '@/components/PersonAvatar';
import { InitiativeStatusBadge } from '@/components/status';
import { commitmentsFor, commitmentSummary, workstreamSummary } from '@/data/accountability';
import { active, type ClientWorkspace } from '@/data/repository';
import { OPEN_ACTION_STATUSES } from '@/domain/labels';
import type { Initiative } from '@/domain/types';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { ActionList, DecisionList, RiskList } from '@/features/strategy/RecordRows';
import type { SheetRequest } from '@/features/strategy/useRecordSheet';

export function AccountabilityTab({ ws, personId, onPerson, onOpen }: { ws: ClientWorkspace; personId: string; onPerson(id: string): void; onOpen(r: SheetRequest): void }) {
  if (personId) return <PersonView ws={ws} personId={personId} onPerson={onPerson} onOpen={onOpen} />;
  const people = commitmentSummary(ws);
  const streams = workstreamSummary(ws);
  const unassigned = active(ws.actions).filter((a) => OPEN_ACTION_STATUSES.includes(a.status) && !a.ownerId).length;
  const base = `/c/${ws.client.id}/actions`;

  return (
    <div className="flex flex-col gap-6">
      {unassigned > 0 && (
        <Link to={`${base}?owner=none`} className="flex min-h-12 items-center gap-3 rounded-lg border-l-2 border-bsa-yellow bg-surface-2 px-4 py-3 text-sm hover:bg-surface-3">
          <AlertCircle size={16} className="shrink-0 text-caution" aria-hidden />
          <span className="flex-1"><strong>{unassigned}</strong> open action{unassigned === 1 ? ' has' : 's have'} no accountable owner.</span>
          <ChevronRight size={16} className="text-subtle" aria-hidden />
        </Link>
      )}

      <Card className="overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-strong px-4 py-3 sm:px-5">
          <div>
            <h2 className="font-black tracking-tight">Commitments by person</h2>
            <p className="text-xs text-subtle">Open items only. Select a person for their full accountability view.</p>
          </div>
          <select value="" onChange={(e) => e.target.value && onPerson(e.target.value)} aria-label="Open a person’s view" className="h-11 rounded-lg border border-line bg-surface px-3 text-sm">
            <option value="">Open person…</option>
            {ws.people.filter((p) => !p.archivedAt).map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
          </select>
        </div>
        {people.length === 0 ? (
          <EmptyState compact title="No one has open commitments yet" className="py-8">Assign owners to actions, action plans, decisions and risks to see accountability here.</EmptyState>
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-subtle">
                <th className="px-5 py-2 font-normal">Person</th>
                {['Actions owned', 'Overdue', 'Supporting', 'Action plans', 'Decisions', 'Risks'].map((h) => <th key={h} className="px-3 py-2 text-right font-normal">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {people.map((r) => (
                <tr key={r.person.id} className="border-t border-line hover:bg-surface-2">
                  <td className="px-5 py-1.5">
                    <button type="button" onClick={() => onPerson(r.person.id)} className="inline-flex min-h-11 items-center gap-2 text-left font-bold hover:underline">
                      <PersonAvatar person={r.person} size="sm" /> {r.person.fullName}
                    </button>
                  </td>
                  <Num n={r.openOwned} />
                  <Num n={r.overdue} warn />
                  <Num n={r.supporting} />
                  <Num n={r.championing} />
                  <Num n={r.pendingDecisions} />
                  <Num n={r.openRisks} />
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="overflow-x-auto">
        <div className="border-b border-line-strong px-4 py-3 sm:px-5">
          <h2 className="font-black tracking-tight">Outstanding commitments by initiative</h2>
        </div>
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-subtle">
              <th className="px-5 py-2 font-normal">Initiative</th>
              {['Open actions', 'Overdue', 'Unassigned', 'Action plans', 'Decisions', 'Risks'].map((h) => <th key={h} className="px-3 py-2 text-right font-normal">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {streams.map((r) => (
              <tr key={r.workstreamId ?? 'none'} className="border-t border-line hover:bg-surface-2">
                <td className="px-5 py-1.5">
                  <Link to={`${base}?ws=${r.workstreamId ?? 'none'}`} className="inline-flex min-h-11 items-center font-bold hover:underline">
                    {r.workstreamId ? `${r.order}. ` : ''}{r.title}
                  </Link>
                </td>
                <Num n={r.openActions} />
                <Num n={r.overdue} warn />
                <Num n={r.unassigned} warn />
                <Num n={r.activeInitiatives} />
                <Num n={r.pendingDecisions} />
                <Num n={r.openRisks} />
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Num({ n, warn }: { n: number; warn?: boolean }) {
  return <td className={cn('tabular px-3 text-right', n === 0 ? 'text-subtle' : warn ? 'font-bold text-caution' : '')}>{n}</td>;
}

function PersonView({ ws, personId, onPerson, onOpen }: { ws: ClientWorkspace; personId: string; onPerson(id: string): void; onOpen(r: SheetRequest): void }) {
  const c = commitmentsFor(ws, personId);
  if (!c.person) {
    return (
      <Card>
        <EmptyState title="This person has no records in this workspace" action={<Button size="sm" onClick={() => onPerson('')}>Back to overview</Button>} />
      </Card>
    );
  }
  const p = c.person;
  const openAction = (id: string) => onOpen({ kind: 'action', id });
  const projectName = (id: string) => ws.projects.find((x) => x.id === id)?.name ?? 'Project';
  const stats = [
    ['Actions owned', c.actions.accountable.length],
    ['Overdue', c.overdue],
    ['Supporting', c.actions.supporting.length],
    ['Action plans championed', c.initiatives.champion.length],
    ['Decisions to resolve', c.decisions.owned.length],
    ['Open risks owned', c.risks.length],
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="ghost" icon={<ChevronLeft size={16} />} onClick={() => onPerson('')}>All people</Button>
        <select value={personId} onChange={(e) => onPerson(e.target.value)} aria-label="Person" className="ml-auto h-11 rounded-lg border border-line bg-surface px-3 text-sm">
          {ws.people.filter((x) => !x.archivedAt || x.id === personId).map((x) => <option key={x.id} value={x.id}>{x.fullName}</option>)}
        </select>
      </div>

      <Card className="flex flex-col gap-5 p-5 md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <PersonAvatar person={p} size="xl" />
          <div>
            <p className="eyebrow">Individual accountability</p>
            <h2 className="text-2xl font-black tracking-tight">{p.fullName}</h2>
            <p className="text-sm text-muted">{[p.title, p.studio, p.organization].filter(Boolean).join(' · ')}</p>
            <p className="mt-1 text-xs text-subtle">{ws.memberships.filter((m) => m.personId === p.id && !m.archivedAt).map((m) => m.role).join(' · ') || 'No Client Team role'}</p>
          </div>
        </div>
        <dl className="grid flex-1 grid-cols-3 gap-2 md:grid-cols-6">
          {stats.map(([l, n]) => (
            <div key={l} className="rounded-lg border border-line p-2.5">
              <dt className="text-[11px] leading-tight text-subtle">{l}</dt>
              <dd className={cn('tabular text-xl font-black', l === 'Overdue' && n > 0 && 'text-caution')}>{n}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Link to={`/c/${ws.client.id}/reports?new=accountability_brief&person=${p.id}`} className="inline-flex h-11 items-center gap-2 self-start rounded-lg border border-line bg-surface-2 px-4 text-sm font-bold hover:border-line-strong">
        <FileText size={16} aria-hidden /> Generate accountability brief (PDF)
      </Link>

      <Section title="Accountable for — open actions">
        <ActionList ws={ws} actions={c.actions.accountable} onOpen={openAction} empty="No open actions owned" />
      </Section>
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Supporting">
          <ActionList ws={ws} actions={c.actions.supporting} onOpen={openAction} empty="Not supporting any open actions" />
        </Section>
        <Section title="Consulted or informed">
          <ActionList ws={ws} actions={c.actions.consultedInformed} onOpen={openAction} empty="Nothing to be consulted or informed on" />
        </Section>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Action plans">
          {c.initiatives.champion.length + c.initiatives.involved.length === 0 ? (
            <EmptyState compact title="No active action plans" className="py-6" />
          ) : (
            <ul className="divide-y divide-line">
              {[...c.initiatives.champion.map((i) => [i, 'Champion'] as const), ...c.initiatives.involved.map((i) => [i, 'Involved'] as const)].map(([i, role]) => (
                <InitiativeRow key={i.id} ws={ws} i={i} role={role} />
              ))}
            </ul>
          )}
        </Section>
        <Section title="Decisions to resolve">
          <DecisionList ws={ws} decisions={[...c.decisions.owned, ...c.decisions.involved]} onOpen={(id) => onOpen({ kind: 'decision', id })} empty="No pending decisions" />
        </Section>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Recent approved decisions affecting their work">
          <DecisionList ws={ws} decisions={c.decisions.recentApproved} onOpen={(id) => onOpen({ kind: 'decision', id })} empty="None recorded" />
        </Section>
        <Section title="Open risks & issues owned">
          <RiskList ws={ws} risks={c.risks} onOpen={(id) => onOpen({ kind: 'risk', id })} empty="None owned" />
        </Section>
      </div>
      {c.checklistItems.length > 0 && (
        <Section title="Restart checklist items">
          <ul className="divide-y divide-line">
            {c.checklistItems.map((i, k) => (
              <li key={k}>
                <Link to={`/c/${ws.client.id}/portfolio/${i.projectId}?tab=readiness`} className="flex min-h-12 items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-2 sm:px-5">
                  <ListChecks size={16} className="text-subtle" aria-hidden />
                  <span className="flex-1"><span className="font-bold">{i.itemTitle}</span> <span className="text-subtle">· {projectName(i.projectId)}{i.dueDate ? ` · Due ${formatDate(i.dueDate)}` : ''}</span></span>
                  <ChevronRight size={16} className="text-subtle" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function InitiativeRow({ ws, i, role }: { ws: ClientWorkspace; i: Initiative; role: string }) {
  return (
    <li>
      <Link to={`/c/${ws.client.id}/initiatives/${i.id}`} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-surface-2 sm:px-5">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">{i.title}</span>
          <span className="block text-xs text-subtle">{role}{i.targetDate ? ` · Target ${formatDate(i.targetDate)}` : ''}</span>
        </span>
        <Badge tone={role === 'Champion' ? 'accent' : 'outline'}>{role}</Badge>
        <InitiativeStatusBadge status={i.status} />
      </Link>
    </li>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <h3 className="border-b border-line-strong px-4 py-3 font-black tracking-tight sm:px-5">{title}</h3>
      {children}
    </Card>
  );
}
