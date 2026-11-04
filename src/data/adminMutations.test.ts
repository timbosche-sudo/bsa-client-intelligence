import { describe, expect, it } from 'vitest';
import { createDemoSeed, DEMO_CLIENT_IDS } from './seed/demoSeed';
import { listClients } from './repository';
import { removeSampleData, sampleDataSummary, setClientArchived, updateClientProfile, updateReadinessDimensions } from './adminMutations';

const HM = DEMO_CLIENT_IDS.houstonMethodist;
const MH = DEMO_CLIENT_IDS.memorialHealth;

describe('client administration', () => {
  it('validates and normalizes profile edits', () => {
    const d = createDemoSeed();
    const c = d.clients.find((x) => x.id === MH)!;
    expect(() => updateClientProfile(d, { ...c, name: 'Houston Methodist' })).toThrow(/already exists/);
    expect(() => updateClientProfile(d, { ...c, monogram: 'TOOLONG' })).toThrow(/monogram/);
    updateClientProfile(d, { ...c, name: ' Memorial Health System ', monogram: 'mhs', strategicPriorities: ['  A ', ''], clientCode: '' });
    const u = d.clients.find((x) => x.id === MH)!;
    expect(u).toMatchObject({ name: 'Memorial Health System', monogram: 'MHS', strategicPriorities: ['A'], clientCode: null });
  });
  it('archives workspaces without losing records, keeping one active', () => {
    const d = createDemoSeed();
    setClientArchived(d, MH, true);
    expect(listClients(d).map((c) => c.id)).toEqual([HM]);
    expect(() => setClientArchived(d, HM, true)).toThrow(/At least one/);
    setClientArchived(d, MH, false);
    expect(listClients(d)).toHaveLength(2);
  });
});

describe('readiness dimensions', () => {
  it('protects assessed dimensions and initializes new ones', () => {
    const d = createDemoSeed();
    const dims = d.clients[0].config.readinessDimensions;
    expect(() => updateReadinessDimensions(d, HM, dims.filter((x) => x.id !== 'leadership'))).toThrow(/assessments on 1 project/);
    updateReadinessDimensions(d, HM, [...dims.filter((x) => x.id !== 'budget'), { id: 'equipment', label: 'Medical equipment', guidance: '', order: 9 }]);
    expect(d.clients[0].config.readinessDimensions.map((x) => x.id)).not.toContain('budget');
    expect(d.projects.every((p) => p.readiness.equipment?.status === 'not_assessed')).toBe(true);
  });
});

describe('remove sample data', () => {
  it('removes only sample projects and keeps your records, unlinked', () => {
    const d = createDemoSeed();
    const sample = d.projects.find((p) => p.isSample)!;
    const real = { ...structuredClone(sample), id: 'project_real_1', isSample: undefined, name: 'Real project' };
    d.projects.push(real);
    d.actions[0].projectId = sample.id;
    d.milestones[0].projectId = real.id;
    d.initiatives[0].relatedProjectIds = [sample.id, real.id];
    d.media.push({ id: 'media_s', createdAt: '', updatedAt: '', archivedAt: null, clientId: HM, ownerType: 'project', ownerId: sample.id, kind: 'rendering', caption: '', credit: '', fileName: 'a.jpg', mime: 'image/jpeg' } as never);
    const before = { actions: d.actions.length, people: d.people.length, workstreams: d.workstreams.length, memberships: d.memberships.length };

    expect(sampleDataSummary(d)).toMatchObject({ projects: 5, unlinked: 2 });
    const purge = removeSampleData(d);

    expect(d.projects.map((p) => p.id)).toEqual(['project_real_1']);
    expect(purge).toEqual(['media_s']);
    expect(d.media).toHaveLength(0);
    expect(d.actions[0].projectId).toBeNull();
    expect(d.milestones[0].projectId).toBe('project_real_1');
    expect(d.initiatives[0].relatedProjectIds).toEqual(['project_real_1']);
    expect({ actions: d.actions.length, people: d.people.length, workstreams: d.workstreams.length, memberships: d.memberships.length }).toEqual(before);
    expect(() => removeSampleData(d)).toThrow(/no sample projects/);
  });
});
