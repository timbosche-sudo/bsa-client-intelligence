import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertOctagon,
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  ClipboardCheck,
  Compass,
  Flag,
  Gavel,
  Lightbulb,
  Play,
  Users,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { PersonAvatar } from '@/components/PersonAvatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, Panel } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { DecisionStatusBadge, InitiativeStatusBadge, PriorityBadge } from '@/components/status';
import { CLIENT_STATUS_LABELS } from '@/domain/labels';
import {
  active,
  criticalIssues,
  isOverdue,
  openActions,
  pendingDecisions,
  personName,
  portfolioSummary,
  upcomingMeetings,
  upcomingMilestones,
  type ClientWorkspace,
} from '@/data/repository';
import { formatCurrency, formatDate, formatDateTime, plural, TBC } from '@/lib/format';
import { useRequiredWorkspace } from '@/state/useWorkspace';
import { StartMeetingDialog } from './StartMeetingDialog';
import { PortfolioHealth } from './PortfolioHealth';
import { OnboardingPanel } from './OnboardingPanel';

export function ClientOverviewPage() {
  const ws = useRequiredWorkspace();
  const [meetingOpen, setMeetingOpen] = useState(false);
  const base = `/c/${ws.client.id}`;
  const summary = portfolioSummary(ws);
  const actions = openActions(ws);
  const overdue = actions.filter((a) => isOverdue(a));
  const decisions = pendingDecisions(ws);
  const issues = criticalIssues(ws);
  const milestones = upcomingMilestones(ws);
  const meetings = upcomingMeetings(ws);
  const innovation = active(ws.initiatives).filter((i) => i.status !== 'cancelled' && i.status !== 'complete');
  const onboarding = ws.client.status === 'onboarding' && ws.projects.length === 0 && ws.workstreams.length === 0;

  return (
    <>
      <Hero ws={ws} onStartMeeting={() => setMeetingOpen(true)} />

      {onboarding ? (
        <OnboardingPanel ws={ws} />
      ) : (
        <>
          {/* KPI strip — counts of recorded facts only */}
          <section aria-label="Key figures" className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Stat to={`${base}/portfolio`} label="Portfolio projects" value={String(summary.total)} note={summary.byCategory.filter((c) => c.count).map((c) => `${c.count} ${c.label.toLowerCase()}`).join(' · ') || 'None recorded'} />
            <Stat
              to={`${base}/portfolio`}
              label="Known BSA fee"
              value={summary.projectsWithFee ? formatCurrency(summary.knownFeeTotal, { compact: true }) : TBC}
              note={summary.projectsMissingFee ? `${summary.projectsMissingFee} project${summary.projectsMissingFee === 1 ? '' : 's'} without fee` : 'All projects have a fee'}
            />
            <Stat to={`${base}/portfolio`} label="Readiness assessed" value={`${summary.readiness.assessed} of ${summary.total}`} note={summary.readiness.notAssessed ? `${summary.readiness.notAssessed} not assessed` : 'All assessed'} />
            <Stat to={`${base}/actions`} label="Open actions" value={String(actions.length)} note={overdue.length ? `${overdue.length} overdue` : 'None overdue'} tone={overdue.length ? 'caution' : undefined} />
            <Stat to={`${base}/actions?tab=decisions`} label="Pending decisions" value={String(decisions.length)} note="Proposed or under review" />
          </section>

          <Question n={1} title="Where do we stand?" />
          <div className="mb-10 grid gap-4 xl:grid-cols-5">
            <Panel className="xl:col-span-3" title="Portfolio health" icon={<BarChart3 size={18} />} to={`${base}/portfolio`} linkLabel="Portfolio">
              <PortfolioHealth ws={ws} summary={summary} />
            </Panel>
            <Panel className="xl:col-span-2" title="Strategic priorities" icon={<Compass size={18} />} to={`${base}/workstreams`} linkLabel="Initiatives">
              {ws.client.strategicPriorities.length ? (
                <ol className="flex flex-col gap-3">
                  {ws.client.strategicPriorities.map((p, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="tabular mt-px text-xs font-semibold text-accent">{String(i + 1).padStart(2, '0')}</span>
                      <span className="text-ink/90">{p}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyState compact title="No strategic priorities recorded" />
              )}
            </Panel>
          </div>

          <Question n={2} title="What needs our attention?" />
          <div className="mb-10 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <Panel title="Critical issues" icon={<AlertOctagon size={18} />} to={`${base}/actions?tab=risks`}>
              {issues.length ? (
                <ul className="flex flex-col divide-y divide-line">
                  {issues.map((r) => (
                    <li key={r.id} className="py-2.5 first:pt-0 last:pb-0 text-sm">
                      <p className="font-medium">{r.title}</p>
                      <p className="mt-0.5 text-xs text-subtle">{personName(ws, r.ownerId) ?? 'Owner unassigned'}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState compact title="No critical issues recorded" icon={<AlertOctagon size={16} />}>
                  High and critical risks and issues will appear here once recorded.
                </EmptyState>
              )}
            </Panel>
            <Panel title="Open actions" icon={<ClipboardCheck size={18} />} to={`${base}/actions`}>
              {actions.length ? (
                <ul className="flex flex-col divide-y divide-line">
                  {actions.slice(0, 5).map((a) => (
                    <li key={a.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug">{a.title}</p>
                        <p className={`mt-0.5 text-xs ${isOverdue(a) ? 'text-caution' : 'text-subtle'}`}>
                          {personName(ws, a.ownerId) ?? 'Unassigned'} · {a.dueDate ? `Due ${formatDate(a.dueDate)}` : 'No due date'}
                          {isOverdue(a) && ' · Overdue'}
                        </p>
                      </div>
                      <PriorityBadge priority={a.priority} />
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState compact title="No open actions" />
              )}
              {actions.length > 5 && <p className="mt-3 text-xs text-subtle">+ {actions.length - 5} more</p>}
            </Panel>
            <Panel title="Pending decisions" icon={<Gavel size={18} />} to={`${base}/actions?tab=decisions`} className="lg:col-span-2 xl:col-span-1">
              {decisions.length ? (
                <ul className="flex flex-col divide-y divide-line">
                  {decisions.map((d) => (
                    <li key={d.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                      <p className="min-w-0 flex-1 text-sm font-medium leading-snug">{d.title}</p>
                      <DecisionStatusBadge status={d.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState compact title="No pending decisions" />
              )}
            </Panel>
          </div>

          <Question n={3} title="Who is accountable?" />
          <div className="mb-10">
            <Panel title="Client Team" icon={<Users size={18} />} to={`${base}/leadership`} linkLabel="Leadership">
              <TeamSummary ws={ws} />
            </Panel>
          </div>

          <Question n={4} title="What happens next?" />
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <Panel title="Upcoming meetings" icon={<CalendarClock size={18} />} to={`${base}/meetings`}>
              {meetings.length ? (
                <ul className="flex flex-col divide-y divide-line">
                  {meetings.slice(0, 4).map((m) => (
                    <li key={m.id} className="py-2.5 first:pt-0 last:pb-0 text-sm">
                      <p className="font-medium">{m.title}</p>
                      <p className="mt-0.5 text-xs text-subtle">{formatDateTime(m.startsAt)}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState compact title="No meetings scheduled" icon={<CalendarClock size={16} />}>
                  <button type="button" onClick={() => setMeetingOpen(true)} className="min-h-11 font-medium text-accent hover:underline">
                    Review the kickoff agenda
                  </button>
                </EmptyState>
              )}
            </Panel>
            <Panel title="Important milestones" icon={<Flag size={18} />} to={`${base}/portfolio`}>
              {milestones.length ? (
                <ul className="flex flex-col gap-3">
                  {milestones.slice(0, 5).map((m) => (
                    <li key={m.id} className="flex items-start gap-3">
                      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${m.confirmed ? 'bg-accent' : 'border border-line-strong'}`} aria-hidden />
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="font-medium">{m.title}</p>
                        <p className="mt-0.5 text-xs text-subtle">
                          {m.date ? formatDate(m.date) : m.timingNote || TBC}
                          {!m.confirmed && !/unconfirmed/i.test(m.timingNote) && ' · Unconfirmed'}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState compact title="No milestones recorded" />
              )}
            </Panel>
            <Panel title="Innovation & strategic action plans" icon={<Lightbulb size={18} />} to={`${base}/workstreams`} className="lg:col-span-2 xl:col-span-1">
              {innovation.length ? (
                <ul className="flex flex-col divide-y divide-line">
                  {innovation.map((i) => (
                    <li key={i.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div className="min-w-0 flex-1">
                        <Link to={`${base}/initiatives/${i.id}`} className="text-sm font-bold leading-snug hover:underline">{i.title}</Link>
                        <p className="mt-0.5 text-xs text-subtle">Champion: {personName(ws, i.championId) ?? 'Unassigned'}</p>
                      </div>
                      <InitiativeStatusBadge status={i.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState compact title="No action plans yet" />
              )}
            </Panel>
          </div>
        </>
      )}

      <StartMeetingDialog open={meetingOpen} onClose={() => setMeetingOpen(false)} ws={ws} />
    </>
  );
}

function Hero({ ws, onStartMeeting }: { ws: ClientWorkspace; onStartMeeting(): void }) {
  const lead = personName(ws, ws.client.relationshipLeadId);
  const sponsor = personName(ws, ws.client.executiveSponsorId);
  const leadPerson = ws.people.find((p) => p.id === ws.client.relationshipLeadId);
  return (
    <Card className="relative mb-8 overflow-hidden">
      <div className="relative flex flex-col gap-6 p-5 sm:p-7 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="eyebrow">Client Overview</p>
            <Badge tone={ws.client.status === 'active' ? 'accent' : 'outline'}>{CLIENT_STATUS_LABELS[ws.client.status]}</Badge>
          </div>
          <h1 className="text-3xl font-black tracking-tight sm:text-[40px] sm:leading-tight">{ws.client.name}</h1>
          {ws.client.sector && <p className="mt-1.5 text-sm text-subtle">{ws.client.sector}</p>}
          {ws.client.summary && <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted sm:text-[15px]">{ws.client.summary}</p>}

          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-4">
            <div className="flex items-center gap-3">
              <PersonAvatar person={leadPerson} size="md" />
              <dl>
                <dt className="eyebrow">Relationship lead</dt>
                <dd className="text-sm font-medium">{lead ?? 'Unassigned'}</dd>
                {leadPerson && <dd className="text-xs text-subtle">{[leadPerson.title, leadPerson.studio].filter(Boolean).join(' · ')}</dd>}
              </dl>
            </div>
            <div className="flex items-center gap-3">
              <PersonAvatar person={ws.people.find((p) => p.id === ws.client.executiveSponsorId)} size="md" />
              <dl>
                <dt className="eyebrow">Executive sponsor</dt>
                <dd className={`text-sm font-medium ${sponsor ? '' : 'text-subtle'}`}>{sponsor ?? 'Not yet assigned'}</dd>
              </dl>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
          <Button variant="primary" size="lg" icon={<Play size={18} aria-hidden />} onClick={onStartMeeting}>
            Start Meeting
          </Button>
          <Link to={`/c/${ws.client.id}/portfolio`} className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-line bg-surface-2 px-5 text-sm hover:border-line-strong">
            Portfolio Readiness <ArrowUpRight size={16} aria-hidden />
          </Link>
        </div>
      </div>
    </Card>
  );
}

function Question({ n, title }: { n: number; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="tabular flex size-7 shrink-0 items-center justify-center rounded-full border border-line-strong text-[11px] font-bold text-ink">{n}</span>
      <h2 className="text-lg font-black tracking-tight">{title}</h2>
      <span className="h-px flex-1 bg-line-strong" aria-hidden />
    </div>
  );
}

function Stat({ label, value, note, to, tone }: { label: string; value: string; note: string; to: string; tone?: 'caution' }) {
  return (
    <Link to={to} className="group rounded-xl border border-line bg-surface p-4 transition-colors hover:border-line-strong sm:p-5">
      <p className="eyebrow flex items-center justify-between gap-2">
        {label}
        <ArrowUpRight size={13} className="opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      </p>
      <p className="tabular mt-2 text-2xl font-black tracking-tight sm:text-[28px]">{value}</p>
      <p className={`mt-1 text-xs ${tone === 'caution' ? 'text-caution' : 'text-subtle'}`}>{note}</p>
    </Link>
  );
}

function TeamSummary({ ws }: { ws: ClientWorkspace }) {
  const tiers = [...ws.client.config.leadershipTiers].sort((a, b) => a.order - b.order);
  const seats = active(ws.seats);
  const members = active(ws.memberships);
  const filled = seats.filter((s) => s.membershipId).length;
  return (
    <div>
      <p className="mb-4 text-sm text-muted">
        {plural(members.length, 'confirmed member')} · {filled} of {plural(seats.length, 'leadership seat')} filled
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {tiers.map((t) => {
          const tierSeats = seats.filter((s) => s.tierId === t.id);
          const tierMembers = members.filter((m) => m.tierId === t.id);
          return (
            <div key={t.id} className="rounded-lg border border-line bg-surface-2 p-3.5">
              <p className="eyebrow mb-2.5 leading-snug">{t.label}</p>
              {tierMembers.length === 0 && tierSeats.length === 0 && <p className="text-xs text-subtle">No seats defined</p>}
              <ul className="flex flex-col gap-2.5">
                {tierMembers.map((m) => {
                  const name = personName(ws, m.personId);
                  return (
                    <li key={m.id} className="flex items-center gap-2.5">
                      <Avatar name={name} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{name}</p>
                        <p className="truncate text-xs text-subtle">{m.role}</p>
                      </div>
                    </li>
                  );
                })}
                {tierSeats
                  .filter((s) => !s.membershipId)
                  .map((s) => (
                    <li key={s.id} className="flex items-center gap-2.5">
                      <Avatar name={null} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm text-subtle">Unassigned</p>
                        <p className="truncate text-xs text-subtle">{s.role}</p>
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

