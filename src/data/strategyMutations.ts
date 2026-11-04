/**
 * Stage 3 mutations: workstreams, initiatives, actions, decisions, risks and project restart checklists.
 * Pure functions on a draft Dataset; they throw IntegrityError instead of leaving inconsistent data.
 */
import { newId, nowIso } from '@/domain/ids';
import type {
  ActionItem,
  ActionStatus,
  ChecklistTemplate,
  Dataset,
  Decision,
  ID,
  Initiative,
  ProjectChecklist,
  Risk,
  Workstream,
} from '@/domain/types';
import { IntegrityError } from './mutations';

const base = () => {
  const ts = nowIso();
  return { createdAt: ts, updatedAt: ts, archivedAt: null };
};
const today = () => nowIso().slice(0, 10);

function put<T extends { id: ID; updatedAt: string }>(rows: T[], rec: T): void {
  const next = { ...rec, updatedAt: nowIso() };
  const i = rows.findIndex((r) => r.id === rec.id);
  if (i === -1) rows.push(next);
  else rows[i] = next;
}

function assertClient(d: Dataset, clientId: ID, refs: { label: string; id: ID | null | undefined; rows: { id: ID; clientId: ID }[] }[]) {
  for (const r of refs) {
    if (!r.id) continue;
    const hit = r.rows.find((x) => x.id === r.id);
    if (!hit) throw new IntegrityError(`The selected ${r.label} no longer exists.`);
    if (hit.clientId !== clientId) throw new IntegrityError(`The selected ${r.label} belongs to a different client.`);
  }
  if (!d.clients.some((c) => c.id === clientId)) throw new IntegrityError('Client not found.');
}

/* ───────────────────────── Workstreams ───────────────────────── */

export function blankWorkstream(clientId: ID, order: number): Workstream {
  return { id: newId('ws'), ...base(), clientId, order, title: '', purpose: '', topics: [], deliverable: '', championId: null, status: 'planned', confidentiality: 'internal', confidentialityNote: '' };
}

export function upsertWorkstream(d: Dataset, w: Workstream): void {
  if (!w.title.trim()) throw new IntegrityError('A workstream needs a title.');
  put(d.workstreams, { ...w, title: w.title.trim(), topics: w.topics.map((t) => t.trim()).filter(Boolean) });
}

export function findWorkstreamReferences(d: Dataset, id: ID): string[] {
  const refs: string[] = [];
  d.initiatives.filter((x) => x.workstreamId === id).forEach((x) => refs.push(`Initiative "${x.title}"`));
  d.actions.filter((x) => x.workstreamId === id).forEach((x) => refs.push(`Action "${x.title}"`));
  d.decisions.filter((x) => x.workstreamId === id).forEach((x) => refs.push(`Decision "${x.title}"`));
  d.risks.filter((x) => x.workstreamId === id).forEach((x) => refs.push(`Risk "${x.title}"`));
  d.milestones.filter((x) => x.workstreamId === id).forEach((x) => refs.push(`Milestone "${x.title}"`));
  d.meetings.filter((x) => x.workstreamIds.includes(id)).forEach((x) => refs.push(`Meeting "${x.title}"`));
  return refs;
}

export function setWorkstreamArchived(d: Dataset, id: ID, archived: boolean): void {
  const w = d.workstreams.find((x) => x.id === id);
  if (w) put(d.workstreams, { ...w, archivedAt: archived ? nowIso() : null, status: archived ? 'archived' : w.status === 'archived' ? 'planned' : w.status });
}

export function deleteWorkstream(d: Dataset, id: ID): void {
  const refs = findWorkstreamReferences(d, id);
  if (refs.length) throw new IntegrityError('This workstream has related records. Archive it instead.', refs);
  d.workstreams = d.workstreams.filter((w) => w.id !== id);
}

/** Renumbers the given workstreams in the order supplied (others in the client keep their relative order after them). */
export function reorderWorkstreams(d: Dataset, clientId: ID, orderedIds: ID[]): void {
  const mine = d.workstreams.filter((w) => w.clientId === clientId);
  const rest = mine.filter((w) => !orderedIds.includes(w.id)).sort((a, b) => a.order - b.order);
  [...orderedIds.map((id) => mine.find((w) => w.id === id)!).filter(Boolean), ...rest].forEach((w, i) => {
    w.order = i + 1;
    w.updatedAt = nowIso();
  });
}

/* ───────────────────────── Initiatives ───────────────────────── */

export function blankInitiative(clientId: ID, workstreamId: ID | null = null): Initiative {
  return { id: newId('init'), ...base(), clientId, workstreamId, title: '', description: '', championId: null, participantIds: [], consultedIds: [], informedIds: [], desiredOutcome: '', targetDate: null, status: 'proposed', relatedProjectIds: [], notes: '', confidentiality: 'internal' };
}

export function upsertInitiative(d: Dataset, i: Initiative): void {
  if (!i.title.trim()) throw new IntegrityError('An initiative needs a title.');
  assertClient(d, i.clientId, [
    { label: 'workstream', id: i.workstreamId, rows: d.workstreams },
    ...i.relatedProjectIds.map((id) => ({ label: 'project', id, rows: d.projects })),
  ]);
  put(d.initiatives, { ...i, title: i.title.trim() });
}

export function findInitiativeReferences(d: Dataset, id: ID): string[] {
  const refs: string[] = [];
  d.actions.filter((x) => x.initiativeId === id).forEach((x) => refs.push(`Action "${x.title}"`));
  d.decisions.filter((x) => x.initiativeId === id).forEach((x) => refs.push(`Decision "${x.title}"`));
  d.risks.filter((x) => x.initiativeId === id).forEach((x) => refs.push(`Risk "${x.title}"`));
  d.milestones.filter((x) => x.initiativeId === id).forEach((x) => refs.push(`Milestone "${x.title}"`));
  return refs;
}

export function setInitiativeArchived(d: Dataset, id: ID, archived: boolean): void {
  const i = d.initiatives.find((x) => x.id === id);
  if (i) put(d.initiatives, { ...i, archivedAt: archived ? nowIso() : null });
}

export function deleteInitiative(d: Dataset, id: ID): void {
  const refs = findInitiativeReferences(d, id);
  if (refs.length) throw new IntegrityError('This initiative has related records. Archive it instead.', refs);
  d.initiatives = d.initiatives.filter((x) => x.id !== id);
}

/* ───────────────────────── Actions ───────────────────────── */

export function blankAction(clientId: ID, defaults: Partial<ActionItem> = {}): ActionItem {
  return {
    id: newId('action'),
    ...base(),
    clientId,
    title: '',
    description: '',
    ownerId: null,
    participantIds: [],
    consultedIds: [],
    informedIds: [],
    dueDate: null,
    priority: 'medium',
    status: 'not_started',
    workstreamId: null,
    initiativeId: null,
    projectId: null,
    meetingId: null,
    completionNotes: '',
    completedAt: null,
    confidentiality: 'internal',
    commitment: 'proposed',
    ...defaults,
  };
}

/** Keeps completedAt consistent with status: set when completed (today if blank), cleared when reopened. */
export function normalizeAction(a: ActionItem): ActionItem {
  if (a.status === 'complete') return { ...a, completedAt: a.completedAt ?? today() };
  return { ...a, completedAt: null };
}

export function upsertAction(d: Dataset, a: ActionItem): void {
  if (!a.title.trim()) throw new IntegrityError('An action needs a title.');
  assertClient(d, a.clientId, [
    { label: 'workstream', id: a.workstreamId, rows: d.workstreams },
    { label: 'initiative', id: a.initiativeId, rows: d.initiatives },
    { label: 'project', id: a.projectId, rows: d.projects },
  ]);
  put(d.actions, normalizeAction({ ...a, title: a.title.trim() }));
}

export function setActionStatus(d: Dataset, id: ID, status: ActionStatus, completionNotes?: string): void {
  const a = d.actions.find((x) => x.id === id);
  if (!a) return;
  put(d.actions, normalizeAction({ ...a, status, completionNotes: completionNotes ?? a.completionNotes }));
}

export function deleteAction(d: Dataset, id: ID): void {
  const a = d.actions.find((x) => x.id === id);
  if (a?.meetingId) throw new IntegrityError('This action was recorded in a meeting. Cancel it instead so the meeting record stays complete.');
  d.actions = d.actions.filter((x) => x.id !== id);
}

/* ───────────────────────── Decisions ───────────────────────── */

export function blankDecision(clientId: ID, defaults: Partial<Decision> = {}): Decision {
  return {
    id: newId('decision'),
    ...base(),
    clientId,
    title: '',
    description: '',
    date: null,
    ownerId: null,
    participantIds: [],
    consultedIds: [],
    informedIds: [],
    projectId: null,
    initiativeId: null,
    workstreamId: null,
    status: 'proposed',
    rationale: '',
    alternatives: '',
    dependencies: '',
    approval: null,
    supersededById: null,
    meetingId: null,
    confidentiality: 'internal',
    ...defaults,
  };
}

/** Returns blocking problems; empty when the decision may be saved. */
export function validateDecision(d: Dataset, x: Decision): string[] {
  const errors: string[] = [];
  if (!x.title.trim()) errors.push('A decision needs a title.');
  if (x.status === 'approved') {
    if (!x.approval?.approvedById) errors.push('Record who approved the decision before marking it Approved.');
    if (!x.approval?.approvedAt) errors.push('Record the approval date before marking it Approved.');
  }
  if (x.status === 'superseded') {
    if (!x.supersededById) errors.push('Choose the decision that supersedes this one.');
    else if (x.supersededById === x.id) errors.push('A decision cannot supersede itself.');
    else if (!d.decisions.some((o) => o.id === x.supersededById && o.clientId === x.clientId)) errors.push('The superseding decision was not found in this client.');
  }
  return errors;
}

export function upsertDecision(d: Dataset, x: Decision): void {
  const errors = validateDecision(d, x);
  if (errors.length) throw new IntegrityError(errors[0], errors);
  assertClient(d, x.clientId, [
    { label: 'workstream', id: x.workstreamId, rows: d.workstreams },
    { label: 'initiative', id: x.initiativeId, rows: d.initiatives },
    { label: 'project', id: x.projectId, rows: d.projects },
  ]);
  // Approval data only accompanies an approved (or later superseded) decision.
  const keepApproval = x.status === 'approved' || x.status === 'superseded';
  put(d.decisions, { ...x, title: x.title.trim(), approval: keepApproval ? x.approval : null, supersededById: x.status === 'superseded' ? x.supersededById : null });
}

export function findDecisionReferences(d: Dataset, id: ID): string[] {
  const x = d.decisions.find((o) => o.id === id);
  const refs: string[] = [];
  if (x?.status === 'approved') refs.push('It is an approved decision (part of the decision history).');
  if (x?.meetingId) refs.push('It was recorded in a meeting.');
  d.decisions.filter((o) => o.supersededById === id).forEach((o) => refs.push(`It supersedes "${o.title}"`));
  return refs;
}

export function deleteDecision(d: Dataset, id: ID): void {
  const refs = findDecisionReferences(d, id);
  if (refs.length) throw new IntegrityError('This decision is part of the decision history. Archive it instead.', refs);
  d.decisions = d.decisions.filter((x) => x.id !== id);
}

export function setDecisionArchived(d: Dataset, id: ID, archived: boolean): void {
  const x = d.decisions.find((o) => o.id === id);
  if (x) put(d.decisions, { ...x, archivedAt: archived ? nowIso() : null });
}

/* ───────────────────────── Risks ───────────────────────── */

export function blankRisk(clientId: ID, defaults: Partial<Risk> = {}): Risk {
  return { id: newId('risk'), ...base(), clientId, kind: 'risk', title: '', description: '', severity: 'not_assessed', ownerId: null, projectId: null, workstreamId: null, initiativeId: null, meetingId: null, status: 'open', mitigation: '', confidentiality: 'internal', ...defaults };
}

export function upsertRisk(d: Dataset, r: Risk): void {
  if (!r.title.trim()) throw new IntegrityError('Give the risk, issue or opportunity a title.');
  assertClient(d, r.clientId, [
    { label: 'workstream', id: r.workstreamId, rows: d.workstreams },
    { label: 'initiative', id: r.initiativeId, rows: d.initiatives },
    { label: 'project', id: r.projectId, rows: d.projects },
  ]);
  put(d.risks, { ...r, title: r.title.trim() });
}

export function deleteRisk(d: Dataset, id: ID): void {
  if (d.risks.find((x) => x.id === id)?.meetingId) throw new IntegrityError('This issue was flagged in a meeting. Close it instead so the meeting record stays complete.');
  d.risks = d.risks.filter((x) => x.id !== id);
}

/* ───────────────────────── Checklists ───────────────────────── */

export function blankChecklistTemplate(clientId: ID | null): ChecklistTemplate {
  return { id: newId('template'), ...base(), clientId, name: '', description: '', source: '', items: [] };
}

export function upsertChecklistTemplate(d: Dataset, t: ChecklistTemplate): void {
  if (!t.name.trim()) throw new IntegrityError('A template needs a name.');
  const items = t.items.map((i) => ({ ...i, title: i.title.trim(), guidance: i.guidance.map((g) => g.trim()).filter(Boolean) })).filter((i) => i.title);
  if (!items.length) throw new IntegrityError('A template needs at least one item.');
  put(d.checklistTemplates, { ...t, name: t.name.trim(), items });
}

export function setChecklistTemplateArchived(d: Dataset, id: ID, archived: boolean): void {
  const t = d.checklistTemplates.find((x) => x.id === id);
  if (t) put(d.checklistTemplates, { ...t, archivedAt: archived ? nowIso() : null });
}

/**
 * Applies a template to a project. Requires an explicit identity/scope confirmation (Part 9):
 * who confirmed it and on what basis.
 */
export function applyChecklist(d: Dataset, input: { clientId: ID; projectId: ID; templateId: ID; confirmedBy: string; basis: string }): ProjectChecklist {
  const project = d.projects.find((p) => p.id === input.projectId);
  if (!project || project.clientId !== input.clientId) throw new IntegrityError('Project not found in this client.');
  const template = d.checklistTemplates.find((t) => t.id === input.templateId && (t.clientId === null || t.clientId === input.clientId));
  if (!template) throw new IntegrityError('Template not found for this client.');
  if (!input.confirmedBy.trim() || !input.basis.trim()) throw new IntegrityError('Record who confirmed the project identity and scope, and the basis, before applying a checklist.');
  if (d.checklists.some((c) => c.projectId === project.id && c.templateId === template.id && !c.archivedAt)) throw new IntegrityError('This checklist is already applied to the project.');
  const c: ProjectChecklist = {
    id: newId('checklist'),
    ...base(),
    clientId: input.clientId,
    projectId: project.id,
    templateId: template.id,
    templateName: template.name,
    identityConfirmation: { confirmedBy: input.confirmedBy.trim(), confirmedAt: nowIso(), note: input.basis.trim() },
    items: template.items.map((i) => ({ id: newId('ci'), title: i.title, guidance: [...i.guidance], status: 'not_started', ownerId: null, dueDate: null, notes: '' })),
    programComparison: [],
    changeLog: [],
    leadershipSummary: '',
    confidentiality: 'internal',
  };
  d.checklists.push(c);
  return c;
}

export function updateChecklist(d: Dataset, c: ProjectChecklist): void {
  if (!d.checklists.some((x) => x.id === c.id)) throw new IntegrityError('Checklist not found.');
  put(d.checklists, c);
}

export function setChecklistArchived(d: Dataset, id: ID, archived: boolean): void {
  const c = d.checklists.find((x) => x.id === id);
  if (c) put(d.checklists, { ...c, archivedAt: archived ? nowIso() : null });
}
