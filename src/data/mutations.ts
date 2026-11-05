/**
 * Dataset mutations. Pure functions that modify a draft Dataset (used inside store.mutate()).
 * They enforce referential integrity: records with dependent history cannot be deleted, only archived.
 */
import { DEFAULT_PROJECT_SEAT_ROLES, defaultClientConfig } from '@/domain/defaults';
import { newId, nowIso } from '@/domain/ids';
import type {
  ProjectSeat,
  CategoryDef,
  Dataset,
  ID,
  LeadershipSeat,
  LeadershipTierDef,
  MediaRecord,
  Milestone,
  Person,
  Project,
  ReadinessAssessment,
  TeamMembership,
} from '@/domain/types';

export class IntegrityError extends Error {
  constructor(
    message: string,
    readonly references: string[] = [],
  ) {
    super(message);
  }
}

const touch = <T extends { updatedAt: string }>(r: T): T => ({ ...r, updatedAt: nowIso() });

function replace<T extends { id: ID }>(rows: T[], next: T): boolean {
  const i = rows.findIndex((r) => r.id === next.id);
  if (i === -1) return false;
  rows[i] = next;
  return true;
}

/* ───────────────────────── People ───────────────────────── */

export function blankPerson(partial: Partial<Person> = {}): Person {
  const ts = nowIso();
  return {
    id: newId('person'),
    createdAt: ts,
    updatedAt: ts,
    archivedAt: null,
    fullName: '',
    title: null,
    organization: 'BSA',
    affiliation: 'bsa',
    studio: null,
    email: null,
    phone: null,
    discipline: null,
    notes: '',
    headshotMediaId: null,
    active: true,
    isAppUser: false,
    homeClientId: null,
    ...partial,
  };
}

export function upsertPerson(d: Dataset, person: Person): void {
  const next = touch(person);
  if (!replace(d.people, next)) d.people.push(next);
}

/** Normalized key for duplicate detection: lower-case, no punctuation, handles "Last, First". */
export function personKey(name: string): string {
  const n = name.includes(',') ? name.split(',').reverse().join(' ') : name;
  return n.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean).join(' ');
}

export function findDuplicatePeople(d: Dataset, fullName: string, excludeId?: ID): Person[] {
  const key = personKey(fullName);
  return key ? d.people.filter((p) => p.id !== excludeId && personKey(p.fullName) === key) : [];
}

export function findPersonReferences(d: Dataset, personId: ID): string[] {
  const refs: string[] = [];
  const clientName = (id: ID) => d.clients.find((c) => c.id === id)?.name ?? 'a client';
  d.clients.forEach((c) => {
    if (c.relationshipLeadId === personId) refs.push(`Relationship lead for ${c.name}`);
    if (c.executiveSponsorId === personId) refs.push(`Executive sponsor for ${c.name}`);
  });
  d.memberships.filter((m) => m.personId === personId).forEach((m) => refs.push(`${m.role} on the ${clientName(m.clientId)} Client Team`));
  d.projects.forEach((p) => {
    const b = p.businessDevelopment;
    const v = p.delivery;
    const ids = [b.relationshipPrincipalId, b.pursuitPrincipalId, ...v.seats.map((s) => s.personId)];
    if (ids.includes(personId)) refs.push(`Assigned to project "${p.name}"`);
  });
  d.workstreams.filter((w) => w.championId === personId).forEach((w) => refs.push(`Champion of initiative "${w.title}"`));
  const inRaci = (r: { participantIds: ID[]; consultedIds?: ID[]; informedIds?: ID[] }) => r.participantIds.includes(personId) || !!r.consultedIds?.includes(personId) || !!r.informedIds?.includes(personId);
  d.initiatives.filter((i) => i.championId === personId || inRaci(i)).forEach((i) => refs.push(`Action plan "${i.title}"`));
  d.actions.filter((a) => a.ownerId === personId || inRaci(a)).forEach((a) => refs.push(`Action "${a.title}"`));
  d.decisions.filter((x) => x.ownerId === personId || inRaci(x) || x.approval?.approvedById === personId).forEach((x) => refs.push(`Decision "${x.title}"`));
  (d.checklists ?? []).filter((c) => c.items.some((i) => i.ownerId === personId)).forEach((c) => refs.push(`Checklist "${c.templateName}"`));
  d.risks.filter((r) => r.ownerId === personId).forEach((r) => refs.push(`Risk "${r.title}"`));
  d.meetings.filter((m) => m.facilitatorId === personId || m.attendeeIds.includes(personId)).forEach((m) => refs.push(`Meeting "${m.title}"`));
  return refs;
}

export function setPersonArchived(d: Dataset, personId: ID, archived: boolean): void {
  const p = d.people.find((x) => x.id === personId);
  if (!p) return;
  upsertPerson(d, { ...p, archivedAt: archived ? nowIso() : null, active: archived ? false : p.active });
}

/** Permanently deletes a person with no references. Returns the removed headshot media id (to purge the blob). */
export function deletePerson(d: Dataset, personId: ID): ID | null {
  const refs = findPersonReferences(d, personId);
  if (refs.length) throw new IntegrityError('This person is referenced by other records. Archive them instead.', refs);
  const p = d.people.find((x) => x.id === personId);
  d.people = d.people.filter((x) => x.id !== personId);
  const headshot = p?.headshotMediaId ?? null;
  if (headshot) d.media = d.media.filter((m) => m.id !== headshot);
  return headshot;
}

/* ───────────────────────── Team & leadership ───────────────────────── */

export function addMembership(d: Dataset, input: Omit<TeamMembership, 'id' | 'createdAt' | 'updatedAt' | 'archivedAt'>): TeamMembership {
  const existing = d.memberships.find((m) => m.clientId === input.clientId && m.personId === input.personId && m.tierId === input.tierId && m.role.trim().toLowerCase() === input.role.trim().toLowerCase() && !m.archivedAt);
  if (existing) throw new IntegrityError('This person already holds that role in this tier.');
  const ts = nowIso();
  const m: TeamMembership = { id: newId('member'), createdAt: ts, updatedAt: ts, archivedAt: null, ...input };
  d.memberships.push(m);
  return m;
}

export function updateMembership(d: Dataset, m: TeamMembership): void {
  replace(d.memberships, touch(m));
}

/** Removes a membership from the team and vacates any seat it filled. */
export function removeMembership(d: Dataset, membershipId: ID): void {
  d.memberships = d.memberships.filter((m) => m.id !== membershipId);
  d.seats = d.seats.map((s) => (s.membershipId === membershipId ? touch({ ...s, membershipId: null }) : s));
}

export function upsertSeat(d: Dataset, seat: LeadershipSeat): void {
  const next = touch(seat);
  if (!replace(d.seats, next)) d.seats.push(next);
}

export function removeSeat(d: Dataset, seatId: ID): void {
  d.seats = d.seats.filter((s) => s.id !== seatId);
}

export function blankSeat(clientId: ID, tierId: ID): LeadershipSeat {
  const ts = nowIso();
  return { id: newId('seat'), createdAt: ts, updatedAt: ts, archivedAt: null, clientId, tierId, role: '', description: '', membershipId: null };
}

/**
 * Replaces a client's leadership tiers. Tiers still holding members or seats cannot be removed.
 */
export function updateLeadershipTiers(d: Dataset, clientId: ID, tiers: LeadershipTierDef[]): void {
  const client = d.clients.find((c) => c.id === clientId);
  if (!client) throw new IntegrityError('Client not found.');
  const keep = new Set(tiers.map((t) => t.id));
  const removed = client.config.leadershipTiers.filter((t) => !keep.has(t.id));
  for (const t of removed) {
    const inUse = d.memberships.some((m) => m.clientId === clientId && m.tierId === t.id) || d.seats.some((s) => s.clientId === clientId && s.tierId === t.id);
    if (inUse) throw new IntegrityError(`"${t.label}" still has members or seats. Move or remove them first.`);
  }
  if (tiers.some((t) => !t.label.trim())) throw new IntegrityError('Every tier needs a name.');
  client.config = { ...client.config, leadershipTiers: tiers.map((t, i) => ({ ...t, label: t.label.trim(), order: i + 1 })) };
  client.updatedAt = nowIso();
}

/** Replaces portfolio categories. Built-in categories cannot be removed; custom ones only when unused. */
export function updatePortfolioCategories(d: Dataset, clientId: ID, cats: CategoryDef[]): void {
  const client = d.clients.find((c) => c.id === clientId);
  if (!client) throw new IntegrityError('Client not found.');
  const keep = new Set(cats.map((c) => c.id));
  for (const c of client.config.portfolioCategories.filter((x) => !keep.has(x.id))) {
    if (c.builtIn) throw new IntegrityError(`"${c.label}" is a built-in category and cannot be removed. Rename it instead.`);
    const n = d.projects.filter((p) => p.clientId === clientId && p.categoryId === c.id).length;
    if (n) throw new IntegrityError(`"${c.label}" is used by ${n} project(s). Move them to another category first.`);
  }
  if (cats.some((c) => !c.label.trim())) throw new IntegrityError('Every category needs a name.');
  const labels = cats.map((c) => c.label.trim().toLowerCase());
  if (new Set(labels).size !== labels.length) throw new IntegrityError('Category names must be unique.');
  client.config = { ...client.config, portfolioCategories: cats.map((c, i) => ({ ...c, label: c.label.trim(), order: i + 1 })) };
  client.updatedAt = nowIso();
}

export function setClientLeadership(d: Dataset, clientId: ID, patch: { relationshipLeadId?: ID | null; executiveSponsorId?: ID | null }): void {
  const c = d.clients.find((x) => x.id === clientId);
  if (!c) return;
  Object.assign(c, patch, { updatedAt: nowIso() });
}

/* ───────────────────────── Projects ───────────────────────── */

const notAssessed = (): ReadinessAssessment => ({ status: 'not_assessed', note: '', assessedById: null, assessedAt: null });

export function blankProject(clientId: ID, categoryId = 'potential'): Project {
  const ts = nowIso();
  return {
    id: newId('project'),
    createdAt: ts,
    updatedAt: ts,
    archivedAt: null,
    clientId,
    projectNumber: null,
    name: '',
    description: '',
    location: null,
    studio: null,
    categoryId,
    projectType: null,
    size: { value: null, unit: 'sf', note: '' },
    coverImageId: null,
    imageIds: [],
    businessDevelopment: {
      relationshipPrincipalId: null,
      relationshipPrincipalRaw: null,
      pursuitPrincipalId: null,
      pipelineProbability: null,
      estimatedConstructionCost: null,
      bsaFee: null,
      feeMix: { architecture: null, engineering: null, interiors: null },
      revenueProjection: null,
      anticipatedAuthorization: null,
      anticipatedStart: null,
      anticipatedCompletion: null,
    },
    delivery: {
      seats: defaultProjectSeats(),
      resourceNotes: '',
      dependencies: [],
    },
    readiness: Object.fromEntries(defaultClientConfig().readinessDimensions.map((r) => [r.id, notAssessed()])),
    overallReadiness: notAssessed(),
    documentLinks: [],
    provenance: null,
    history: [],
  };
}

export function defaultProjectSeats(): ProjectSeat[] {
  return DEFAULT_PROJECT_SEAT_ROLES.map((role) => ({ id: newId('pseat'), role, personId: null }));
}

/** Adds or updates one delivery leadership seat on a project. */
export function upsertProjectSeat(d: Dataset, projectId: ID, seat: ProjectSeat, by: string | null): void {
  const p = d.projects.find((x) => x.id === projectId);
  if (!p) throw new IntegrityError('Project not found.');
  const role = seat.role.trim();
  if (!role) throw new IntegrityError('Name the seat, e.g. "Operational planner".');
  if (p.delivery.seats.some((s) => s.id !== seat.id && s.role.trim().toLowerCase() === role.toLowerCase())) throw new IntegrityError(`This project already has a "${role}" seat.`);
  const exists = p.delivery.seats.some((s) => s.id === seat.id);
  const seats = exists ? p.delivery.seats.map((s) => (s.id === seat.id ? { ...seat, role } : s)) : [...p.delivery.seats, { ...seat, role }];
  const who = seat.personId ? d.people.find((x) => x.id === seat.personId)?.fullName ?? 'someone' : null;
  upsertProject(d, { ...p, delivery: { ...p.delivery, seats } }, by, exists ? `Leadership seat "${role}" ${who ? `assigned to ${who}` : 'updated (unassigned)'}.` : `Added leadership seat "${role}"${who ? ` (${who})` : ''}.`);
}

export function removeProjectSeat(d: Dataset, projectId: ID, seatId: ID, by: string | null): void {
  const p = d.projects.find((x) => x.id === projectId);
  if (!p) throw new IntegrityError('Project not found.');
  const seat = p.delivery.seats.find((s) => s.id === seatId);
  if (!seat) return;
  upsertProject(d, { ...p, delivery: { ...p.delivery, seats: p.delivery.seats.filter((s) => s.id !== seatId) } }, by, `Removed leadership seat "${seat.role}".`);
}

/** Human-readable list of changed top-level fields, for project history. */
export function describeProjectChanges(before: Project, after: Project, categoryLabel: (id: ID) => string = (id) => id): string[] {
  const changes: string[] = [];
  const cmp = (label: string, a: unknown, b: unknown, fmt: (v: unknown) => string = (v) => (v === null || v === undefined || v === '' ? '—' : String(v))) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) changes.push(`${label}: ${fmt(a)} → ${fmt(b)}`);
  };
  cmp('Name', before.name, after.name);
  cmp('Project number', before.projectNumber, after.projectNumber);
  cmp('Category', before.categoryId, after.categoryId, (v) => categoryLabel(String(v)));
  cmp('Studio', before.studio, after.studio);
  cmp('Location', before.location, after.location);
  cmp('Project type', before.projectType, after.projectType);
  cmp('BSA fee', before.businessDevelopment.bsaFee, after.businessDevelopment.bsaFee);
  cmp('Pipeline probability', before.businessDevelopment.pipelineProbability, after.businessDevelopment.pipelineProbability);
  cmp('Estimated construction cost', before.businessDevelopment.estimatedConstructionCost, after.businessDevelopment.estimatedConstructionCost);
  cmp('Overall readiness', before.overallReadiness.status, after.overallReadiness.status);
  const sections: [string, unknown, unknown][] = [
    ['Description', before.description, after.description],
    ['Size', before.size, after.size],
    ['Fee mix', before.businessDevelopment.feeMix, after.businessDevelopment.feeMix],
    ['Business development dates/principals', [before.businessDevelopment.relationshipPrincipalId, before.businessDevelopment.pursuitPrincipalId, before.businessDevelopment.anticipatedAuthorization, before.businessDevelopment.anticipatedStart, before.businessDevelopment.anticipatedCompletion], [after.businessDevelopment.relationshipPrincipalId, after.businessDevelopment.pursuitPrincipalId, after.businessDevelopment.anticipatedAuthorization, after.businessDevelopment.anticipatedStart, after.businessDevelopment.anticipatedCompletion]],
    ['Delivery leadership & resources', before.delivery, after.delivery],
    ['Readiness assessments', before.readiness, after.readiness],
  ];
  for (const [label, a, b] of sections) if (JSON.stringify(a) !== JSON.stringify(b)) changes.push(`${label} updated`);
  return changes;
}

export function upsertProject(d: Dataset, project: Project, by: string | null, summary?: string): void {
  const before = d.projects.find((p) => p.id === project.id);
  const client = d.clients.find((c) => c.id === project.clientId);
  if (!client) throw new IntegrityError('Project must belong to an existing client.');
  const label = (id: ID) => client.config.portfolioCategories.find((c) => c.id === id)?.label ?? id;
  const ts = nowIso();
  const entry = before
    ? (() => {
        const changes = describeProjectChanges(before, project, label);
        return changes.length || summary ? { at: ts, by, summary: summary ?? changes.join('; ') } : null;
      })()
    : { at: ts, by, summary: summary ?? 'Project created.' };
  const next: Project = { ...project, updatedAt: ts, history: entry ? [...project.history, entry] : project.history };
  if (!replace(d.projects, next)) d.projects.push(next);
}

export function findDuplicateProjects(d: Dataset, clientId: ID, projectNumber: string | null, excludeId?: ID): Project[] {
  const n = projectNumber?.trim().toLowerCase();
  if (!n) return [];
  return d.projects.filter((p) => p.clientId === clientId && p.id !== excludeId && p.projectNumber?.trim().toLowerCase() === n);
}

export function findProjectReferences(d: Dataset, projectId: ID): string[] {
  const refs: string[] = [];
  d.actions.filter((a) => a.projectId === projectId).forEach((a) => refs.push(`Action "${a.title}"`));
  d.decisions.filter((x) => x.projectId === projectId).forEach((x) => refs.push(`Decision "${x.title}"`));
  d.risks.filter((r) => r.projectId === projectId).forEach((r) => refs.push(`Risk "${r.title}"`));
  d.milestones.filter((m) => m.projectId === projectId).forEach((m) => refs.push(`Milestone "${m.title}"`));
  d.initiatives.filter((i) => i.relatedProjectIds.includes(projectId)).forEach((i) => refs.push(`Initiative "${i.title}"`));
  (d.checklists ?? []).filter((c) => c.projectId === projectId).forEach((c) => refs.push(`Checklist "${c.templateName}"`));
  return refs;
}

export function setProjectArchived(d: Dataset, projectId: ID, archived: boolean, by: string | null): void {
  const p = d.projects.find((x) => x.id === projectId);
  if (!p) return;
  upsertProject(d, { ...p, archivedAt: archived ? nowIso() : null }, by, archived ? 'Project archived.' : 'Project restored from archive.');
}

/** Permanently deletes a project with no dependent records. Returns media ids whose blobs should be purged. */
export function deleteProject(d: Dataset, projectId: ID): ID[] {
  const refs = findProjectReferences(d, projectId);
  if (refs.length) throw new IntegrityError('This project has related records. Archive it instead.', refs);
  const media = d.media.filter((m) => m.ownerType === 'project' && m.ownerId === projectId).map((m) => m.id);
  d.projects = d.projects.filter((p) => p.id !== projectId);
  d.media = d.media.filter((m) => !media.includes(m.id));
  return media;
}

/* ───────────────────────── Milestones ───────────────────────── */

export function blankMilestone(clientId: ID, projectId: ID | null): Milestone {
  const ts = nowIso();
  return { id: newId('milestone'), createdAt: ts, updatedAt: ts, archivedAt: null, clientId, title: '', date: null, timingNote: '', confirmed: false, projectId, initiativeId: null, workstreamId: null, status: 'upcoming', confidentiality: 'internal' };
}

export function upsertMilestone(d: Dataset, m: Milestone): void {
  const next = touch(m);
  if (!replace(d.milestones, next)) d.milestones.push(next);
}

export function deleteMilestone(d: Dataset, id: ID): void {
  d.milestones = d.milestones.filter((m) => m.id !== id);
}

/* ───────────────────────── Media ───────────────────────── */

export function addMedia(d: Dataset, rec: MediaRecord, opts: { makeCover?: boolean } = {}): void {
  d.media.push(rec);
  if (rec.ownerType === 'person') {
    const p = d.people.find((x) => x.id === rec.ownerId);
    if (p) {
      const old = p.headshotMediaId;
      upsertPerson(d, { ...p, headshotMediaId: rec.id });
      if (old) d.media = d.media.filter((m) => m.id !== old);
    }
  } else {
    const p = d.projects.find((x) => x.id === rec.ownerId);
    if (p) {
      p.imageIds = [...p.imageIds, rec.id];
      if (opts.makeCover || !p.coverImageId) p.coverImageId = rec.id;
      p.updatedAt = nowIso();
    }
  }
}

export function updateMedia(d: Dataset, rec: MediaRecord): void {
  replace(d.media, touch(rec));
}

/** Removes media metadata and detaches it from its owner. Caller purges the blob. */
export function removeMedia(d: Dataset, mediaId: ID): void {
  const rec = d.media.find((m) => m.id === mediaId);
  d.media = d.media.filter((m) => m.id !== mediaId);
  if (!rec) return;
  if (rec.ownerType === 'person') {
    const p = d.people.find((x) => x.id === rec.ownerId);
    if (p?.headshotMediaId === mediaId) upsertPerson(d, { ...p, headshotMediaId: null });
  } else {
    const p = d.projects.find((x) => x.id === rec.ownerId);
    if (p) {
      p.imageIds = p.imageIds.filter((i) => i !== mediaId);
      if (p.coverImageId === mediaId) p.coverImageId = p.imageIds[0] ?? null;
      p.updatedAt = nowIso();
    }
  }
}

export function setProjectCover(d: Dataset, projectId: ID, mediaId: ID): void {
  const p = d.projects.find((x) => x.id === projectId);
  if (p && p.imageIds.includes(mediaId)) {
    p.coverImageId = mediaId;
    p.updatedAt = nowIso();
  }
}

/** Media ids in the store that no record references (e.g. after failed writes). */
export function orphanMediaIds(d: Dataset, storedIds: string[]): string[] {
  const known = new Set(d.media.map((m) => m.id));
  return storedIds.filter((id) => !known.has(id));
}
