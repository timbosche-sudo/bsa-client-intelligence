/**
 * Guided Meeting Mode mutations (Part 11).
 *
 * Lifecycle: scheduled → in_progress → closeout → finalized. A finalized meeting is read-only;
 * changing it requires an amendment with a recorded reason, after which it must be finalized again.
 */
import { newId, nowIso } from '@/domain/ids';
import { OPEN_ACTION_STATUSES } from '@/domain/labels';
import type { AgendaItem, AgendaItemStatus, Dataset, ID, Meeting, MeetingRecordSnapshot, MeetingTemplate } from '@/domain/types';
import { IntegrityError } from './mutations';

const base = () => {
  const ts = nowIso();
  return { createdAt: ts, updatedAt: ts, archivedAt: null };
};

function find(d: Dataset, id: ID): Meeting {
  const m = d.meetings.find((x) => x.id === id);
  if (!m) throw new IntegrityError('Meeting not found.');
  return m;
}

function save(d: Dataset, m: Meeting): void {
  const i = d.meetings.findIndex((x) => x.id === m.id);
  const next = { ...m, updatedAt: nowIso() };
  if (i === -1) d.meetings.push(next);
  else d.meetings[i] = next;
}

const assertEditable = (m: Meeting) => {
  if (m.status === 'finalized') throw new IntegrityError('This meeting record is finalized. Start an amendment to change it.');
  if (m.status === 'cancelled') throw new IntegrityError('This meeting was cancelled.');
};

/** Fresh agenda item ids so meetings never share ids with their template. */
export const cloneAgenda = (agenda: AgendaItem[]): AgendaItem[] => agenda.map((a) => ({ ...a, id: newId('ag'), prompts: [...a.prompts] }));

export function blankMeeting(clientId: ID, template?: MeetingTemplate | null): Meeting {
  return {
    id: newId('meeting'),
    ...base(),
    clientId,
    title: template?.name ?? '',
    startsAt: null,
    location: '',
    facilitatorId: null,
    attendeeIds: [],
    objectives: [...(template?.objectives ?? [])],
    workstreamIds: [],
    templateId: template?.id ?? null,
    agenda: cloneAgenda(template?.agenda ?? []),
    notes: {},
    generalNotes: '',
    agendaState: {},
    currentAgendaItemId: null,
    status: 'scheduled',
    startedAt: null,
    endedAt: null,
    carryoverActionIds: [],
    summary: '',
    nextMeetingTopics: [],
    finalizedAt: null,
    finalizedById: null,
    finalizedByName: null,
    record: null,
    amendments: [],
  };
}

export function validateMeeting(m: Meeting): string[] {
  const e: string[] = [];
  if (!m.title.trim()) e.push('Give the meeting a title.');
  if (m.agenda.some((a) => !a.title.trim())) e.push('Every agenda item needs a title.');
  if (m.agenda.some((a) => !Number.isFinite(a.minutes) || a.minutes < 0)) e.push('Agenda durations must be zero or more minutes.');
  return e;
}

/** Saves meeting details/agenda. Agenda items removed from the meeting take their notes with them. */
export function upsertMeeting(d: Dataset, m: Meeting): void {
  const existing = d.meetings.find((x) => x.id === m.id);
  if (existing) assertEditable(existing);
  const problems = validateMeeting(m);
  if (problems.length) throw new IntegrityError(problems[0], problems);
  if (!d.clients.some((c) => c.id === m.clientId)) throw new IntegrityError('Client not found.');
  const ids = new Set(m.agenda.map((a) => a.id));
  save(d, {
    ...m,
    title: m.title.trim(),
    objectives: m.objectives.map((o) => o.trim()).filter(Boolean),
    agenda: m.agenda.map((a) => ({ ...a, title: a.title.trim(), prompts: a.prompts.map((p) => p.trim()).filter(Boolean) })),
    notes: Object.fromEntries(Object.entries(m.notes).filter(([k]) => ids.has(k))),
    agendaState: Object.fromEntries(Object.entries(m.agendaState).filter(([k]) => ids.has(k))),
    currentAgendaItemId: m.currentAgendaItemId && ids.has(m.currentAgendaItemId) ? m.currentAgendaItemId : m.agenda[0]?.id ?? null,
  });
}

/** Starts (or resumes) facilitation. Captures the open actions carried into the meeting. */
export function startMeeting(d: Dataset, id: ID): void {
  const m = find(d, id);
  assertEditable(m);
  if (m.status === 'in_progress') return;
  if (m.status !== 'scheduled' && m.status !== 'closeout') throw new IntegrityError('This meeting cannot be started.');
  const ts = nowIso();
  const carryover =
    m.status === 'scheduled'
      ? d.actions.filter((a) => a.clientId === m.clientId && !a.archivedAt && a.meetingId !== m.id && OPEN_ACTION_STATUSES.includes(a.status)).map((a) => a.id)
      : m.carryoverActionIds;
  const first = m.currentAgendaItemId ?? m.agenda[0]?.id ?? null;
  save(d, {
    ...m,
    status: 'in_progress',
    startedAt: m.startedAt ?? ts,
    carryoverActionIds: carryover,
    currentAgendaItemId: first,
    agendaState: first && !m.agendaState[first]?.startedAt ? { ...m.agendaState, [first]: { status: m.agendaState[first]?.status ?? 'pending', startedAt: ts } } : m.agendaState,
  });
}

/** Free navigation: any item can be opened in any order. */
export function goToAgendaItem(d: Dataset, id: ID, itemId: ID, markPrevious?: AgendaItemStatus): void {
  const m = find(d, id);
  assertEditable(m);
  if (!m.agenda.some((a) => a.id === itemId)) throw new IntegrityError('Agenda item not found.');
  const state = { ...m.agendaState };
  if (markPrevious && m.currentAgendaItemId && m.currentAgendaItemId !== itemId) {
    state[m.currentAgendaItemId] = { startedAt: state[m.currentAgendaItemId]?.startedAt ?? null, status: markPrevious };
  }
  if (!state[itemId]?.startedAt) state[itemId] = { status: state[itemId]?.status ?? 'pending', startedAt: nowIso() };
  save(d, { ...m, currentAgendaItemId: itemId, agendaState: state });
}

export function setAgendaItemStatus(d: Dataset, id: ID, itemId: ID, status: AgendaItemStatus): void {
  const m = find(d, id);
  assertEditable(m);
  save(d, { ...m, agendaState: { ...m.agendaState, [itemId]: { startedAt: m.agendaState[itemId]?.startedAt ?? null, status } } });
}

/** Notes for an agenda item, or general meeting notes when itemId is null. */
export function setMeetingNotes(d: Dataset, id: ID, itemId: ID | null, text: string): void {
  const m = find(d, id);
  assertEditable(m);
  save(d, itemId ? { ...m, notes: { ...m.notes, [itemId]: text } } : { ...m, generalNotes: text });
}

/** Attendees can be changed until the record is finalized (e.g. someone joins once the meeting has started). */
export function setMeetingAttendees(d: Dataset, id: ID, attendeeIds: ID[]): void {
  const m = find(d, id);
  assertEditable(m);
  save(d, { ...m, attendeeIds: [...new Set(attendeeIds)] });
}

export function updateCloseout(d: Dataset, id: ID, patch: Partial<Pick<Meeting, 'summary' | 'nextMeetingTopics'>>): void {
  const m = find(d, id);
  assertEditable(m);
  save(d, { ...m, ...patch });
}

/** Ends facilitation and moves to closeout review. The current item is marked discussed. */
export function endMeeting(d: Dataset, id: ID): void {
  const m = find(d, id);
  assertEditable(m);
  if (m.status !== 'in_progress') throw new IntegrityError('Only a meeting in progress can be ended.');
  const state = { ...m.agendaState };
  if (m.currentAgendaItemId && (state[m.currentAgendaItemId]?.status ?? 'pending') === 'pending') {
    state[m.currentAgendaItemId] = { startedAt: state[m.currentAgendaItemId]?.startedAt ?? null, status: 'discussed' };
  }
  save(d, { ...m, status: 'closeout', endedAt: nowIso(), agendaState: state });
}

const personName = (d: Dataset, id: ID | null | undefined) => (id ? d.people.find((p) => p.id === id)?.fullName ?? null : null);

export function buildSnapshot(d: Dataset, m: Meeting, finalizedBy: string, at: string): MeetingRecordSnapshot {
  return {
    finalizedAt: at,
    finalizedBy,
    attendees: m.attendeeIds.map((id) => personName(d, id) ?? 'Unknown'),
    facilitator: personName(d, m.facilitatorId),
    topics: m.agenda.map((a) => ({ title: a.title, status: m.agendaState[a.id]?.status ?? 'pending', notes: m.notes[a.id] ?? '' })),
    generalNotes: m.generalNotes,
    summary: m.summary,
    actions: d.actions.filter((a) => a.meetingId === m.id).map((a) => ({ id: a.id, title: a.title, owner: personName(d, a.ownerId), dueDate: a.dueDate, status: a.status })),
    decisions: d.decisions.filter((x) => x.meetingId === m.id).map((x) => ({ id: x.id, title: x.title, status: x.status, approvedBy: personName(d, x.approval?.approvedById) })),
    issues: d.risks.filter((r) => r.meetingId === m.id).map((r) => ({ id: r.id, title: r.title, severity: r.severity, status: r.status })),
    carriedOver: m.carryoverActionIds
      .map((id) => d.actions.find((a) => a.id === id))
      .filter((a) => !!a)
      .map((a) => ({ id: a!.id, title: a!.title, owner: personName(d, a!.ownerId), status: a!.status })),
    nextMeetingTopics: [...m.nextMeetingTopics],
  };
}

/** Explicit human approval is required (Part 11.4): who approves, and an acknowledgement. */
export function finalizeMeeting(d: Dataset, id: ID, input: { approvedBy: string; acknowledged: boolean }): void {
  const m = find(d, id);
  if (m.status !== 'closeout') throw new IntegrityError('End the meeting and review the closeout before finalizing.');
  if (!input.acknowledged) throw new IntegrityError('Confirm you have reviewed the record before finalizing.');
  if (!input.approvedBy.trim()) throw new IntegrityError('Record who is approving the final record.');
  const at = nowIso();
  save(d, {
    ...m,
    status: 'finalized',
    finalizedAt: at,
    finalizedByName: input.approvedBy.trim(),
    record: buildSnapshot(d, m, input.approvedBy.trim(), at),
    amendments: m.amendments.map((a) => (a.completedAt ? a : { ...a, completedAt: at })),
  });
}

/** Controlled amendment: reopens a finalized record for closeout edits, with a recorded reason. */
export function startAmendment(d: Dataset, id: ID, input: { reason: string; requestedBy: string }): void {
  const m = find(d, id);
  if (m.status !== 'finalized') throw new IntegrityError('Only finalized meetings can be amended.');
  if (!input.reason.trim() || !input.requestedBy.trim()) throw new IntegrityError('Record who is amending the record and why.');
  save(d, { ...m, status: 'closeout', amendments: [...m.amendments, { id: newId('amend'), reason: input.reason.trim(), requestedBy: input.requestedBy.trim(), startedAt: nowIso(), completedAt: null }] });
}

export function cancelMeeting(d: Dataset, id: ID): void {
  const m = find(d, id);
  if (m.status === 'finalized') throw new IntegrityError('A finalized meeting cannot be cancelled.');
  save(d, { ...m, status: 'cancelled' });
}

export function findMeetingReferences(d: Dataset, id: ID): string[] {
  const refs: string[] = [];
  const m = d.meetings.find((x) => x.id === id);
  if (m && m.status !== 'scheduled' && m.status !== 'cancelled') refs.push('The meeting has been held — its record is part of the history.');
  d.actions.filter((a) => a.meetingId === id).forEach((a) => refs.push(`Action "${a.title}"`));
  d.decisions.filter((x) => x.meetingId === id).forEach((x) => refs.push(`Decision "${x.title}"`));
  d.risks.filter((r) => r.meetingId === id).forEach((r) => refs.push(`Issue "${r.title}"`));
  return refs;
}

export interface MeetingDeletionImpact {
  held: boolean;
  finalized: boolean;
  actions: number;
  decisions: number;
  /** Approved decisions are never deleted (governance rule); they are kept, unlinked and archived. */
  approvedDecisions: number;
  issues: number;
  reports: number;
}

export function meetingDeletionImpact(d: Dataset, id: ID): MeetingDeletionImpact {
  const m = find(d, id);
  const decisions = d.decisions.filter((x) => x.meetingId === id);
  return {
    held: m.status !== 'scheduled' && m.status !== 'cancelled',
    finalized: m.status === 'finalized',
    actions: d.actions.filter((a) => a.meetingId === id).length,
    decisions: decisions.length,
    approvedDecisions: decisions.filter((x) => x.status === 'approved').length,
    issues: d.risks.filter((r) => r.meetingId === id).length,
    reports: d.reports.filter((r) => r.parameters?.meetingId === id).length,
  };
}

/**
 * Permanently deletes a meeting, including one that was held or finalized (e.g. a practice run).
 * Captured items are either kept and unlinked, or removed with the meeting (`removeCaptured`).
 * Approved decisions, and decisions another decision supersedes, are never deleted: they are
 * kept, unlinked and archived. Generated reports keep their frozen content.
 */
export function deleteMeeting(d: Dataset, id: ID, opts: { removeCaptured: boolean } = { removeCaptured: false }): void {
  find(d, id);
  const ts = nowIso();
  const unlink = <T extends { meetingId: ID | null; updatedAt: string }>(x: T) => Object.assign(x, { meetingId: null, updatedAt: ts });
  if (opts.removeCaptured) {
    const removedActions = new Set(d.actions.filter((a) => a.meetingId === id).map((a) => a.id));
    d.actions = d.actions.filter((a) => !removedActions.has(a.id));
    d.meetings.forEach((m) => {
      if (m.carryoverActionIds.some((a) => removedActions.has(a))) m.carryoverActionIds = m.carryoverActionIds.filter((a) => !removedActions.has(a));
    });
    d.risks = d.risks.filter((r) => r.meetingId !== id);
    const protectedIds = new Set(d.decisions.map((x) => x.supersededById).filter(Boolean));
    d.decisions = d.decisions.filter((x) => {
      if (x.meetingId !== id) return true;
      if (x.status === 'approved' || protectedIds.has(x.id)) {
        unlink(x);
        x.archivedAt = x.archivedAt ?? ts;
        return true;
      }
      return false;
    });
  } else {
    d.actions.filter((a) => a.meetingId === id).forEach(unlink);
    d.decisions.filter((x) => x.meetingId === id).forEach(unlink);
    d.risks.filter((r) => r.meetingId === id).forEach(unlink);
  }
  d.meetings = d.meetings.filter((m) => m.id !== id);
}

/* ───────────────────────── Templates ───────────────────────── */

export function blankMeetingTemplate(clientId: ID | null): MeetingTemplate {
  return { id: newId('template'), ...base(), clientId, name: '', description: '', objectives: [], agenda: [] };
}

export function upsertMeetingTemplate(d: Dataset, t: MeetingTemplate): void {
  if (!t.name.trim()) throw new IntegrityError('A template needs a name.');
  if (!t.agenda.length) throw new IntegrityError('A template needs at least one agenda item.');
  if (t.agenda.some((a) => !a.title.trim() || a.minutes < 0)) throw new IntegrityError('Each agenda item needs a title and a duration of zero or more minutes.');
  const i = d.meetingTemplates.findIndex((x) => x.id === t.id);
  const next = { ...t, name: t.name.trim(), updatedAt: nowIso() };
  if (i === -1) d.meetingTemplates.push(next);
  else d.meetingTemplates[i] = next;
}

export function setMeetingTemplateArchived(d: Dataset, id: ID, archived: boolean): void {
  const t = d.meetingTemplates.find((x) => x.id === id);
  if (t) Object.assign(t, { archivedAt: archived ? nowIso() : null, updatedAt: nowIso() });
}

/** Saves a meeting's (edited) agenda as a reusable template. */
export function templateFromMeeting(m: Meeting, name: string): MeetingTemplate {
  return { ...blankMeetingTemplate(m.clientId), name, description: `Created from "${m.title}".`, objectives: [...m.objectives], agenda: cloneAgenda(m.agenda) };
}
