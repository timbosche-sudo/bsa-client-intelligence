import { describe, expect, it } from 'vitest';
import { createDemoSeed, DEMO_CLIENT_IDS } from './seed/demoSeed';
import { getWorkspace, isOverdue, portfolioSummary, searchWorkspace, WorkspaceNotFoundError } from './repository';
import { CLIENT_SCOPED_COLLECTIONS } from '@/domain/types';

const { houstonMethodist: HM, memorialHealth: MH } = DEMO_CLIENT_IDS;

describe('client workspace isolation', () => {
  it('returns only records that belong to the requested client', () => {
    const data = createDemoSeed();
    // Plant a Memorial Health record in every scoped collection to prove filtering.
    data.projects.push({ ...structuredClone(data.projects[0]), id: 'p_mh', clientId: MH, name: 'MH Only' });
    data.actions.push({ ...structuredClone(data.actions[0]), id: 'a_mh', clientId: MH, title: 'MH action' });

    const hm = getWorkspace(data, HM);
    const mh = getWorkspace(data, MH);
    for (const key of CLIENT_SCOPED_COLLECTIONS) {
      expect(hm[key].every((r) => r.clientId === HM), `${key} leaked into HM`).toBe(true);
      expect(mh[key].every((r) => r.clientId === MH), `${key} leaked into MH`).toBe(true);
    }
    expect(mh.projects.map((p) => p.id)).toEqual(['p_mh']);
    expect(hm.projects.some((p) => p.id === 'p_mh')).toBe(false);
  });

  it('only exposes people referenced by the workspace', () => {
    const data = createDemoSeed();
    expect(getWorkspace(data, HM).people.map((p) => p.fullName)).toContain('Craig Puccetti');
    expect(getWorkspace(data, MH).people).toHaveLength(0);
  });

  it('throws for an unknown client', () => {
    expect(() => getWorkspace(createDemoSeed(), 'nope')).toThrow(WorkspaceNotFoundError);
  });

  it('search never returns another client’s records', () => {
    const data = createDemoSeed();
    data.projects.push({ ...structuredClone(data.projects[0]), id: 'p_mh', clientId: MH, name: 'Zebra Pavilion' });
    expect(searchWorkspace(getWorkspace(data, HM), 'zebra')).toHaveLength(0);
    expect(searchWorkspace(getWorkspace(data, MH), 'zebra')).toHaveLength(1);
  });
});

describe('derived views do not invent values', () => {
  it('sums only known fees and counts missing ones', () => {
    const ws = getWorkspace(createDemoSeed(), HM);
    const s = portfolioSummary(ws);
    const known = ws.projects.filter((p) => p.categoryId !== 'archived' && p.businessDevelopment.bsaFee !== null);
    expect(s.knownFeeTotal).toBe(known.reduce((t, p) => t + p.businessDevelopment.bsaFee!, 0));
    expect(s.projectsMissingFee).toBe(s.total - known.length);
  });

  it('counts unassessed readiness explicitly', () => {
    const ws = getWorkspace(createDemoSeed(), HM);
    const s = portfolioSummary(ws);
    expect(s.readiness.assessed + s.readiness.notAssessed).toBe(s.total);
  });

  it('flags overdue only for open actions with a past due date', () => {
    const a = createDemoSeed().actions[0];
    expect(isOverdue({ ...a, dueDate: null }, '2026-11-03')).toBe(false);
    expect(isOverdue({ ...a, dueDate: '2026-11-01' }, '2026-11-03')).toBe(true);
    expect(isOverdue({ ...a, dueDate: '2026-11-01', status: 'complete' }, '2026-11-03')).toBe(false);
    expect(isOverdue({ ...a, dueDate: '2026-11-03' }, '2026-11-03')).toBe(false);
  });
});
