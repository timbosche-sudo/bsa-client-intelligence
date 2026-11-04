import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, CalendarPlus, Check, ChevronLeft, ClipboardPlus, FilePen, FileText, Flag, Gavel, Lock, Minus, Pencil, Play, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { FieldError, ListField, TextArea, TextField } from '@/components/form/fields';
import { PersonAvatar } from '@/components/PersonAvatar';
import { finalizeMeeting, setAgendaItemStatus, setMeetingNotes, startAmendment, startMeeting, updateCloseout } from '@/data/meetingMutations';
import { agendaMinutes, carryover, changesSince, meetingCaptures, meetingTime, previousMeeting, suggestNextTopics, upcomingMilestonesWithin } from '@/data/meetingSelectors';
import { active, isOverdue, type ClientWorkspace } from '@/data/repository';
import { ACTION_STATUS_LABELS, DECISION_STATUS_LABELS, OPEN_ACTION_STATUSES, SEVERITY_LABELS } from '@/domain/labels';
import type { AgendaItemStatus, Meeting } from '@/domain/types';
import { cn } from '@/lib/cn';
import { formatDate, formatDateTime, TBC } from '@/lib/format';
import { currentUserName, run } from '@/state/actions';
import { useRequiredWorkspace } from '@/state/useWorkspace';
import { ActionList, DecisionList, RiskList } from '@/features/strategy/RecordRows';
import { useRecordSheet } from '@/features/strategy/useRecordSheet';
import { MeetingEditorSheet } from './MeetingEditorSheet';
import { MEETING_STATUS } from './MeetingsPage';

export function MeetingRecordPage() {
  const ws = useRequiredWorkspace();
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [followUp, setFollowUp] = useState(false);
  const m = ws.meetings.find((x) => x.id === meetingId);
  if (!m) {
    return (
      <Card>
        <EmptyState title="Meeting not found in this workspace" action={<Link to={`/c/${ws.client.id}/meetings`} className="font-bold text-accent hover:underline">Back to meetings</Link>} />
      </Card>
    );
  }
  const facilitator = ws.people.find((p) => p.id === m.facilitatorId);
  const st = MEETING_STATUS[m.status];
  const runMode = () => {
    const r = run((d) => startMeeting(d, m.id), { clientId: ws.client.id, entity: 'meeting', entityId: m.id, summary: `${m.status === 'scheduled' ? 'Started' : 'Resumed'} meeting "${m.title}"` }, false);
    if (r.ok) navigate(`/c/${ws.client.id}/meetings/${m.id}/run`);
  };

  return (
    <>
      <Link to={`/c/${ws.client.id}/meetings`} className="-ml-2 mb-4 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm text-muted hover:text-ink">
        <ChevronLeft size={16} aria-hidden /> Meetings
      </Link>
      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="eyebrow">{m.status === 'closeout' ? 'Meeting closeout' : m.status === 'finalized' ? 'Meeting record' : 'Meeting'}</p>
            <Badge tone={st.tone}>{st.label}</Badge>
            {m.amendments.some((a) => !a.completedAt) && <Badge tone="caution">Amendment in progress</Badge>}
          </div>
          <h1 className="text-2xl font-black tracking-tight text-balance md:text-[32px] md:leading-tight">{m.title}</h1>
          <p className="mt-2 text-sm text-muted">
            {m.startsAt ? formatDateTime(m.startsAt) : 'Time to be confirmed'} · {agendaMinutes(m.agenda)} min planned{m.location ? ` · ${m.location}` : ''} · Facilitator: {facilitator?.fullName ?? 'Not set'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {m.status === 'scheduled' && <Button variant="primary" icon={<Play size={16} />} onClick={runMode}>Start meeting</Button>}
          {m.status === 'in_progress' && <Button variant="primary" icon={<Play size={16} />} onClick={() => navigate(`/c/${ws.client.id}/meetings/${m.id}/run`)}>Resume Meeting Mode</Button>}
          {m.status === 'closeout' && <Button icon={<Play size={16} />} onClick={runMode}>Resume facilitation</Button>}
          {m.status === 'finalized' && <Button variant="primary" icon={<CalendarPlus size={16} />} onClick={() => setFollowUp(true)}>Schedule next meeting</Button>}
          {m.status !== 'finalized' && m.status !== 'cancelled' && <Button icon={<Pencil size={16} />} onClick={() => setEditing(true)}>Edit details</Button>}
        </div>
      </header>

      {m.status === 'finalized' ? <FinalRecord ws={ws} m={m} /> : m.status === 'closeout' ? <Closeout ws={ws} m={m} /> : <Preparation ws={ws} m={m} />}

      {editing && <MeetingEditorSheet ws={ws} meetingId={m.id} onClose={() => setEditing(false)} />}
      {followUp && (
        <MeetingEditorSheet
          ws={ws}
          meetingId={null}
          templateId={m.templateId}
          seed={{ title: '', objectives: m.nextMeetingTopics, attendeeIds: m.attendeeIds, facilitatorId: m.facilitatorId, workstreamIds: m.workstreamIds, location: m.location }}
          onClose={() => setFollowUp(false)}
          onSaved={(id) => navigate(`/c/${ws.client.id}/meetings/${id}`)}
        />
      )}
    </>
  );
}

/* ───────────────────────── Shared blocks ───────────────────────── */

function Block({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-strong px-4 py-3 sm:px-5">
        <h2 className="font-black tracking-tight">{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

function SinceLast({ ws, m }: { ws: ClientWorkspace; m: Meeting }) {
  const prev = previousMeeting(ws, m);
  if (!prev?.finalizedAt) return null;
  const until = m.startedAt ?? new Date().toISOString();
  const ch = changesSince(ws, prev.finalizedAt, until, m.id);
  return (
    <Block title="Since the previous meeting" action={<Link to={`/c/${ws.client.id}/meetings/${prev.id}`} className="inline-flex min-h-11 items-center text-sm font-bold text-accent hover:underline">{prev.title} · {formatDate(meetingTime(prev))}</Link>}>
      <dl className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 sm:p-5">
        {[
          ['Actions completed', ch.completedActions.length],
          ['New actions', ch.newActions.length],
          ['Decisions approved', ch.approvedDecisions.length],
          ['New issues', ch.newIssues.length],
        ].map(([l, n]) => (
          <div key={l as string} className="rounded-lg border border-line p-3">
            <dt className="text-xs text-subtle">{l}</dt>
            <dd className="tabular text-2xl font-black">{n}</dd>
          </div>
        ))}
      </dl>
      {ch.completedActions.length > 0 && (
        <ul className="border-t border-line px-4 py-3 text-sm sm:px-5">
          {ch.completedActions.map((a) => <li key={a.id} className="flex items-center gap-2 py-1"><Check size={14} className="text-positive" aria-hidden />{a.title}</li>)}
        </ul>
      )}
    </Block>
  );
}

/* ───────────────────────── Before the meeting ───────────────────────── */

function Preparation({ ws, m }: { ws: ClientWorkspace; m: Meeting }) {
  const { open, sheet } = useRecordSheet(ws);
  const openActions = active(ws.actions).filter((a) => OPEN_ACTION_STATUSES.includes(a.status));
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Block title="Agenda">
          <ol className="divide-y divide-line">
            {m.agenda.map((a, i) => (
              <li key={a.id} className="flex gap-4 px-4 py-3 sm:px-5">
                <span className="tabular flex size-8 shrink-0 items-center justify-center rounded-full border border-line-strong text-xs font-bold">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{a.title}</p>
                  {a.purpose && <p className="text-sm text-muted">{a.purpose}</p>}
                </div>
                <span className="tabular text-sm text-subtle">{a.minutes} min</span>
              </li>
            ))}
          </ol>
        </Block>
        <div className="flex flex-col gap-6">
          <Block title="Objectives">
            {m.objectives.length ? (
              <ul className="flex flex-col gap-2 p-4 text-sm sm:p-5">{m.objectives.map((o, i) => <li key={i} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-ink" aria-hidden />{o}</li>)}</ul>
            ) : (
              <EmptyState compact title="No objectives recorded" className="py-6" />
            )}
          </Block>
          <Block title={`Attendees (${m.attendeeIds.length})`}>
            <ul className="flex flex-col gap-2 p-4 sm:p-5">
              {m.attendeeIds.map((id) => {
                const p = ws.people.find((x) => x.id === id);
                return <li key={id} className="flex items-center gap-2.5 text-sm"><PersonAvatar person={p} size="sm" />{p?.fullName ?? 'Unknown'}</li>;
              })}
              {!m.attendeeIds.length && <li className="text-sm text-subtle">No attendees recorded.</li>}
            </ul>
          </Block>
        </div>
      </div>
      <SinceLast ws={ws} m={m} />
      <Block title={`Open actions to review (${openActions.length})`}>
        <ActionList ws={ws} actions={openActions} onOpen={(id) => open({ kind: 'action', id })} empty="No open actions" />
      </Block>
      {sheet}
    </div>
  );
}

/* ───────────────────────── Closeout ───────────────────────── */

function TopicStatus({ status, onChange }: { status: AgendaItemStatus; onChange(s: AgendaItemStatus): void }) {
  return (
    <div role="radiogroup" aria-label="Topic status" className="flex rounded-lg border border-line p-0.5">
      {(['discussed', 'skipped', 'pending'] as AgendaItemStatus[]).map((s) => (
        <button key={s} type="button" role="radio" aria-checked={status === s} onClick={() => onChange(s)} className={cn('h-10 rounded-md px-3 text-sm pointer-coarse:h-11', status === s ? (s === 'discussed' ? 'bg-bsa-green font-bold text-black' : 'bg-surface-3 font-bold') : 'text-subtle hover:text-ink')}>
          {s === 'discussed' ? 'Discussed' : s === 'skipped' ? 'Skipped' : 'Not covered'}
        </button>
      ))}
    </div>
  );
}

function Closeout({ ws, m }: { ws: ClientWorkspace; m: Meeting }) {
  const { open, sheet } = useRecordSheet(ws);
  const caps = meetingCaptures(ws, m.id);
  const carried = carryover(ws, m);
  const suggestions = suggestNextTopics(ws, m);
  const milestones = upcomingMilestonesWithin(ws, 90);
  const [summary, setSummary] = useState(m.summary);
  const [topics, setTopics] = useState(m.nextMeetingTopics);
  const defaults = { meetingId: m.id, workstreamId: m.workstreamIds[0] ?? null };
  const noOwner = caps.actions.filter((a) => !a.ownerId && OPEN_ACTION_STATUSES.includes(a.status));
  const noDue = caps.actions.filter((a) => !a.dueDate && OPEN_ACTION_STATUSES.includes(a.status));
  const notCovered = m.agenda.filter((a) => (m.agendaState[a.id]?.status ?? 'pending') === 'pending');
  const openIssues = caps.issues.filter((r) => r.status !== 'closed');
  const saveCloseout = (patch: Partial<Pick<Meeting, 'summary' | 'nextMeetingTopics'>>) =>
    run((d) => updateCloseout(d, m.id, patch), { clientId: ws.client.id, entity: 'meeting', entityId: m.id, summary: 'Updated meeting closeout' }, false);

  return (
    <div className="flex flex-col gap-6">
      {m.amendments.some((a) => !a.completedAt) && (
        <p className="border-l-2 border-bsa-yellow bg-surface-2 px-4 py-3 text-sm">
          Amending the finalized record: “{m.amendments.find((a) => !a.completedAt)!.reason}” — requested by {m.amendments.find((a) => !a.completedAt)!.requestedBy}. Finalize again when corrections are complete.
        </p>
      )}

      <Block title="Topics discussed">
        <ol className="divide-y divide-line">
          {m.agenda.map((a, i) => (
            <li key={a.id} className="flex flex-col gap-3 px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-bold"><span className="tabular mr-2 text-subtle">{i + 1}.</span>{a.title}</p>
                <TopicStatus status={m.agendaState[a.id]?.status ?? 'pending'} onChange={(s) => run((d) => setAgendaItemStatus(d, m.id, a.id, s), { clientId: ws.client.id, entity: 'meeting', entityId: m.id, summary: `Topic "${a.title}" marked ${s}` }, false)} />
              </div>
              <NoteEditor value={m.notes[a.id] ?? ''} onSave={(t) => run((d) => setMeetingNotes(d, m.id, a.id, t), { clientId: ws.client.id, entity: 'meeting', entityId: m.id, summary: `Edited notes for "${a.title}"` }, false)} label={`Notes — ${a.title}`} />
            </li>
          ))}
          <li className="px-4 py-4 sm:px-5">
            <NoteEditor value={m.generalNotes} onSave={(t) => run((d) => setMeetingNotes(d, m.id, null, t), { clientId: ws.client.id, entity: 'meeting', entityId: m.id, summary: 'Edited general meeting notes' }, false)} label="General notes" />
          </li>
        </ol>
      </Block>

      <div className="grid gap-6 xl:grid-cols-2">
        <Block title={`Confirmed decisions (${caps.confirmedDecisions.length})`} action={<Button size="sm" icon={<Gavel size={15} />} onClick={() => open({ kind: 'decision', id: null, defaults })}>Record</Button>}>
          <DecisionList ws={ws} decisions={caps.confirmedDecisions} onOpen={(id) => open({ kind: 'decision', id })} empty="No decisions confirmed with an approval record" />
        </Block>
        <Block title={`Proposed decisions (${caps.proposedDecisions.length + caps.otherDecisions.length})`}>
          <DecisionList ws={ws} decisions={[...caps.proposedDecisions, ...caps.otherDecisions]} onOpen={(id) => open({ kind: 'decision', id })} empty="No proposed decisions" />
        </Block>
      </div>

      <Block title={`New actions (${caps.actions.length})`} action={<Button size="sm" icon={<ClipboardPlus size={15} />} onClick={() => open({ kind: 'action', id: null, defaults })}>Add action</Button>}>
        {(noOwner.length > 0 || noDue.length > 0) && (
          <p className="flex items-start gap-2 border-b border-line bg-surface-2 px-4 py-2.5 text-sm sm:px-5">
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-caution" aria-hidden />
            {[noOwner.length && `${noOwner.length} without an owner`, noDue.length && `${noDue.length} without a due date`].filter(Boolean).join(' · ')}. Open an action to assign it.
          </p>
        )}
        <ActionList ws={ws} actions={caps.actions} onOpen={(id) => open({ kind: 'action', id })} empty="No actions were assigned in this meeting" />
      </Block>

      <div className="grid gap-6 xl:grid-cols-2">
        <Block title={`Unresolved issues (${openIssues.length})`} action={<Button size="sm" icon={<Flag size={15} />} onClick={() => open({ kind: 'risk', id: null, defaults: { ...defaults, kind: 'issue' } })}>Flag issue</Button>}>
          <RiskList ws={ws} risks={caps.issues} onOpen={(id) => open({ kind: 'risk', id })} empty="No issues flagged" />
        </Block>
        <Block title="Upcoming milestones (90 days)">
          {milestones.length ? (
            <ul className="divide-y divide-line">
              {milestones.map((x) => (
                <li key={x.id} className="flex items-center gap-3 px-4 py-3 text-sm sm:px-5">
                  <span className="flex-1 font-bold">{x.title}</span>
                  <span className="text-subtle">{x.date ? formatDate(x.date) : x.timingNote || TBC}{!x.confirmed && ' · Unconfirmed'}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact title="No upcoming milestones" className="py-6" />
          )}
        </Block>
      </div>

      <Block title={`Carried-over actions (${carried.length})`}>
        <p className="px-4 pt-3 text-xs text-subtle sm:px-5">Open actions brought into this meeting, with their current status.</p>
        <ActionList ws={ws} actions={carried} onOpen={(id) => open({ kind: 'action', id })} empty="None carried over" />
      </Block>

      <SinceLast ws={ws} m={m} />

      <Block title="Next meeting">
        <div className="grid gap-6 p-4 sm:p-5 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-bold">Suggested topics</p>
            <p className="mb-3 text-xs text-subtle">Rule-based suggestions from recorded facts (not AI). Add the ones you want to keep.</p>
            {suggestions.length === 0 ? (
              <p className="text-sm text-subtle">No suggestions.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {suggestions.map((s) => {
                  const added = topics.includes(s.topic);
                  return (
                    <li key={s.topic} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2 text-sm">
                      <span className="min-w-0 flex-1"><span className="block font-bold">{s.topic}</span><span className="text-xs text-subtle">{s.reason}</span></span>
                      <Button size="sm" variant={added ? 'ghost' : 'secondary'} disabled={added} onClick={() => { const n = [...topics, s.topic]; setTopics(n); saveCloseout({ nextMeetingTopics: n }); }}>{added ? 'Added' : 'Add'}</Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="flex flex-col gap-4">
            <div onBlur={() => JSON.stringify(topics) !== JSON.stringify(m.nextMeetingTopics) && saveCloseout({ nextMeetingTopics: topics.map((t) => t.trim()).filter(Boolean) })}>
              <ListField label="Next meeting topics" value={topics} onChange={setTopics} rows={5} hint="One per line. Saved when you leave the field." />
            </div>
            <TextArea label="Meeting summary" rows={5} value={summary} onChange={setSummary} onBlur={() => summary !== m.summary && saveCloseout({ summary })} hint="Internal. A short executive summary of outcomes. Saved when you leave the field." />
          </div>
        </div>
      </Block>

      <FinalizePanel ws={ws} m={m} warnings={[
        notCovered.length > 0 && `${notCovered.length} agenda topic${notCovered.length === 1 ? ' is' : 's are'} marked “Not covered”.`,
        noOwner.length > 0 && `${noOwner.length} new action${noOwner.length === 1 ? ' has' : 's have'} no owner.`,
        noDue.length > 0 && `${noDue.length} new action${noDue.length === 1 ? ' has' : 's have'} no due date.`,
        caps.proposedDecisions.length > 0 && `${caps.proposedDecisions.length} decision${caps.proposedDecisions.length === 1 ? ' remains' : 's remain'} proposed — they will be recorded as proposed, not approved.`,
      ].filter((x): x is string => !!x)} />
      {sheet}
    </div>
  );
}

function NoteEditor({ value, onSave, label }: { value: string; onSave(t: string): void; label: string }) {
  const [v, setV] = useState(value);
  return <TextArea label={label} rows={3} value={v} onChange={setV} onBlur={() => v !== value && onSave(v)} hint="Saved when you leave the field." />;
}

function FinalizePanel({ ws, m, warnings }: { ws: ClientWorkspace; m: Meeting; warnings: string[] }) {
  const [approvedBy, setApprovedBy] = useState(currentUserName());
  const [ack, setAck] = useState(false);
  const [error, setError] = useState('');
  const finalize = () => {
    const r = run((d) => finalizeMeeting(d, m.id, { approvedBy, acknowledged: ack }), { clientId: ws.client.id, entity: 'meeting', entityId: m.id, summary: `Finalized meeting record "${m.title}"` });
    if (!r.ok) setError(r.error ?? '');
  };
  return (
    <Card className="border-line-strong p-5">
      <p className="flex items-center gap-2 font-black tracking-tight"><ShieldCheck size={18} className="text-accent" aria-hidden /> Finalize the meeting record</p>
      <p className="mt-1 text-sm text-muted">Finalizing freezes this record. Later changes to actions and decisions stay in their own records; the meeting keeps what was recorded today. Corrections require an amendment with a reason.</p>
      {warnings.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1.5 border-l-2 border-bsa-yellow bg-surface-2 px-4 py-3 text-sm">
          {warnings.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      )}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <TextField label="Approved by" required value={approvedBy} onChange={setApprovedBy} />
      </div>
      <label className="mt-4 flex min-h-11 cursor-pointer items-start gap-3 text-sm">
        <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 size-5 accent-[var(--brand)]" />
        <span>I have reviewed the topics, decisions, actions, owners and due dates, and approve this as the final meeting record.</span>
      </label>
      {error && <div className="mt-3"><FieldError>{error}</FieldError></div>}
      <Button variant="primary" className="mt-4" icon={<Lock size={16} />} disabled={!ack || !approvedBy.trim()} onClick={finalize}>Finalize record</Button>
    </Card>
  );
}

/* ───────────────────────── Finalized ───────────────────────── */

function FinalRecord({ ws, m }: { ws: ClientWorkspace; m: Meeting }) {
  const rec = m.record!;
  const [amending, setAmending] = useState(false);
  const live = (id: string) => ws.actions.find((a) => a.id === id);
  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
        <Lock size={18} className="shrink-0 text-accent" aria-hidden />
        <p className="flex-1 text-sm">
          Finalized by <strong>{rec.finalizedBy}</strong> on {formatDateTime(rec.finalizedAt)}. This record is read-only.
        </p>
        <Button icon={<FilePen size={16} />} onClick={() => setAmending(true)}>Amend record</Button>
      </Card>
      <Link to={`/c/${ws.client.id}/reports?new=internal_team&meeting=${m.id}`} className="inline-flex h-11 items-center gap-2 self-start rounded-lg border border-line bg-surface-2 px-4 text-sm font-bold hover:border-line-strong">
        <FileText size={16} aria-hidden /> Generate Internal Client Team Report
      </Link>

      {rec.summary && (
        <Block title="Summary"><p className="whitespace-pre-wrap p-4 text-sm sm:p-5">{rec.summary}</p></Block>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Block title="Topics">
          <ol className="divide-y divide-line">
            {rec.topics.map((t, i) => (
              <li key={i} className="px-4 py-3 sm:px-5">
                <p className="flex items-center gap-2 font-bold">
                  {t.status === 'discussed' ? <Check size={15} className="text-positive" aria-label="Discussed" /> : <Minus size={15} className="text-subtle" aria-label={t.status} />}
                  {t.title}
                  {t.status !== 'discussed' && <Badge tone="outline">{t.status === 'skipped' ? 'Skipped' : 'Not covered'}</Badge>}
                </p>
                {t.notes && <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{t.notes}</p>}
              </li>
            ))}
            {rec.generalNotes && <li className="px-4 py-3 sm:px-5"><p className="font-bold">General notes</p><p className="mt-1 whitespace-pre-wrap text-sm text-muted">{rec.generalNotes}</p></li>}
          </ol>
        </Block>
        <div className="flex flex-col gap-6">
          <Block title="Attendees">
            <p className="p-4 text-sm sm:p-5">{rec.attendees.join(', ') || 'None recorded'}{rec.facilitator && <span className="block text-subtle">Facilitator: {rec.facilitator}</span>}</p>
          </Block>
          <Block title="Next meeting topics">
            {rec.nextMeetingTopics.length ? <ul className="flex flex-col gap-1.5 p-4 text-sm sm:p-5">{rec.nextMeetingTopics.map((t, i) => <li key={i}>{t}</li>)}</ul> : <EmptyState compact title="None recorded" className="py-6" />}
          </Block>
        </div>
      </div>

      <Block title={`Decisions (${rec.decisions.length})`}>
        {rec.decisions.length ? (
          <ul className="divide-y divide-line">
            {rec.decisions.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm sm:px-5">
                <span className="flex-1 font-bold">{d.title}</span>
                {d.approvedBy && <span className="text-xs text-subtle">Approved by {d.approvedBy}</span>}
                <Badge tone={d.status === 'approved' ? 'positive' : 'outline'}>{DECISION_STATUS_LABELS[d.status as keyof typeof DECISION_STATUS_LABELS] ?? d.status}</Badge>
              </li>
            ))}
          </ul>
        ) : <EmptyState compact title="No decisions recorded" className="py-6" />}
      </Block>

      <Block title={`Actions assigned (${rec.actions.length})`}>
        {rec.actions.length ? (
          <ul className="divide-y divide-line">
            {rec.actions.map((a) => {
              const now = live(a.id);
              const changed = now && now.status !== a.status;
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm sm:px-5">
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{a.title}</span>
                    <span className="text-xs text-subtle">{a.owner ?? 'Unassigned'} · {a.dueDate ? `Due ${formatDate(a.dueDate)}` : 'No due date'}{now && isOverdue(now) ? ' · now overdue' : ''}</span>
                  </span>
                  <Badge tone="outline">Recorded: {ACTION_STATUS_LABELS[a.status as keyof typeof ACTION_STATUS_LABELS] ?? a.status}</Badge>
                  {changed && <Badge tone={now.status === 'complete' ? 'positive' : 'accent'}>Now: {ACTION_STATUS_LABELS[now.status]}</Badge>}
                </li>
              );
            })}
          </ul>
        ) : <EmptyState compact title="No actions assigned" className="py-6" />}
      </Block>

      <div className="grid gap-6 xl:grid-cols-2">
        <Block title={`Issues flagged (${rec.issues.length})`}>
          {rec.issues.length ? (
            <ul className="divide-y divide-line">{rec.issues.map((r) => <li key={r.id} className="flex items-center gap-3 px-4 py-3 text-sm sm:px-5"><span className="flex-1 font-bold">{r.title}</span><Badge tone="outline">{SEVERITY_LABELS[r.severity as keyof typeof SEVERITY_LABELS] ?? r.severity}</Badge></li>)}</ul>
          ) : <EmptyState compact title="No issues flagged" className="py-6" />}
        </Block>
        <Block title={`Carried over (${rec.carriedOver.length})`}>
          {rec.carriedOver.length ? (
            <ul className="divide-y divide-line">{rec.carriedOver.map((a) => <li key={a.id} className="flex items-center gap-3 px-4 py-3 text-sm sm:px-5"><span className="flex-1">{a.title}<span className="block text-xs text-subtle">{a.owner ?? 'Unassigned'}</span></span><Badge tone="outline">{ACTION_STATUS_LABELS[a.status as keyof typeof ACTION_STATUS_LABELS] ?? a.status}</Badge></li>)}</ul>
          ) : <EmptyState compact title="Nothing carried over" className="py-6" />}
        </Block>
      </div>

      {m.amendments.length > 0 && (
        <Block title="Amendment history">
          <ul className="divide-y divide-line">
            {m.amendments.map((a) => (
              <li key={a.id} className="px-4 py-3 text-sm sm:px-5">
                <p className="font-bold">{a.reason}</p>
                <p className="text-xs text-subtle">Requested by {a.requestedBy} on {formatDateTime(a.startedAt)}{a.completedAt ? ` · re-finalized ${formatDateTime(a.completedAt)}` : ' · in progress'}</p>
              </li>
            ))}
          </ul>
        </Block>
      )}
      {amending && <AmendDialog ws={ws} m={m} onClose={() => setAmending(false)} />}
    </div>
  );
}

function AmendDialog({ ws, m, onClose }: { ws: ClientWorkspace; m: Meeting; onClose(): void }) {
  const [reason, setReason] = useState('');
  const [by, setBy] = useState(currentUserName());
  const [error, setError] = useState('');
  return (
    <Dialog
      open
      onClose={onClose}
      title="Amend the meeting record"
      description="The record reopens for closeout edits and must be finalized again. The reason is kept in the amendment history."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              const r = run((d) => startAmendment(d, m.id, { reason, requestedBy: by }), { clientId: ws.client.id, entity: 'meeting', entityId: m.id, summary: `Started amendment of "${m.title}": ${reason.trim()}` });
              if (r.ok) onClose();
              else setError(r.error ?? '');
            }}
          >
            Start amendment
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextArea label="Reason for amendment" required rows={3} value={reason} onChange={setReason} />
        <TextField label="Requested by" required value={by} onChange={setBy} />
        {error && <FieldError>{error}</FieldError>}
      </div>
    </Dialog>
  );
}
