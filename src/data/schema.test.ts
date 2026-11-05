import { describe, expect, it } from 'vitest';
import { migrate, SCHEMA_VERSION, SchemaError } from './schema';
import { createDemoSeed } from './seed/demoSeed';
import { LocalStorageAdapter } from './persistence/LocalStorageAdapter';

describe('schema migration & validation', () => {
  it('accepts the current seed', () => {
    expect(migrate(createDemoSeed()).schemaVersion).toBe(SCHEMA_VERSION);
  });
  it('rejects data from a newer app version', () => {
    expect(() => migrate({ ...createDemoSeed(), schemaVersion: SCHEMA_VERSION + 1 })).toThrow(SchemaError);
  });
  it('rejects records without a clientId in scoped collections', () => {
    const d = createDemoSeed() as unknown as Record<string, unknown[]>;
    d.projects = [{ id: 'x' }];
    expect(() => migrate(d)).toThrow(/projects/);
  });
  it('rejects non-objects', () => {
    expect(() => migrate(null)).toThrow(SchemaError);
    expect(() => migrate('text')).toThrow(SchemaError);
  });
});

describe('v1 → v2 migration', () => {
  it('adds media, person homeClientId and project documentLinks without losing data', () => {
    const v1 = structuredClone(createDemoSeed()) as unknown as Record<string, unknown>;
    v1.schemaVersion = 1;
    delete v1.media;
    (v1.people as Record<string, unknown>[]).forEach((p) => delete p.homeClientId);
    (v1.projects as Record<string, unknown>[]).forEach((p) => delete p.documentLinks);
    const migrated = migrate(v1);
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
    expect(migrated.media).toEqual([]);
    expect(migrated.people.every((p) => p.homeClientId === null)).toBe(true);
    expect(migrated.projects.every((p) => Array.isArray(p.documentLinks))).toBe(true);
    expect(migrated.projects).toHaveLength(createDemoSeed().projects.length);
  });
});

describe('v2 → v3 migration', () => {
  it('adds RACI fields, risk initiative links and the restart template', () => {
    const v2 = structuredClone(createDemoSeed()) as unknown as Record<string, unknown>;
    v2.schemaVersion = 2;
    delete v2.checklistTemplates;
    delete v2.checklists;
    for (const k of ['initiatives', 'actions', 'decisions']) (v2[k] as Record<string, unknown>[]).forEach((r) => (delete r.consultedIds, delete r.informedIds));
    (v2.risks as Record<string, unknown>[]).forEach((r) => delete r.initiativeId);
    const m = migrate(v2);
    expect(m.schemaVersion).toBe(SCHEMA_VERSION);
    expect(m.actions.every((a) => Array.isArray(a.consultedIds) && Array.isArray(a.informedIds))).toBe(true);
    expect(m.risks.every((r) => r.initiativeId === null)).toBe(true);
    expect(m.checklistTemplates.map((t) => t.items.length)).toEqual([8]);
    expect(m.checklists).toEqual([]);
  });
});

describe('v3 → v4 migration', () => {
  it('adds meeting-mode fields to existing meetings and risks', () => {
    const v3 = structuredClone(createDemoSeed()) as unknown as Record<string, unknown>;
    v3.schemaVersion = 3;
    (v3.risks as Record<string, unknown>[]).forEach((r) => delete r.meetingId);
    (v3.meetingTemplates as Record<string, unknown>[]).forEach((t) => delete t.objectives);
    v3.meetings = [{ id: 'm1', clientId: 'client_houston_methodist', title: 'Old', startsAt: null, facilitatorId: null, attendeeIds: [], objectives: [], workstreamIds: [], templateId: null, agenda: [], notes: {}, status: 'scheduled', finalizedAt: null, finalizedById: null, createdAt: '', updatedAt: '', archivedAt: null }];
    const m = migrate(v3);
    expect(m.schemaVersion).toBe(SCHEMA_VERSION);
    expect(m.risks.every((r) => r.meetingId === null)).toBe(true);
    expect(m.meetings[0]).toMatchObject({ title: 'Old', agendaState: {}, amendments: [], record: null, carryoverActionIds: [] });
    expect(m.meetingTemplates.every((t) => Array.isArray(t.objectives))).toBe(true);
  });
});

describe('v4 → v5 migration', () => {
  it('adds commitment and milestone classification; drops content-less reports', () => {
    const v4 = structuredClone(createDemoSeed()) as unknown as Record<string, unknown>;
    v4.schemaVersion = 4;
    (v4.actions as Record<string, unknown>[]).forEach((a) => delete a.commitment);
    (v4.milestones as Record<string, unknown>[]).forEach((x) => delete x.confidentiality);
    v4.reports = [{ id: 'r1', clientId: 'client_houston_methodist' }];
    const m = migrate(v4);
    expect(m.schemaVersion).toBe(SCHEMA_VERSION);
    expect(m.actions.every((a) => a.commitment === 'proposed')).toBe(true);
    expect(m.milestones.every((x) => x.confidentiality === 'internal')).toBe(true);
    expect(m.reports).toEqual([]);
  });
});

describe('LocalStorageAdapter', () => {
  it('round-trips the dataset', async () => {
    localStorage.clear();
    const adapter = new LocalStorageAdapter(localStorage, 'test-key');
    expect(await adapter.load()).toBeNull();
    const seed = createDemoSeed();
    await adapter.save(seed);
    expect(migrate(await adapter.load())).toEqual(seed);
    expect(await adapter.usage()).toBeGreaterThan(0);
    await adapter.clear();
    expect(await adapter.load()).toBeNull();
  });
});

describe('v5 → v6 project leadership seats', () => {
  it('carries over assignments and discipline leads and adds an Operational planner seat', () => {
    const d = createDemoSeed() as unknown as Record<string, unknown>;
    const projects = d.projects as Record<string, unknown>[];
    projects[0].delivery = { projectExecutiveId: 'person_craig_puccetti', projectManagerId: null, designLeaderId: null, planningLeaderId: null, engineeringLeaderId: null, disciplineLeads: [{ discipline: 'Interiors', personId: 'person_craig_puccetti' }, { discipline: ' ', personId: null }], resourceNotes: 'Notes', dependencies: ['X'] };
    const m = migrate({ ...d, schemaVersion: 5 });
    const seats = m.projects[0].delivery.seats;
    expect(seats.map((s) => s.role)).toEqual(['Project executive', 'Project manager', 'Design leader', 'Planning leader', 'Engineering leader', 'Interiors lead', 'Operational planner']);
    expect(seats[0].personId).toBe('person_craig_puccetti');
    expect(seats[5].personId).toBe('person_craig_puccetti');
    expect(new Set(seats.map((s) => s.id)).size).toBe(seats.length);
    expect(m.projects[0].delivery).toMatchObject({ resourceNotes: 'Notes', dependencies: ['X'] });
    expect('projectExecutiveId' in m.projects[0].delivery).toBe(false);
  });
});
