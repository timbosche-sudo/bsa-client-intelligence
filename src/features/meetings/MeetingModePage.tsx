import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, CircleDot, ClipboardPlus, Flag, Gavel, ListChecks, LogOut, Minus, Square, Target, Timer, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { InitiativeStatusBadge } from '@/components/status';
import { endMeeting, goToAgendaItem, setAgendaItemStatus, setMeetingAttendees, setMeetingNotes, startMeeting } from '@/data/meetingMutations';
import { PeoplePicker } from '@/components/form/PeoplePicker';
import { useStrategyOptions } from '@/features/strategy/options';
import { agendaMinutes, carryover, meetingCaptures, meetingProgress } from '@/data/meetingSelectors';
import { active, pendingDecisions, type ClientWorkspace } from '@/data/repository';
import { OPEN_ACTION_STATUSES } from '@/domain/labels';
import type { AgendaItemStatus, Meeting } from '@/domain/types';
import { cn } from '@/lib/cn';
import { run } from '@/state/actions';
import { useDataStore } from '@/state/store';
import { useWorkspace } from '@/state/useWorkspace';
import { SaveIndicator } from '@/layout/SaveIndicator';
import { ActionList, DecisionList, RiskList } from '@/features/strategy/RecordRows';
import { useRecordSheet } from '@/features/strategy/useRecordSheet';

/** Silent mutation for high-frequency edits (navigation, notes): saved, but not logged as activity. */
function silent(recipe: Parameters<ReturnType<typeof useDataStore.getState>['mutate']>[0]) {
  try {
    useDataStore.getState().mutate(recipe);
    return true;
  } catch {
    return false;
  }
}

const minutesSince = (iso: string | null, now: number) => (iso ? Math.max(0, Math.floor((now - Date.parse(iso)) / 60000)) : 0);

export function MeetingModePage() {
  const ws = useWorkspace();
  const { meetingId } = useParams();
  const m = ws?.meetings.find((x) => x.id === meetingId);
  if (!ws || !m) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <EmptyState title="Meeting not found" action={ws && <Link to={`/c/${ws.client.id}/meetings`} className="font-bold text-accent hover:underline">Back to meetings</Link>} />
      </div>
    );
  }
  if (m.status !== 'in_progress') return <NotRunning ws={ws} m={m} />;
  return <Facilitation ws={ws} m={m} />;
}

function NotRunning({ ws, m }: { ws: ClientWorkspace; m: Meeting }) {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-black tracking-tight">{m.title}</h1>
        <p className="mt-2 text-sm text-muted">
          {m.status === 'scheduled' ? 'This meeting has not started yet.' : m.status === 'closeout' ? 'This meeting has ended and is in closeout review.' : m.status === 'finalized' ? 'This meeting record is finalized.' : 'This meeting was cancelled.'}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {(m.status === 'scheduled' || m.status === 'closeout') && (
            <Button variant="primary" onClick={() => run((d) => startMeeting(d, m.id), { clientId: ws.client.id, entity: 'meeting', entityId: m.id, summary: `${m.status === 'closeout' ? 'Resumed' : 'Started'} meeting "${m.title}"` }, false)}>
              {m.status === 'closeout' ? 'Resume facilitation' : 'Start meeting'}
            </Button>
          )}
          <Button onClick={() => navigate(`/c/${ws.client.id}/meetings/${m.id}`)}>Open meeting record</Button>
        </div>
      </div>
    </div>
  );
}

function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** Keeps the screen awake during facilitation where supported (iPadOS 16.4+, Chrome). */
function useWakeLock() {
  useEffect(() => {
    let lock: { release(): Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } };
    const acquire = () => nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => undefined);
    void acquire();
    const onVis = () => document.visibilityState === 'visible' && void acquire();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      void lock?.release().catch(() => undefined);
    };
  }, []);
}

function Facilitation({ ws, m }: { ws: ClientWorkspace; m: Meeting }) {
  const navigate = useNavigate();
  const now = useNow();
  useWakeLock();
  const { open, sheet } = useRecordSheet(ws);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const idx = Math.max(0, m.agenda.findIndex((a) => a.id === m.currentAgendaItemId));
  const item = m.agenda[idx];
  const prog = meetingProgress(m);
  const elapsed = minutesSince(m.startedAt, now);
  const planned = agendaMinutes(m.agenda);
  const defaults = { meetingId: m.id, workstreamId: m.workstreamIds[0] ?? null };

  const goTo = useCallback((itemId: string, markPrevious?: AgendaItemStatus) => silent((d) => goToAgendaItem(d, m.id, itemId, markPrevious)), [m.id]);
  const next = useCallback(() => {
    const n = m.agenda[idx + 1];
    if (n) goTo(n.id, 'discussed');
    else {
      silent((d) => setAgendaItemStatus(d, m.id, item.id, 'discussed'));
      setConfirmEnd(true);
    }
  }, [m, idx, item, goTo]);
  const prev = useCallback(() => {
    const p = m.agenda[idx - 1];
    if (p) goTo(p.id);
  }, [m.agenda, idx, goTo]);

  // Arrow keys move between agenda items when not typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable], dialog')) return;
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev]);

  const end = () => {
    const r = run((d) => endMeeting(d, m.id), { clientId: ws.client.id, entity: 'meeting', entityId: m.id, summary: `Ended meeting "${m.title}" — closeout review` }, false);
    if (r.ok) navigate(`/c/${ws.client.id}/meetings/${m.id}`);
  };

  if (!item) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <EmptyState title="This meeting has no agenda" action={<Link to={`/c/${ws.client.id}/meetings`} className="font-bold text-accent hover:underline">Edit it from Meetings</Link>} />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      {/* Focus header */}
      <header className="sticky top-0 z-30 border-b border-line-strong bg-bg/95 backdrop-blur safe-top">
        <div className="flex h-16 items-center gap-2 px-3 safe-x sm:gap-3 sm:px-5">
          <Link to={`/c/${ws.client.id}/meetings/${m.id}`} className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm text-muted hover:bg-surface-3 hover:text-ink" aria-label="Leave meeting mode (meeting keeps running)">
            <ChevronLeft size={18} aria-hidden /> <span className="hidden sm:inline">Exit</span>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] uppercase tracking-[0.14em] text-subtle">{ws.client.name} · Meeting Mode</p>
            <p className="truncate font-black tracking-tight">{m.title}</p>
          </div>
          <span className="tabular hidden items-center gap-1.5 text-sm text-muted sm:inline-flex" title="Elapsed / planned">
            <Timer size={15} aria-hidden /> {elapsed} / {planned} min
          </span>
          <SaveIndicator always />
          <Button variant="primary" icon={<Square size={14} className="fill-current" />} onClick={() => setConfirmEnd(true)}>
            <span className="hidden sm:inline">End meeting</span><span className="sm:hidden">End</span>
          </Button>
        </div>
        {/* Progress */}
        <ol className="flex h-1.5 gap-0.5 px-0" aria-label={`${prog.discussed} of ${prog.total} topics discussed`}>
          {m.agenda.map((a) => {
            const st = m.agendaState[a.id]?.status ?? 'pending';
            return <li key={a.id} className={cn('flex-1', st === 'discussed' ? 'bg-bsa-green' : st === 'skipped' ? 'bg-line-strong' : a.id === item.id ? 'bg-brand' : 'bg-surface-3')} style={{ flexGrow: Math.max(1, a.minutes) }} />;
          })}
        </ol>
      </header>

      <div className="grid flex-1 grid-cols-[minmax(0,1fr)] gap-0 lg:grid-cols-[17rem_minmax(0,1fr)] xl:grid-cols-[17rem_minmax(0,1fr)_22rem]">
        {/* Agenda */}
        <nav aria-label="Agenda" className="min-w-0 border-b border-line lg:border-b-0 lg:border-r">
          <ol className="flex gap-2 overflow-x-auto p-3 lg:flex-col lg:gap-1 lg:overflow-visible">
            {m.agenda.map((a, i) => {
              const st = m.agendaState[a.id]?.status ?? 'pending';
              const current = a.id === item.id;
              return (
                <li key={a.id} className="shrink-0 lg:shrink">
                  <button
                    type="button"
                    onClick={() => goTo(a.id)}
                    aria-current={current ? 'step' : undefined}
                    className={cn('relative flex min-h-14 w-56 items-center gap-3 rounded-lg border px-3 text-left transition-colors lg:w-full', current ? 'border-brand bg-surface-2' : 'border-transparent hover:bg-surface-2')}
                  >
                    <span className={cn('tabular flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-black', st === 'discussed' ? 'bg-bsa-green text-black' : st === 'skipped' ? 'border border-dashed border-line-strong text-subtle' : current ? 'bg-brand text-white' : 'border border-line-strong')}>
                      {st === 'discussed' ? <Check size={15} aria-hidden /> : st === 'skipped' ? <Minus size={15} aria-hidden /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-sm', current ? 'font-black' : 'font-bold', st === 'skipped' && 'text-subtle')}>{a.title}</span>
                      <span className="tabular block text-xs text-subtle">{a.minutes} min{m.notes[a.id] ? ' · notes' : ''}</span>
                    </span>
                    <span className="sr-only">{st}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Current topic */}
        <main id="main" className="flex min-w-0 flex-col gap-5 p-4 sm:p-6 lg:p-8">
          <div>
            <p className="eyebrow tabular">
              Topic {idx + 1} of {m.agenda.length} · {item.minutes} min planned
              {m.agendaState[item.id]?.startedAt && ` · ${minutesSince(m.agendaState[item.id]!.startedAt, now)} min in`}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-balance md:text-4xl">{item.title}</h1>
            {item.purpose && <p className="mt-2 max-w-3xl text-base text-muted md:text-lg">{item.purpose}</p>}
            {item.prompts.length > 0 && (
              <ul className="mt-4 flex flex-col gap-2">
                {item.prompts.map((p, i) => <li key={i} className="flex gap-2.5 text-[15px]"><CircleDot size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />{p}</li>)}
              </ul>
            )}
          </div>

          <StatusControl status={m.agendaState[item.id]?.status ?? 'pending'} onChange={(s) => silent((d) => setAgendaItemStatus(d, m.id, item.id, s))} />

          <NotesBox key={item.id} label={`Notes — ${item.title}`} value={m.notes[item.id] ?? ''} onSave={(t) => silent((d) => setMeetingNotes(d, m.id, item.id, t))} rows={9} />

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <QuickButton icon={<ClipboardPlus size={20} />} label="Action" onClick={() => open({ kind: 'action', id: null, defaults })} />
            <QuickButton icon={<Gavel size={20} />} label="Decision" onClick={() => open({ kind: 'decision', id: null, defaults })} />
            <QuickButton icon={<Flag size={20} />} label="Flag issue" onClick={() => open({ kind: 'risk', id: null, defaults: { ...defaults, kind: 'issue' } })} />
          </div>

          <details className="rounded-lg border border-line">
            <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm font-bold">General meeting notes{m.generalNotes ? ' · recorded' : ''}</summary>
            <div className="border-t border-line p-4">
              <NotesBox label="General notes" value={m.generalNotes} onSave={(t) => silent((d) => setMeetingNotes(d, m.id, null, t))} rows={5} />
            </div>
          </details>

          <div className="mt-auto grid grid-cols-2 gap-3 pt-2 safe-bottom">
            <Button size="lg" className="h-16 text-base" icon={<ChevronLeft size={22} />} disabled={idx === 0} onClick={prev}>Previous</Button>
            <Button size="lg" variant="primary" className="h-16 text-base" onClick={next}>
              {idx < m.agenda.length - 1 ? <>Next topic <ChevronRight size={22} aria-hidden /></> : <>Finish <LogOut size={20} aria-hidden /></>}
            </Button>
          </div>
        </main>

        {/* Context */}
        <ContextPanel ws={ws} m={m} onOpen={open} />
      </div>

      <ConfirmDialog open={confirmEnd} title="End the meeting?" confirmLabel="End & review closeout" onClose={() => setConfirmEnd(false)} onConfirm={end}>
        You’ll review topics, decisions, actions, owners and due dates before finalizing. You can resume facilitation from closeout if needed.
        <span className="mt-2 block text-subtle">{prog.discussed} of {prog.total} topics marked discussed.</span>
      </ConfirmDialog>
      {sheet}
    </div>
  );
}

function QuickButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick(): void }) {
  return (
    <button type="button" onClick={onClick} className="flex h-16 flex-col items-center justify-center gap-1 rounded-lg border border-line-strong bg-surface-2 text-sm font-bold hover:bg-surface-3 sm:flex-row sm:gap-2">
      <span className="text-accent">{icon}</span>
      <span>+ {label}</span>
    </button>
  );
}

function StatusControl({ status, onChange }: { status: AgendaItemStatus; onChange(s: AgendaItemStatus): void }) {
  const opts: { v: AgendaItemStatus; l: string }[] = [
    { v: 'pending', l: 'Open' },
    { v: 'discussed', l: 'Discussed' },
    { v: 'skipped', l: 'Skip' },
  ];
  return (
    <div role="radiogroup" aria-label="Topic status" className="flex self-start rounded-lg border border-line p-0.5">
      {opts.map((o) => (
        <button key={o.v} type="button" role="radio" aria-checked={status === o.v} onClick={() => onChange(o.v)} className={cn('h-11 rounded-md px-4 text-sm', status === o.v ? (o.v === 'discussed' ? 'bg-bsa-green font-bold text-black' : 'bg-surface-3 font-bold text-ink') : 'text-subtle hover:text-ink')}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

/** Notes with debounced autosave; flushes on blur and when switching topics (unmount). */
function NotesBox({ label, value, onSave, rows }: { label: string; value: string; onSave(t: string): void; rows: number }) {
  const [text, setText] = useState(value);
  const latest = useRef(text);
  const saved = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (latest.current !== saved.current) {
      saved.current = latest.current;
      onSave(latest.current);
    }
  }, [onSave]);
  useEffect(() => () => flush(), [flush]);
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-bold">{label}</span>
      <textarea
        value={text}
        rows={rows}
        onChange={(e) => {
          setText(e.target.value);
          latest.current = e.target.value;
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(flush, 700);
        }}
        onBlur={flush}
        placeholder="Capture discussion points. Record decisions and actions with the buttons below so they’re tracked."
        className="w-full rounded-lg border border-line bg-surface px-4 py-3 text-base leading-relaxed outline-none placeholder:text-subtle focus:border-accent"
      />
    </label>
  );
}

type ContextTab = 'captured' | 'attendees' | 'actions' | 'decisions' | 'context';

function ContextPanel({ ws, m, onOpen }: { ws: ClientWorkspace; m: Meeting; onOpen: ReturnType<typeof useRecordSheet>['open'] }) {
  const [tab, setTab] = useState<ContextTab>('captured');
  const caps = meetingCaptures(ws, m.id);
  const carried = carryover(ws, m).filter((a) => OPEN_ACTION_STATUSES.includes(a.status));
  const decisions = pendingDecisions(ws).filter((d) => d.meetingId !== m.id);
  const capturedCount = caps.actions.length + caps.confirmedDecisions.length + caps.proposedDecisions.length + caps.otherDecisions.length + caps.issues.length;
  const initiatives = useMemo(() => active(ws.initiatives).filter((i) => i.status !== 'complete' && i.status !== 'cancelled' && (!m.workstreamIds.length || (i.workstreamId && m.workstreamIds.includes(i.workstreamId)))), [ws.initiatives, m.workstreamIds]);

  const tabs: { id: ContextTab; label: string; n?: number }[] = [
    { id: 'captured', label: 'Captured', n: capturedCount },
    { id: 'attendees', label: 'Attendees', n: m.attendeeIds.length },
    { id: 'actions', label: 'Actions', n: carried.length },
    { id: 'decisions', label: 'Decisions', n: decisions.length },
    { id: 'context', label: 'Context' },
  ];

  return (
    <aside aria-label="Meeting context" className="border-t border-line xl:border-l xl:border-t-0 lg:col-span-2 xl:col-span-1">
      <div role="tablist" className="sticky top-[4.4rem] z-10 flex gap-1 overflow-x-auto border-b border-line bg-bg px-2">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn('relative min-h-12 shrink-0 px-2.5 text-sm', tab === t.id ? 'font-bold text-ink' : 'text-subtle hover:text-ink')}>
            {t.label}
            {t.n !== undefined && <span className="tabular ml-1.5 text-xs text-subtle">{t.n}</span>}
            {tab === t.id && <span className="absolute inset-x-2 bottom-0 h-0.5 bg-brand" aria-hidden />}
          </button>
        ))}
      </div>

      {tab === 'captured' && (
        <div className="flex flex-col">
          <PanelHeading>Actions assigned</PanelHeading>
          <ActionList ws={ws} actions={caps.actions} onOpen={(id) => onOpen({ kind: 'action', id })} empty="None yet — use + Action" showLinks={false} />
          <PanelHeading>Decisions</PanelHeading>
          <DecisionList ws={ws} decisions={[...caps.confirmedDecisions, ...caps.proposedDecisions, ...caps.otherDecisions]} onOpen={(id) => onOpen({ kind: 'decision', id })} empty="None yet — use + Decision" />
          <PanelHeading>Issues flagged</PanelHeading>
          <RiskList ws={ws} risks={caps.issues} onOpen={(id) => onOpen({ kind: 'risk', id })} empty="None flagged" />
        </div>
      )}
      {tab === 'actions' && (
        <div>
          <p className="px-4 pt-3 text-xs text-subtle sm:px-5">Open actions carried into this meeting. Update status as you review them.</p>
          <ActionList ws={ws} actions={carried} onOpen={(id) => onOpen({ kind: 'action', id })} empty="No open actions carried over" />
        </div>
      )}
      {tab === 'decisions' && (
        <div>
          <p className="px-4 pt-3 text-xs text-subtle sm:px-5">Decisions still proposed or under review. Record approval only when explicitly confirmed.</p>
          <DecisionList ws={ws} decisions={decisions} onOpen={(id) => onOpen({ kind: 'decision', id })} empty="No pending decisions" />
        </div>
      )}
      {tab === 'attendees' && <AttendeesPanel ws={ws} m={m} />}
      {tab === 'context' && (
        <div className="flex flex-col gap-5 p-4 sm:p-5">
          {m.objectives.length > 0 && (
            <section>
              <p className="eyebrow mb-2 flex items-center gap-1.5 text-ink"><ListChecks size={13} aria-hidden /> Objectives</p>
              <ul className="flex flex-col gap-1.5 text-sm">{m.objectives.map((o, i) => <li key={i} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-ink" aria-hidden />{o}</li>)}</ul>
            </section>
          )}
          <section>
            <p className="eyebrow mb-2 flex items-center gap-1.5 text-ink"><Target size={13} aria-hidden /> Related action plans</p>
            {initiatives.length === 0 ? (
              <p className="text-sm text-subtle">None.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {initiatives.map((i) => (
                  <li key={i.id} className="flex items-start gap-2 py-2 text-sm">
                    <span className="flex-1">
                      <span className="block font-bold">{i.title}</span>
                      <span className="text-xs text-subtle">{ws.people.find((p) => p.id === i.championId)?.fullName ?? 'Champion unassigned'}</span>
                    </span>
                    <InitiativeStatusBadge status={i.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </aside>
  );
}

/** Who is in the room. Editable while the meeting runs; saved immediately and included in the record. */
function AttendeesPanel({ ws, m }: { ws: ClientWorkspace; m: Meeting }) {
  const o = useStrategyOptions(ws);
  const team = [...new Set(active(ws.memberships).map((x) => x.personId))].filter((id) => o.people.some((p) => p.id === id && p.active && !p.archivedAt));
  const missingTeam = team.filter((id) => !m.attendeeIds.includes(id));
  const save = (ids: string[]) => run((d) => setMeetingAttendees(d, m.id, ids), { clientId: ws.client.id, entity: 'meeting', entityId: m.id, summary: `Updated attendees of "${m.title}"` }, false);
  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      <PeoplePicker label="Attendees" hint="Anyone in this workspace. Add new people under Leadership → People." people={o.people} value={m.attendeeIds} onChange={save} />
      {missingTeam.length > 0 && (
        <Button size="sm" icon={<Users size={15} />} className="self-start" onClick={() => save([...m.attendeeIds, ...missingTeam])}>
          Add all Client Team members ({missingTeam.length})
        </Button>
      )}
      {m.facilitatorId && <p className="text-xs text-subtle">Facilitator: {ws.people.find((p) => p.id === m.facilitatorId)?.fullName ?? 'Unknown'}</p>}
    </div>
  );
}

function PanelHeading({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow border-b border-line bg-surface px-4 py-2 text-ink sm:px-5">{children}</p>;
}
