import { describe, expect, it } from 'vitest';
import { createDemoSeed, DEMO_CLIENT_IDS } from '@/data/seed/demoSeed';
import { getWorkspace } from '@/data/repository';
import { EMPTY_FILTERS, filterOptions, filterProjects, matchesCategory, sortProjects } from './projectFilters';

const ws = () => {
  const d = createDemoSeed();
  d.projects[0].archivedAt = '2026-01-01T00:00:00Z';
  d.projects[1].businessDevelopment.relationshipPrincipalId = 'person_craig_puccetti';
  d.projects[1].businessDevelopment.anticipatedStart = '2027-02-01';
  return getWorkspace(d, DEMO_CLIENT_IDS.houstonMethodist);
};

describe('portfolio filters', () => {
  it('separates current and archived records', () => {
    const w = ws();
    const current = filterProjects(w.projects, EMPTY_FILTERS);
    expect(current.some((p) => p.archivedAt)).toBe(false);
    expect(w.projects.filter((p) => matchesCategory(p, 'archived'))).toHaveLength(1);
    expect(filterProjects(w.projects, { ...EMPTY_FILTERS, category: 'all' })).toHaveLength(w.projects.length);
  });
  it('filters by search, principal, readiness and start year', () => {
    const w = ws();
    expect(filterProjects(w.projects, { ...EMPTY_FILTERS, q: 'demo-104' }).map((p) => p.projectNumber)).toEqual(['DEMO-104']);
    expect(filterProjects(w.projects, { ...EMPTY_FILTERS, principal: 'person_craig_puccetti' })).toHaveLength(1);
    expect(filterProjects(w.projects, { ...EMPTY_FILTERS, readiness: 'partially_ready' }).map((p) => p.projectNumber)).toEqual(['DEMO-104']);
    expect(filterProjects(w.projects, { ...EMPTY_FILTERS, startYear: '2027' })).toHaveLength(1);
    expect(filterProjects(w.projects, { ...EMPTY_FILTERS, startYear: 'none' }).length).toBeGreaterThan(0);
  });
  it('sorts unknown values last in both directions', () => {
    const w = ws();
    const asc = sortProjects(w.projects, { key: 'fee', dir: 'asc' }, w);
    const desc = sortProjects(w.projects, { key: 'fee', dir: 'desc' }, w);
    expect(asc.at(-1)!.businessDevelopment.bsaFee).toBeNull();
    expect(desc.at(-1)!.businessDevelopment.bsaFee).toBeNull();
    expect(desc[0].businessDevelopment.bsaFee).toBe(1_250_000);
  });
  it('offers only filter values present in the data', () => {
    const o = filterOptions(ws().projects, ws());
    expect(o.principals).toEqual([{ value: 'person_craig_puccetti', label: 'Craig Puccetti' }]);
    expect(o.years).toEqual(['2027']);
  });
});
