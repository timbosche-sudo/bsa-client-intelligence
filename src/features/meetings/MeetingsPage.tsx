import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarClock, CalendarPlus, ChevronRight, Clock, FileText, LayoutTemplate, Pencil, Play, Users } from 'lucide-react';
import { Badge, type Tone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { startMeeting } from '@/data/meetingMutations';
import { agendaMinutes, meetingCaptures, meetingProgress, meetingTime } from '@/data/meetingSelectors';
import { active, type ClientWorkspace } from '@/data/repository';
import type { Meeting, MeetingStatus } from '@/domain/types';
import { formatDateTime } from '@/lib/format';
import { run } from '@/state/actions';
import { useRequiredWorkspace } from '@/state/useWorkspace';
import { MeetingEditorSheet } from './MeetingEditorSheet';
import { MeetingTemplatesSheet } from './MeetingTemplatesSheet';

export const MEETING_STATUS: Record<MeetingStatus, { label: string; tone: Tone }> = {
  scheduled: { label: 'Scheduled', tone: 'outline' },
  in_progress: { label: 'In progress', tone: 'negative' },
  closeout: { label: 'Closeout', tone: 'caution' },
  finalized: { label: 'Finalized', tone: 'positive' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

export function MeetingsPage() {
  const ws = useRequiredWorkspace();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [editor, setEditor] = useState<{ id: string | null; templateId?: string | null; key: number } | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const meetings = active(ws.meetings);
  const live = meetings.filter((m) => m.status === 'in_progress' || m.status === 'closeout').sort((a, b) => meetingTime(b).localeCompare(meetingTime(a)));
  const upcoming = meetings.filter((m) => m.status === 'scheduled').sort((a, b) => meetingTime(a).localeCompare(meetingTime(b)));
  const history = meetings.filter((m) => m.status === 'finalized').sort((a, b) => meetingTime(b).localeCompare(meetingTime(a)));
  const cancelled = meetings.filter((m) => m.status === 'cancelled');

  useEffect(() => {
    if (params.get('new') === '1') {
      setEditor({ id: null, templateId: params.get('template'), key: Date.now() });
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const start = (m: Meeting) => {
    const r = run((d) => startMeeting(d, m.id), { clientId: ws.client.id, entity: 'meeting', entityId: m.id, summary: `Started meeting "${m.title}"` }, false);
    if (r.ok) navigate(`/c/${ws.client.id}/meetings/${m.id}/run`);
  };

  return (
    <>
      <PageHeader
        eyebrow={ws.client.name}
        title="Meetings"
        description="Plan and lead Client Team meetings, capture decisions and actions as they happen, and keep continuity from one meeting to the next."
        actions={
          <>
            <Button icon={<LayoutTemplate size={16} />} onClick={() => setTemplatesOpen(true)}>Templates</Button>
            <Button variant="primary" icon={<CalendarPlus size={16} />} onClick={() => setEditor({ id: null, key: Date.now() })}>New meeting</Button>
          </>
        }
      />

      {live.length > 0 && (
        <Section title="In progress">
          <ul className="grid gap-3 lg:grid-cols-2">
            {live.map((m) => (
              <MeetingCard key={m.id} ws={ws} m={m} action={
                m.status === 'in_progress' ? (
                  <Link to={`/c/${ws.client.id}/meetings/${m.id}/run`} className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-bold text-brand-contrast hover:bg-brand-strong"><Play size={16} aria-hidden /> Resume meeting</Link>
                ) : (
                  <Link to={`/c/${ws.client.id}/meetings/${m.id}`} className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-bold text-brand-contrast hover:bg-brand-strong"><FileText size={16} aria-hidden /> Review closeout</Link>
                )
              } />
            ))}
          </ul>
        </Section>
      )}

      <Section title="Upcoming">
        {upcoming.length === 0 ? (
          <Card>
            <EmptyState icon={<CalendarClock size={18} />} title="No meetings scheduled" action={<Button size="sm" variant="primary" onClick={() => setEditor({ id: null, key: Date.now() })}>Schedule a meeting</Button>}>
              Start from the Client Team Kickoff template or build your own agenda.
            </EmptyState>
          </Card>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {upcoming.map((m) => (
              <MeetingCard
                key={m.id}
                ws={ws}
                m={m}
                action={
                  <div className="flex flex-wrap gap-2">
                    <Button variant="primary" icon={<Play size={16} />} onClick={() => start(m)}>Start meeting</Button>
                    <Button icon={<Pencil size={16} />} onClick={() => setEditor({ id: m.id, key: Date.now() })}>Edit</Button>
                  </div>
                }
              />
            ))}
          </ul>
        )}
      </Section>

      <Section title="Meeting history">
        {history.length === 0 ? (
          <Card><EmptyState compact title="No finalized meetings yet" className="py-8">Finalized meeting records appear here in chronological order.</EmptyState></Card>
        ) : (
          <Card className="overflow-hidden">
            <ol className="divide-y divide-line">
              {history.map((m, i) => {
                const c = meetingCaptures(ws, m.id);
                const prev = history[i + 1];
                return (
                  <li key={m.id}>
                    <Link to={`/c/${ws.client.id}/meetings/${m.id}`} className="flex min-h-16 flex-col gap-2 px-4 py-3.5 hover:bg-surface-2 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
                      <span className="tabular w-32 shrink-0 text-sm text-muted">{formatDateTime(meetingTime(m))}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold">{m.title}</span>
                        <span className="block text-xs text-subtle">
                          {c.actions.length} action{c.actions.length === 1 ? '' : 's'} · {c.confirmedDecisions.length} confirmed / {c.proposedDecisions.length} proposed decision{c.proposedDecisions.length === 1 ? '' : 's'} · {c.issues.length} issue{c.issues.length === 1 ? '' : 's'} · {m.carryoverActionIds.length} carried over
                          {prev && ` · follows “${prev.title}”`}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        {m.amendments.length > 0 && <Badge tone="outline">Amended ×{m.amendments.length}</Badge>}
                        <Badge tone="positive">Finalized</Badge>
                        <ChevronRight size={16} className="text-subtle" aria-hidden />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </Card>
        )}
      </Section>

      <Section title="Templates">
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {active(ws.meetingTemplates).map((t) => (
            <li key={t.id}>
              <Card className="flex h-full flex-col gap-3 p-4">
                <div>
                  <p className="font-bold">{t.name}</p>
                  <p className="text-xs text-subtle">{t.agenda.length} agenda items · {agendaMinutes(t.agenda)} min</p>
                </div>
                <ol className="flex flex-col gap-1 text-sm text-muted">
                  {t.agenda.map((a, i) => (
                    <li key={a.id} className="flex gap-2"><span className="tabular w-5 text-subtle">{i + 1}.</span><span className="flex-1">{a.title}</span><span className="tabular text-xs text-subtle">{a.minutes}′</span></li>
                  ))}
                </ol>
                <Button className="mt-auto self-start" size="sm" onClick={() => setEditor({ id: null, templateId: t.id, key: Date.now() })}>Use template</Button>
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      {cancelled.length > 0 && (
        <details className="mt-8">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-muted">Cancelled meetings ({cancelled.length})</summary>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {cancelled.map((m) => (
              <li key={m.id}><Link to={`/c/${ws.client.id}/meetings/${m.id}`} className="inline-flex min-h-11 items-center text-left text-subtle hover:text-ink">{m.title} · {formatDateTime(meetingTime(m))}</Link></li>
            ))}
          </ul>
        </details>
      )}

      {editor && <MeetingEditorSheet key={editor.key} ws={ws} meetingId={editor.id} templateId={editor.templateId} onClose={() => setEditor(null)} />}
      {templatesOpen && <MeetingTemplatesSheet ws={ws} onClose={() => setTemplatesOpen(false)} onUse={(id) => (setTemplatesOpen(false), setEditor({ id: null, templateId: id, key: Date.now() }))} />}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-lg font-black tracking-tight">{title}</h2>
        <span className="h-px flex-1 bg-line-strong" aria-hidden />
      </div>
      {children}
    </section>
  );
}

function MeetingCard({ ws, m, action }: { ws: ClientWorkspace; m: Meeting; action: React.ReactNode }) {
  const facilitator = ws.people.find((p) => p.id === m.facilitatorId);
  const prog = meetingProgress(m);
  const st = MEETING_STATUS[m.status];
  return (
    <li>
      <Card className="flex h-full flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link to={`/c/${ws.client.id}/meetings/${m.id}`} className="font-black tracking-tight hover:underline">{m.title}</Link>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5"><Clock size={14} aria-hidden />{m.startsAt ? formatDateTime(m.startsAt) : 'Time to be confirmed'}</span>
              <span>{agendaMinutes(m.agenda)} min</span>
              {m.location && <span>{m.location}</span>}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-subtle">
              <Users size={13} aria-hidden /> {m.attendeeIds.length} attendee{m.attendeeIds.length === 1 ? '' : 's'} · Facilitator: {facilitator?.fullName ?? 'Not set'}
            </p>
          </div>
          <Badge tone={st.tone}>{st.label}</Badge>
        </div>
        {m.status !== 'scheduled' && prog.total > 0 && (
          <div>
            <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
              <span className="bg-bsa-green" style={{ flexGrow: prog.discussed }} />
              <span className="bg-line-strong" style={{ flexGrow: prog.skipped }} />
              <span style={{ flexGrow: prog.pending }} />
            </div>
            <p className="mt-1 text-xs text-subtle">{prog.discussed} of {prog.total} topics discussed{prog.skipped ? ` · ${prog.skipped} skipped` : ''}</p>
          </div>
        )}
        <div className="mt-auto">{action}</div>
      </Card>
    </li>
  );
}
