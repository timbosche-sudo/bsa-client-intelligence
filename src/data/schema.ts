import { z } from 'zod';
import type { Dataset } from '@/domain/types';
import { hospitalRestartTemplate } from '@/domain/checklistTemplates';

/** Bump when the persisted Dataset shape changes, and add a migration below. */
export const SCHEMA_VERSION = 6;

/**
 * Structural envelope validation. Deep per-record validation is added with the editing forms
 * (Stage 2+) and the restore workflow (Stage 6).
 */
const record = z.object({ id: z.string().min(1) }).passthrough();
const scoped = record.extend({ clientId: z.string().min(1) });

export const datasetEnvelope = z.object({
  schemaVersion: z.number().int().positive(),
  origin: z.enum(['demo-seed', 'restored', 'empty']),
  savedAt: z.string().nullable(),
  clients: z.array(record),
  people: z.array(record),
  memberships: z.array(scoped),
  seats: z.array(scoped),
  projects: z.array(scoped),
  workstreams: z.array(scoped),
  initiatives: z.array(scoped),
  actions: z.array(scoped),
  decisions: z.array(scoped),
  risks: z.array(scoped),
  milestones: z.array(scoped),
  meetingTemplates: z.array(record),
  meetings: z.array(scoped),
  reports: z.array(scoped),
  media: z.array(record.extend({ ownerId: z.string().min(1), ownerType: z.enum(['person', 'project']) })),
  checklistTemplates: z.array(record),
  checklists: z.array(scoped.extend({ projectId: z.string().min(1) })),
  activity: z.array(z.object({ id: z.string() }).passthrough()),
});

type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/** migrations[n] upgrades a dataset from version n to n + 1. */
const migrations: Record<number, Migration> = {
  // v1 → v2: introduce media metadata collection (Stage 2).
  1: (d) => ({
    ...d,
    media: Array.isArray(d.media) ? d.media : [],
    people: (d.people as Record<string, unknown>[]).map((p) => ({ homeClientId: null, ...p })),
    projects: (d.projects as Record<string, unknown>[]).map((p) => ({ documentLinks: [], ...p })),
  }),
  // v2 → v3: lightweight RACI fields, risk→initiative link, restart checklists (Stage 3).
  2: (d) => {
    const raci = (rows: unknown) => (rows as Record<string, unknown>[]).map((r) => ({ consultedIds: [], informedIds: [], ...r }));
    return {
      ...d,
      initiatives: raci(d.initiatives),
      actions: raci(d.actions),
      decisions: raci(d.decisions),
      risks: (d.risks as Record<string, unknown>[]).map((r) => ({ initiativeId: null, ...r })),
      checklistTemplates: Array.isArray(d.checklistTemplates)
        ? d.checklistTemplates
        : // Provide the restart template to the Houston Methodist workspace when it exists.
          (d.clients as { id: string }[]).some((c) => c.id === 'client_houston_methodist')
          ? [hospitalRestartTemplate('client_houston_methodist')]
          : [],
      checklists: Array.isArray(d.checklists) ? d.checklists : [],
    };
  },
  // v3 → v4: Guided Meeting Mode state, finalization snapshot and amendments (Stage 4).
  3: (d) => ({
    ...d,
    risks: (d.risks as Record<string, unknown>[]).map((r) => ({ meetingId: null, ...r })),
    meetingTemplates: (d.meetingTemplates as Record<string, unknown>[]).map((t) => ({ objectives: [], ...t })),
    meetings: (d.meetings as Record<string, unknown>[]).map((m) => ({
      location: '',
      generalNotes: '',
      agendaState: {},
      currentAgendaItemId: null,
      startedAt: null,
      endedAt: null,
      carryoverActionIds: [],
      summary: '',
      nextMeetingTopics: [],
      finalizedByName: null,
      record: null,
      amendments: [],
      ...m,
    })),
  }),
  // v4 → v5: reporting (Stage 5) — client commitment flag, milestone classification, report records.
  4: (d) => ({
    ...d,
    actions: (d.actions as Record<string, unknown>[]).map((a) => ({ commitment: 'proposed', ...a })),
    milestones: (d.milestones as Record<string, unknown>[]).map((m) => ({ confidentiality: 'internal', ...m })),
    // Report records before v5 had no stored content; they cannot be re-exported and are dropped.
    reports: (d.reports as Record<string, unknown>[]).filter((r) => r.content),
  }),
  // v5 → v6: project delivery leadership becomes an editable list of seats, and every project gains an
  // "Operational planner" seat. Existing assignments and discipline leads are carried over unchanged.
  5: (d) => ({
    ...d,
    projects: (d.projects as Record<string, unknown>[]).map((p) => {
      const v = (p.delivery ?? {}) as Record<string, unknown>;
      if (Array.isArray(v.seats)) return p;
      const fixed: [string, unknown][] = [
        ['Project executive', v.projectExecutiveId],
        ['Project manager', v.projectManagerId],
        ['Design leader', v.designLeaderId],
        ['Planning leader', v.planningLeaderId],
        ['Engineering leader', v.engineeringLeaderId],
      ];
      const leads = ((v.disciplineLeads as { discipline?: string; personId?: string | null }[] | undefined) ?? [])
        .filter((l) => l.discipline?.trim())
        .map((l): [string, unknown] => [`${l.discipline!.trim()} lead`, l.personId ?? null]);
      const rows = [...fixed, ...leads];
      if (!rows.some(([r]) => r.toLowerCase() === 'operational planner')) rows.push(['Operational planner', null]);
      const seats = rows.map(([role, personId], i) => ({ id: `${String(p.id)}_seat_${i + 1}`, role, personId: (personId as string | null) ?? null }));
      const { projectExecutiveId: _a, projectManagerId: _b, designLeaderId: _c, planningLeaderId: _d, engineeringLeaderId: _e, disciplineLeads: _f, ...rest } = v;
      return { ...p, delivery: { resourceNotes: '', dependencies: [], ...rest, seats } };
    }),
  }),
};

export class SchemaError extends Error {}

export function migrate(raw: unknown): Dataset {
  if (!raw || typeof raw !== 'object') throw new SchemaError('Data is not an object.');
  let data = raw as Record<string, unknown>;
  let version = typeof data.schemaVersion === 'number' ? data.schemaVersion : 0;
  if (version > SCHEMA_VERSION) {
    throw new SchemaError(`Data was saved by a newer version of the app (schema ${version}; this app supports ${SCHEMA_VERSION}).`);
  }
  while (version < SCHEMA_VERSION) {
    const step = migrations[version];
    if (!step) throw new SchemaError(`No migration available from schema version ${version}.`);
    data = { ...step(data), schemaVersion: version + 1 };
    version += 1;
  }
  const parsed = datasetEnvelope.safeParse(data);
  if (!parsed.success) {
    throw new SchemaError('Data failed validation: ' + parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  }
  return data as unknown as Dataset;
}
