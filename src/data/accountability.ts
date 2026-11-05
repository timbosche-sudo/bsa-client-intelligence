/**
 * Accountability views (Part 10.4): who owns what, across workstreams. Pure and client-scoped:
 * every function takes a ClientWorkspace, so another client's commitments can never appear.
 */
import { OPEN_ACTION_STATUSES, PENDING_DECISION_STATUSES } from '@/domain/labels';
import type { ActionItem, Decision, ID, Initiative, Person, Risk } from '@/domain/types';
import { active, isOverdue, todayIso, type ClientWorkspace } from './repository';

export type RaciRole = 'accountable' | 'supporting' | 'consulted' | 'informed';

export const RACI_LABELS: Record<RaciRole, string> = {
  accountable: 'Accountable',
  supporting: 'Supporting',
  consulted: 'Consulted',
  informed: 'Informed',
};

type RaciRecord = { participantIds: ID[]; consultedIds: ID[]; informedIds: ID[] };

export function roleOf(rec: RaciRecord & { ownerId?: ID | null; championId?: ID | null }, personId: ID): RaciRole | null {
  if (rec.ownerId === personId || rec.championId === personId) return 'accountable';
  if (rec.participantIds.includes(personId)) return 'supporting';
  if (rec.consultedIds?.includes(personId)) return 'consulted';
  if (rec.informedIds?.includes(personId)) return 'informed';
  return null;
}

const isOpenAction = (a: ActionItem) => OPEN_ACTION_STATUSES.includes(a.status);
const isOpenInitiative = (i: Initiative) => i.status !== 'complete' && i.status !== 'cancelled';
const isPendingDecision = (d: Decision) => PENDING_DECISION_STATUSES.includes(d.status);
const isOpenRisk = (r: Risk) => r.status !== 'closed';
const byDue = (a: ActionItem, b: ActionItem) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999');

export interface PersonCommitments {
  person: Person | null;
  actions: { accountable: ActionItem[]; supporting: ActionItem[]; consultedInformed: ActionItem[] };
  completedRecently: ActionItem[];
  initiatives: { champion: Initiative[]; involved: Initiative[] };
  decisions: { owned: Decision[]; involved: Decision[]; recentApproved: Decision[] };
  risks: Risk[];
  checklistItems: { checklistId: ID; projectId: ID; itemTitle: string; dueDate: string | null; status: string }[];
  overdue: number;
}

export function commitmentsFor(ws: ClientWorkspace, personId: ID, today = todayIso()): PersonCommitments {
  const actions = active(ws.actions);
  const openActions = actions.filter(isOpenAction);
  const initiatives = active(ws.initiatives).filter(isOpenInitiative);
  const decisions = active(ws.decisions);
  const accountable = openActions.filter((a) => a.ownerId === personId).sort(byDue);
  const recentCutoff = new Date(Date.parse(today) - 30 * 86400000).toISOString().slice(0, 10);
  return {
    person: ws.people.find((p) => p.id === personId) ?? null,
    actions: {
      accountable,
      supporting: openActions.filter((a) => roleOf(a, personId) === 'supporting').sort(byDue),
      consultedInformed: openActions.filter((a) => ['consulted', 'informed'].includes(roleOf(a, personId) ?? '')).sort(byDue),
    },
    completedRecently: actions.filter((a) => a.status === 'complete' && roleOf(a, personId) && (a.completedAt ?? '') >= recentCutoff),
    initiatives: {
      champion: initiatives.filter((i) => i.championId === personId),
      involved: initiatives.filter((i) => i.championId !== personId && roleOf(i, personId)),
    },
    decisions: {
      owned: decisions.filter((d) => d.ownerId === personId && isPendingDecision(d)),
      involved: decisions.filter((d) => d.ownerId !== personId && isPendingDecision(d) && roleOf(d, personId)),
      // Recent decisions affecting their work: approved decisions they are part of, or on initiatives they champion.
      recentApproved: decisions
        .filter((d) => d.status === 'approved' && (roleOf(d, personId) || (d.initiativeId && initiatives.some((i) => i.id === d.initiativeId && i.championId === personId))))
        .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
    },
    risks: active(ws.risks).filter((r) => r.ownerId === personId && isOpenRisk(r)),
    checklistItems: active(ws.checklists).flatMap((c) =>
      c.items.filter((i) => i.ownerId === personId && i.status !== 'complete' && i.status !== 'not_applicable').map((i) => ({ checklistId: c.id, projectId: c.projectId, itemTitle: i.title, dueDate: i.dueDate, status: i.status })),
    ),
    overdue: accountable.filter((a) => isOverdue(a, today)).length,
  };
}

export interface PersonSummaryRow {
  person: Person;
  openOwned: number;
  overdue: number;
  supporting: number;
  championing: number;
  pendingDecisions: number;
  openRisks: number;
}

/** One row per person with any open commitment, sorted by load (overdue first). */
export function commitmentSummary(ws: ClientWorkspace, today = todayIso()): PersonSummaryRow[] {
  return ws.people
    .map((person) => {
      const c = commitmentsFor(ws, person.id, today);
      return {
        person,
        openOwned: c.actions.accountable.length,
        overdue: c.overdue,
        supporting: c.actions.supporting.length,
        championing: c.initiatives.champion.length,
        pendingDecisions: c.decisions.owned.length,
        openRisks: c.risks.length,
      };
    })
    .filter((r) => r.openOwned + r.supporting + r.championing + r.pendingDecisions + r.openRisks > 0)
    .sort((a, b) => b.overdue - a.overdue || b.openOwned - a.openOwned || a.person.fullName.localeCompare(b.person.fullName));
}

export interface WorkstreamSummaryRow {
  workstreamId: ID | null;
  title: string;
  order: number;
  openActions: number;
  overdue: number;
  unassigned: number;
  activeInitiatives: number;
  pendingDecisions: number;
  openRisks: number;
}

export function workstreamSummary(ws: ClientWorkspace, today = todayIso()): WorkstreamSummaryRow[] {
  const streams = active(ws.workstreams).sort((a, b) => a.order - b.order);
  const row = (id: ID | null, title: string, order: number): WorkstreamSummaryRow => {
    const acts = active(ws.actions).filter((a) => a.workstreamId === id && isOpenAction(a));
    return {
      workstreamId: id,
      title,
      order,
      openActions: acts.length,
      overdue: acts.filter((a) => isOverdue(a, today)).length,
      unassigned: acts.filter((a) => !a.ownerId).length,
      activeInitiatives: active(ws.initiatives).filter((i) => i.workstreamId === id && isOpenInitiative(i)).length,
      pendingDecisions: active(ws.decisions).filter((d) => d.workstreamId === id && isPendingDecision(d)).length,
      openRisks: active(ws.risks).filter((r) => r.workstreamId === id && isOpenRisk(r)).length,
    };
  };
  const rows = streams.map((w) => row(w.id, w.title, w.order));
  const none = row(null, 'No initiative', 999);
  if (none.openActions + none.activeInitiatives + none.pendingDecisions + none.openRisks > 0) rows.push(none);
  return rows;
}
