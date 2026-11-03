/**
 * Client-scoped data access.
 *
 * Every read the UI performs for a workspace goes through `getWorkspace`, which returns ONLY the
 * records belonging to that client. Reports (Stage 5) are generated from a ClientWorkspace, so
 * cross-client leakage is prevented structurally rather than by UI filtering.
 */
import { OPEN_ACTION_STATUSES, PENDING_DECISION_STATUSES } from '@/domain/labels';
import {
  CLIENT_SCOPED_COLLECTIONS,
  type ActionItem,
  type Client,
  type Dataset,
  type ID,
  type MediaRecord,
  type MeetingTemplate,
  type Person,
  type Project,
} from '@/domain/types';

type ScopedSlice = { [K in (typeof CLIENT_SCOPED_COLLECTIONS)[number]]: Dataset[K] };

export interface ClientWorkspace extends ScopedSlice {
  client: Client;
  /** People referenced by this workspace (team members and record owners). */
  people: Person[];
  meetingTemplates: MeetingTemplate[];
  /** Media for this client's projects and for people referenced by this workspace. */
  media: MediaRecord[];
}

export class WorkspaceNotFoundError extends Error {}

export function listClients(data: Dataset, { includeArchived = false } = {}): Client[] {
  return data.clients
    .filter((c) => includeArchived || (!c.archivedAt && c.status !== 'archived'))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getWorkspace(data: Dataset, clientId: ID): ClientWorkspace {
  const client = data.clients.find((c) => c.id === clientId);
  if (!client) throw new WorkspaceNotFoundError(`Client workspace "${clientId}" was not found.`);

  const slice = Object.fromEntries(
    CLIENT_SCOPED_COLLECTIONS.map((key) => [key, (data[key] as { clientId: ID }[]).filter((r) => r.clientId === clientId)]),
  ) as ScopedSlice;

  const referenced = new Set<ID>();
  const add = (id: ID | null | undefined) => id && referenced.add(id);
  add(client.relationshipLeadId);
  add(client.executiveSponsorId);
  slice.memberships.forEach((m) => add(m.personId));
  slice.workstreams.forEach((w) => add(w.championId));
  slice.initiatives.forEach((i) => (add(i.championId), i.participantIds.forEach(add)));
  slice.actions.forEach((a) => (add(a.ownerId), a.participantIds.forEach(add)));
  slice.decisions.forEach((d) => (add(d.ownerId), d.participantIds.forEach(add)));
  slice.risks.forEach((r) => add(r.ownerId));
  slice.meetings.forEach((m) => (add(m.facilitatorId), m.attendeeIds.forEach(add)));
  slice.projects.forEach((p) => {
    const d = p.delivery;
    [p.businessDevelopment.relationshipPrincipalId, p.businessDevelopment.pursuitPrincipalId, d.projectExecutiveId, d.projectManagerId, d.designLeaderId, d.planningLeaderId, d.engineeringLeaderId].forEach(add);
    d.disciplineLeads.forEach((l) => add(l.personId));
  });

  const people = data.people.filter((p) => referenced.has(p.id) || p.homeClientId === clientId);
  const peopleIds = new Set(people.map((p) => p.id));
  return {
    client,
    ...slice,
    people,
    meetingTemplates: data.meetingTemplates.filter((t) => t.clientId === null || t.clientId === clientId),
    media: (data.media ?? []).filter((m) => (m.ownerType === 'project' ? m.clientId === clientId : peopleIds.has(m.ownerId))),
  };
}

/**
 * People that may be added to a client's workspace: BSA personnel, independent external people,
 * and this client's own contacts. Other clients' contacts are excluded.
 */
export function assignablePeople(data: Dataset, clientId: ID): Person[] {
  return data.people
    .filter((p) => !p.archivedAt && (p.homeClientId === null || p.homeClientId === clientId))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

/* ───────────── Derived views (deterministic, no invented values) ───────────── */

export const active = <T extends { archivedAt: string | null }>(rows: T[]): T[] => rows.filter((r) => !r.archivedAt);

export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isOverdue(a: ActionItem, today = todayIso()): boolean {
  return !!a.dueDate && a.dueDate < today && OPEN_ACTION_STATUSES.includes(a.status);
}

export function openActions(ws: ClientWorkspace): ActionItem[] {
  return active(ws.actions)
    .filter((a) => OPEN_ACTION_STATUSES.includes(a.status))
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
}

export function pendingDecisions(ws: ClientWorkspace) {
  return active(ws.decisions).filter((d) => PENDING_DECISION_STATUSES.includes(d.status));
}

export function criticalIssues(ws: ClientWorkspace) {
  return active(ws.risks).filter((r) => r.kind !== 'opportunity' && r.status !== 'closed' && (r.severity === 'critical' || r.severity === 'high'));
}

export function upcomingMilestones(ws: ClientWorkspace, today = todayIso()) {
  return active(ws.milestones)
    .filter((m) => m.status === 'upcoming' && (!m.date || m.date >= today))
    .sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));
}

export function upcomingMeetings(ws: ClientWorkspace, now = new Date()) {
  return active(ws.meetings)
    .filter((m) => m.status === 'scheduled' && (!m.startsAt || new Date(m.startsAt) >= now))
    .sort((a, b) => (a.startsAt ?? '9999').localeCompare(b.startsAt ?? '9999'));
}

export interface PortfolioSummary {
  byCategory: { categoryId: ID; label: string; count: number }[];
  total: number;
  /** Sum of known BSA fees only. */
  knownFeeTotal: number;
  projectsWithFee: number;
  projectsMissingFee: number;
  readiness: { assessed: number; notAssessed: number };
}

export function portfolioSummary(ws: ClientWorkspace, opts: { excludeCategories?: ID[] } = {}): PortfolioSummary {
  const exclude = new Set(opts.excludeCategories ?? ['archived']);
  const projects = active(ws.projects).filter((p) => !exclude.has(p.categoryId));
  const cats = [...ws.client.config.portfolioCategories].sort((a, b) => a.order - b.order).filter((c) => !exclude.has(c.id));
  const withFee = projects.filter((p) => p.businessDevelopment.bsaFee !== null);
  return {
    byCategory: cats.map((c) => ({ categoryId: c.id, label: c.label, count: projects.filter((p) => p.categoryId === c.id).length })),
    total: projects.length,
    knownFeeTotal: withFee.reduce((s, p) => s + (p.businessDevelopment.bsaFee ?? 0), 0),
    projectsWithFee: withFee.length,
    projectsMissingFee: projects.length - withFee.length,
    readiness: {
      assessed: projects.filter((p) => p.overallReadiness.status !== 'not_assessed').length,
      notAssessed: projects.filter((p) => p.overallReadiness.status === 'not_assessed').length,
    },
  };
}

export function personName(ws: Pick<ClientWorkspace, 'people'>, id: ID | null | undefined): string | null {
  if (!id) return null;
  return ws.people.find((p) => p.id === id)?.fullName ?? null;
}

export function categoryLabel(ws: ClientWorkspace, project: Project): string {
  return ws.client.config.portfolioCategories.find((c) => c.id === project.categoryId)?.label ?? project.categoryId;
}

/* ───────────── Search ───────────── */

export type SearchKind = 'project' | 'person' | 'workstream' | 'initiative' | 'action' | 'decision';

export interface SearchResult {
  kind: SearchKind;
  id: ID;
  title: string;
  subtitle: string;
  path: string;
}

export function searchWorkspace(ws: ClientWorkspace, query: string, limit = 20): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const hit = (...fields: (string | null | undefined)[]) => fields.some((f) => f?.toLowerCase().includes(q));
  const base = `/c/${ws.client.id}`;
  const results: SearchResult[] = [];

  active(ws.projects).forEach((p) => {
    if (hit(p.name, p.projectNumber, p.location, p.projectType))
      results.push({ kind: 'project', id: p.id, title: p.name, subtitle: [p.projectNumber, categoryLabel(ws, p)].filter(Boolean).join(' · '), path: `${base}/portfolio/${p.id}` });
  });
  ws.people.forEach((p) => {
    if (hit(p.fullName, p.title, p.studio))
      results.push({ kind: 'person', id: p.id, title: p.fullName, subtitle: [p.title, p.organization].filter(Boolean).join(' · '), path: `${base}/leadership` });
  });
  active(ws.workstreams).forEach((w) => {
    if (hit(w.title, w.purpose, ...w.topics))
      results.push({ kind: 'workstream', id: w.id, title: w.title, subtitle: `Workstream ${w.order}`, path: `${base}/workstreams` });
  });
  active(ws.initiatives).forEach((i) => {
    if (hit(i.title, i.description)) results.push({ kind: 'initiative', id: i.id, title: i.title, subtitle: 'Initiative', path: `${base}/workstreams` });
  });
  active(ws.actions).forEach((a) => {
    if (hit(a.title, a.description)) results.push({ kind: 'action', id: a.id, title: a.title, subtitle: 'Action', path: `${base}/actions` });
  });
  active(ws.decisions).forEach((d) => {
    if (hit(d.title, d.description)) results.push({ kind: 'decision', id: d.id, title: d.title, subtitle: 'Decision', path: `${base}/actions` });
  });
  return results.slice(0, limit);
}
