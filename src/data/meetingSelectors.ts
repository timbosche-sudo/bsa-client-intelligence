/** Derived meeting views: captures, continuity between meetings, and rule-based next-topic suggestions. */
import { OPEN_ACTION_STATUSES, PENDING_DECISION_STATUSES } from '@/domain/labels';
import type { ActionItem, AgendaItem, Decision, ID, Meeting, Milestone, Risk } from '@/domain/types';
import { active, isOverdue, todayIso, type ClientWorkspace } from './repository';

export const agendaMinutes = (agenda: AgendaItem[]) => agenda.reduce((s, a) => s + (Number.isFinite(a.minutes) ? a.minutes : 0), 0);

/** Sort key: scheduled time, else start time, else creation. */
export const meetingTime = (m: Meeting) => m.startsAt ?? m.startedAt ?? m.createdAt;

export interface MeetingCaptures {
  actions: ActionItem[];
  confirmedDecisions: Decision[];
  proposedDecisions: Decision[];
  otherDecisions: Decision[];
  issues: Risk[];
}

export function meetingCaptures(ws: ClientWorkspace, meetingId: ID): MeetingCaptures {
  const decisions = ws.decisions.filter((d) => d.meetingId === meetingId);
  return {
    actions: ws.actions.filter((a) => a.meetingId === meetingId),
    confirmedDecisions: decisions.filter((d) => d.status === 'approved'),
    proposedDecisions: decisions.filter((d) => PENDING_DECISION_STATUSES.includes(d.status)),
    otherDecisions: decisions.filter((d) => d.status !== 'approved' && !PENDING_DECISION_STATUSES.includes(d.status)),
    issues: ws.risks.filter((r) => r.meetingId === meetingId),
  };
}

/** The most recent finalized meeting held before this one. */
export function previousMeeting(ws: ClientWorkspace, m: Meeting): Meeting | null {
  const t = meetingTime(m);
  return (
    active(ws.meetings)
      .filter((x) => x.id !== m.id && x.status === 'finalized' && meetingTime(x) < t)
      .sort((a, b) => meetingTime(b).localeCompare(meetingTime(a)))[0] ?? null
  );
}

export interface ChangesSince {
  since: string;
  completedActions: ActionItem[];
  newActions: ActionItem[];
  approvedDecisions: Decision[];
  newIssues: Risk[];
}

/** What changed between the previous meeting's finalization and now (or this meeting's start). */
export function changesSince(ws: ClientWorkspace, since: string, until: string, excludeMeetingId?: ID): ChangesSince {
  const sinceDate = since.slice(0, 10);
  const inWindow = (t: string | null | undefined) => !!t && t >= since && t <= until;
  return {
    since,
    completedActions: active(ws.actions).filter((a) => a.status === 'complete' && !!a.completedAt && a.completedAt >= sinceDate && a.completedAt <= until.slice(0, 10)),
    newActions: active(ws.actions).filter((a) => a.meetingId !== excludeMeetingId && inWindow(a.createdAt)),
    approvedDecisions: active(ws.decisions).filter((d) => d.status === 'approved' && inWindow(d.approval?.approvedAt)),
    newIssues: active(ws.risks).filter((r) => r.kind !== 'opportunity' && r.meetingId !== excludeMeetingId && inWindow(r.createdAt)),
  };
}

/** Carried-over actions with their *current* status (so closeout shows what moved during the meeting). */
export function carryover(ws: ClientWorkspace, m: Meeting): ActionItem[] {
  return m.carryoverActionIds.map((id) => ws.actions.find((a) => a.id === id)).filter((a): a is ActionItem => !!a);
}

export function upcomingMilestonesWithin(ws: ClientWorkspace, days: number, today = todayIso()): Milestone[] {
  const limit = new Date(Date.parse(today) + days * 86400000).toISOString().slice(0, 10);
  return active(ws.milestones)
    .filter((m) => m.status === 'upcoming' && (!m.date || (m.date >= today && m.date <= limit)))
    .sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));
}

export interface TopicSuggestion {
  topic: string;
  reason: string;
}

/**
 * Deterministic (rule-based, not AI) suggestions for the next meeting, each with its reason.
 * The facilitator chooses which to keep.
 */
export function suggestNextTopics(ws: ClientWorkspace, m: Meeting, today = todayIso()): TopicSuggestion[] {
  const out: TopicSuggestion[] = [];
  const add = (topic: string, reason: string) => !out.some((s) => s.topic === topic) && out.push({ topic, reason });
  m.agenda.forEach((a) => {
    const st = m.agendaState[a.id]?.status ?? 'pending';
    if (st !== 'discussed') add(`Revisit: ${a.title}`, st === 'skipped' ? 'Skipped in this meeting' : 'Not marked as discussed');
  });
  const caps = meetingCaptures(ws, m.id);
  caps.proposedDecisions.forEach((d) => add(`Decide: ${d.title}`, 'Decision still proposed or under review'));
  caps.issues.filter((r) => r.status !== 'closed').forEach((r) => add(`Resolve issue: ${r.title}`, 'Flagged in this meeting and still open'));
  const open = active(ws.actions).filter((a) => OPEN_ACTION_STATUSES.includes(a.status));
  const overdue = open.filter((a) => isOverdue(a, today));
  if (overdue.length) add(`Review ${overdue.length} overdue action${overdue.length === 1 ? '' : 's'}`, 'Past due and still open');
  const unowned = open.filter((a) => !a.ownerId);
  if (unowned.length) add(`Assign owners to ${unowned.length} action${unowned.length === 1 ? '' : 's'}`, 'Open actions without an accountable owner');
  const blocked = open.filter((a) => a.status === 'blocked');
  if (blocked.length) add(`Unblock ${blocked.length} action${blocked.length === 1 ? '' : 's'}`, 'Marked as blocked');
  active(ws.risks)
    .filter((r) => r.kind !== 'opportunity' && r.status !== 'closed' && (r.severity === 'critical' || r.severity === 'high') && r.meetingId !== m.id)
    .forEach((r) => add(`Address: ${r.title}`, `Open ${r.severity} ${r.kind}`));
  upcomingMilestonesWithin(ws, 60, today)
    .filter((x) => x.date)
    .forEach((x) => add(`Prepare for: ${x.title}`, `Milestone on ${x.date}`));
  return out;
}

export function meetingProgress(m: Meeting) {
  const total = m.agenda.length;
  const discussed = m.agenda.filter((a) => m.agendaState[a.id]?.status === 'discussed').length;
  const skipped = m.agenda.filter((a) => m.agendaState[a.id]?.status === 'skipped').length;
  return { total, discussed, skipped, pending: total - discussed - skipped };
}
