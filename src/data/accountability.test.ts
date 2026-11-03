import { describe, expect, it } from 'vitest';
import { createDemoSeed, DEMO_CLIENT_IDS } from './seed/demoSeed';
import { getWorkspace } from './repository';
import { commitmentsFor, commitmentSummary, roleOf, workstreamSummary } from './accountability';
import { blankAction, blankDecision, upsertAction, upsertDecision } from './strategyMutations';

const HM = DEMO_CLIENT_IDS.houstonMethodist;
const CRAIG = 'person_craig_puccetti';

describe('accountability', () => {
  it('derives RACI roles', () => {
    const r = { ownerId: 'a', participantIds: ['b'], consultedIds: ['c'], informedIds: ['d'] };
    expect(['a', 'b', 'c', 'd', 'e'].map((p) => roleOf(r, p))).toEqual(['accountable', 'supporting', 'consulted', 'informed', null]);
  });

  it('collects a person’s open commitments, overdue first, excluding other clients', () => {
    const d = createDemoSeed();
    d.actions.find((a) => a.id === 'action_hm_1')!.ownerId = CRAIG;
    d.actions.find((a) => a.id === 'action_hm_1')!.dueDate = '2026-10-01';
    d.actions.find((a) => a.id === 'action_hm_2')!.participantIds = [CRAIG];
    d.initiatives.find((i) => i.id === 'init_hm_1')!.championId = CRAIG;
    upsertAction(d, { ...blankAction(DEMO_CLIENT_IDS.memorialHealth), title: 'Other client', ownerId: CRAIG });
    upsertDecision(d, { ...blankDecision(HM), title: 'Approved thing', status: 'approved', consultedIds: [CRAIG], date: '2026-11-01', approval: { approvedById: CRAIG, approvedAt: '2026-11-01T00:00:00Z', note: '' } });

    const ws = getWorkspace(d, HM);
    const c = commitmentsFor(ws, CRAIG, '2026-11-03');
    expect(c.actions.accountable.map((a) => a.id)).toEqual(['action_hm_1']);
    expect(c.overdue).toBe(1);
    expect(c.actions.supporting.map((a) => a.id)).toEqual(['action_hm_2']);
    expect(c.initiatives.champion.map((i) => i.id)).toEqual(['init_hm_1']);
    expect(c.decisions.recentApproved.map((x) => x.title)).toEqual(['Approved thing']);

    const summary = commitmentSummary(ws, '2026-11-03');
    expect(summary).toHaveLength(1);
    expect(summary[0]).toMatchObject({ openOwned: 1, overdue: 1, supporting: 1, championing: 1 });
  });

  it('summarizes by workstream including unassigned actions', () => {
    const ws = getWorkspace(createDemoSeed(), HM);
    const rows = workstreamSummary(ws, '2026-11-03');
    const w1 = rows.find((r) => r.workstreamId === 'ws_hm_1')!;
    expect(w1.openActions).toBe(2);
    expect(w1.unassigned).toBe(2);
    expect(w1.pendingDecisions).toBe(1);
    expect(rows.some((r) => r.workstreamId === null)).toBe(false);
  });
});
