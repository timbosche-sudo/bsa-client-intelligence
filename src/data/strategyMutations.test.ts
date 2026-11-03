import { describe, expect, it } from 'vitest';
import { createDemoSeed, DEMO_CLIENT_IDS } from './seed/demoSeed';
import { IntegrityError, deleteProject, findPersonReferences } from './mutations';
import {
  applyChecklist,
  blankAction,
  blankDecision,
  blankInitiative,
  blankRisk,
  blankWorkstream,
  deleteAction,
  deleteDecision,
  deleteInitiative,
  deleteWorkstream,
  reorderWorkstreams,
  setActionStatus,
  upsertAction,
  upsertDecision,
  upsertInitiative,
  upsertRisk,
  upsertWorkstream,
  validateDecision,
} from './strategyMutations';
import { HOSPITAL_RESTART_TEMPLATE_ID } from '@/domain/checklistTemplates';

const HM = DEMO_CLIENT_IDS.houstonMethodist;
const MH = DEMO_CLIENT_IDS.memorialHealth;
const CRAIG = 'person_craig_puccetti';

describe('workstreams', () => {
  it('adds, reorders and protects workstreams with history', () => {
    const d = createDemoSeed();
    const w = { ...blankWorkstream(HM, 6), title: 'Talent pipeline' };
    upsertWorkstream(d, w);
    reorderWorkstreams(d, HM, [w.id, 'ws_hm_1']);
    expect(d.workstreams.find((x) => x.id === w.id)!.order).toBe(1);
    expect(d.workstreams.find((x) => x.id === 'ws_hm_1')!.order).toBe(2);
    expect(d.workstreams.filter((x) => x.clientId === HM).map((x) => x.order).sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(() => deleteWorkstream(d, 'ws_hm_1')).toThrow(IntegrityError);
    deleteWorkstream(d, w.id);
    expect(d.workstreams.some((x) => x.id === w.id)).toBe(false);
  });
});

describe('initiatives and actions', () => {
  it('rejects links to another client’s records', () => {
    const d = createDemoSeed();
    const i = { ...blankInitiative(MH), title: 'Leak test', workstreamId: 'ws_hm_1' };
    expect(() => upsertInitiative(d, i)).toThrow(/different client/);
    const a = { ...blankAction(MH), title: 'Leak', projectId: 'project_demo_101' };
    expect(() => upsertAction(d, a)).toThrow(/different client/);
  });
  it('keeps completedAt consistent with status', () => {
    const d = createDemoSeed();
    setActionStatus(d, 'action_hm_1', 'complete', 'Sponsor confirmed.');
    const a = d.actions.find((x) => x.id === 'action_hm_1')!;
    expect(a.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(a.completionNotes).toBe('Sponsor confirmed.');
    setActionStatus(d, 'action_hm_1', 'in_progress');
    expect(d.actions.find((x) => x.id === 'action_hm_1')!.completedAt).toBeNull();
  });
  it('blocks deleting initiatives with linked records and meeting actions', () => {
    const d = createDemoSeed();
    expect(() => deleteInitiative(d, 'init_hm_2')).toThrow(IntegrityError);
    const a = { ...blankAction(HM), title: 'From meeting', meetingId: 'meeting_x' };
    upsertAction(d, a);
    expect(() => deleteAction(d, a.id)).toThrow(/meeting/);
  });
});

describe('decisions', () => {
  it('requires an approval record before Approved', () => {
    const d = createDemoSeed();
    const x = { ...blankDecision(HM), title: 'Adopt cadence', status: 'approved' as const };
    expect(validateDecision(d, x).length).toBe(2);
    expect(() => upsertDecision(d, x)).toThrow(IntegrityError);
    upsertDecision(d, { ...x, approval: { approvedById: CRAIG, approvedAt: '2026-11-03T00:00:00Z', note: 'Kickoff' } });
    expect(d.decisions.find((o) => o.id === x.id)!.status).toBe('approved');
    expect(() => deleteDecision(d, x.id)).toThrow(/decision history/);
  });
  it('requires a valid superseding decision and clears stale approval data', () => {
    const d = createDemoSeed();
    const a = { ...blankDecision(HM), title: 'A', status: 'superseded' as const };
    expect(validateDecision(d, a)).toContain('Choose the decision that supersedes this one.');
    expect(validateDecision(d, { ...a, supersededById: a.id })).toContain('A decision cannot supersede itself.');
    upsertDecision(d, { ...a, supersededById: 'decision_hm_1' });
    expect(() => deleteDecision(d, 'decision_hm_1')).toThrow(IntegrityError);
    const b = { ...blankDecision(HM), title: 'B', status: 'deferred' as const, approval: { approvedById: CRAIG, approvedAt: 'x', note: '' } };
    upsertDecision(d, b);
    expect(d.decisions.find((o) => o.id === b.id)!.approval).toBeNull();
  });
});

describe('risks and people references', () => {
  it('links risks to initiatives and protects referenced people', () => {
    const d = createDemoSeed();
    const p = { id: 'person_tmp', fullName: 'Temp' } as never;
    d.people.push({ ...d.people[0], ...(p as object), headshotMediaId: null });
    upsertRisk(d, { ...blankRisk(HM), title: 'Staffing gap', initiativeId: 'init_hm_1' });
    const r = d.risks.at(-1)!;
    expect(r.initiativeId).toBe('init_hm_1');
    upsertAction(d, { ...blankAction(HM), title: 'Inform', informedIds: ['person_tmp'] });
    expect(findPersonReferences(d, 'person_tmp')).toEqual(['Action "Inform"']);
  });
});

describe('restart checklists', () => {
  it('requires identity confirmation and copies template items', () => {
    const d = createDemoSeed();
    const input = { clientId: HM, projectId: 'project_demo_102', templateId: HOSPITAL_RESTART_TEMPLATE_ID, confirmedBy: '', basis: '' };
    expect(() => applyChecklist(d, input)).toThrow(/confirmed/);
    const c = applyChecklist(d, { ...input, confirmedBy: 'Craig Puccetti', basis: 'Scope letter reviewed' });
    expect(c.items).toHaveLength(8);
    expect(c.items[4].title).toBe('150-bed care model');
    expect(c.identityConfirmation.confirmedBy).toBe('Craig Puccetti');
    expect(() => applyChecklist(d, { ...input, confirmedBy: 'x', basis: 'y' })).toThrow(/already applied/);
    expect(() => applyChecklist(d, { ...input, clientId: MH, confirmedBy: 'x', basis: 'y' })).toThrow(/not found/);
    expect(() => deleteProject(d, 'project_demo_102')).toThrow(IntegrityError);
    // Template edits do not rewrite the applied checklist.
    d.checklistTemplates[0].items[0].title = 'Renamed';
    expect(d.checklists[0].items[0].title).toBe('Program and cost history');
  });
});
