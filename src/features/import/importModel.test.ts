import { describe, expect, it } from 'vitest';
import { createDemoSeed, DEMO_CLIENT_IDS } from '@/data/seed/demoSeed';
import { assignablePeople } from '@/data/repository';
import type { Dataset } from '@/domain/types';
import { fictionalSeed } from '@/test/fixtures';
import { allowedActions, autoMap, buildPreview, commitImport, parseSeedJson, parseTable, type ImportContext } from './importModel';

const HM = DEMO_CLIENT_IDS.houstonMethodist;
const ctxFor = (d: Dataset): ImportContext => ({ client: d.clients.find((c) => c.id === HM)!, people: assignablePeople(d, HM) });
const seedPreview = (d: Dataset, file: unknown = fictionalSeed) => buildPreview(parseSeedJson(file, 'seed.json', ctxFor(d)), d, ctxFor(d));

describe('seed JSON import', () => {
  it('preserves source values exactly and records provenance', () => {
    const d = createDemoSeed();
    const preview = seedPreview(d);
    expect(preview.fileIssues).toEqual([]);
    expect(preview.rows.map((r) => r.status)).toEqual(['new', 'new']);
    expect(preview.rows.every((r) => r.action === 'add')).toBe(true);

    const result = commitImport(d, preview, HM, 'Tester');
    expect(result.added).toHaveLength(2);
    const p = d.projects.find((x) => x.projectNumber === '9999-0001')!;
    expect(p.name).toBe('Fictional Tower  Phase 1 ($10M)'); // double space and embedded note preserved
    expect(p.businessDevelopment.bsaFee).toBe(100000);
    expect(p.businessDevelopment.pipelineProbability).toBe(0.5);
    expect(p.businessDevelopment.feeMix).toEqual({ architecture: 0.9, engineering: 0, interiors: 0.1 });
    expect(p.businessDevelopment.revenueProjection!.periods.map((x) => x.amount)).toEqual(fictionalSeed.projects[0].revenue_projection_12_periods);
    expect(p.businessDevelopment.revenueProjection!.periods.every((x) => x.label === null)).toBe(true);
    expect(p.businessDevelopment.revenueProjection!.calendarMapping).toBe('unresolved');
    expect(p.overallReadiness.status).toBe('not_assessed');
    expect(p.provenance).toMatchObject({ sourceRow: 10, sourceRecordId: 'src-9999-0001', worksheet: '01.01.26', sourceAsOf: '2026-01-01', importedBy: 'Tester' });
    expect(p.id).not.toBe('src-9999-0001');
    expect(p.history.at(-1)!.summary).toContain('Imported from');
  });

  it('matches "Last, First" principals to people and keeps unmatched names raw', () => {
    const d = createDemoSeed();
    commitImport(d, seedPreview(d), HM, null);
    const a = d.projects.find((x) => x.projectNumber === '9999-0001')!;
    const b = d.projects.find((x) => x.projectNumber === '9999-0002')!;
    expect(a.businessDevelopment.relationshipPrincipalId).toBe('person_craig_puccetti');
    expect(b.businessDevelopment.relationshipPrincipalId).toBeNull();
    expect(b.businessDevelopment.relationshipPrincipalRaw).toBe('Doe, Jane');
    expect(b.businessDevelopment.bsaFee).toBeNull();
  });

  it('flags projections that exceed the fee without changing them', () => {
    const d = createDemoSeed();
    const file = structuredClone(fictionalSeed);
    file.projects[0].bsa_fee = 50000;
    const row = seedPreview(d, file).rows[0];
    expect(row.warnings.some((w) => w.message.includes('exceeds the BSA fee'))).toBe(true);
    expect(row.action).toBe('add');
  });

  it('blocks a file for a different client', () => {
    const d = createDemoSeed();
    const file = { ...structuredClone(fictionalSeed), client: { name: 'Another Health System', client_code: '9999' } };
    const preview = seedPreview(d, file);
    expect(preview.fileIssues.some((i) => i.level === 'error')).toBe(true);
    expect(preview.rows.every((r) => r.action === 'skip' && allowedActions(r, true).length === 1)).toBe(true);
    expect(() => commitImport(d, preview, HM, null)).toThrow();
  });

  it('detects existing matches on re-import, defaults to skip, and never erases with blanks', () => {
    const d = createDemoSeed();
    commitImport(d, seedPreview(d), HM, null);
    const again = seedPreview(d);
    expect(again.rows.map((r) => r.status)).toEqual(['match', 'match']);
    expect(again.rows.every((r) => r.changes.length === 0 && r.action === 'skip')).toBe(true);

    // Edit in the app, then re-import a file with a changed fee and a blank studio.
    const p = d.projects.find((x) => x.projectNumber === '9999-0001')!;
    p.location = 'Edited in app';
    const file = structuredClone(fictionalSeed);
    file.projects[0].bsa_fee = 120000;
    file.projects[0].studio = null as unknown as string;
    const preview = seedPreview(d, file);
    const row = preview.rows[0];
    expect(row.changes.map((c) => c.key)).toEqual(['bsaFee']);
    expect(row.changes[0].conflict).toBe(true);
    row.action = 'update';
    const res = commitImport(d, preview, HM, null);
    expect(res.updated).toHaveLength(1);
    const after = d.projects.find((x) => x.projectNumber === '9999-0001')!;
    expect(after.businessDevelopment.bsaFee).toBe(120000);
    expect(after.studio).toBe('Austin');
    expect(after.location).toBe('Edited in app');
    expect(d.projects.filter((x) => x.projectNumber === '9999-0001')).toHaveLength(1);
  });

  it('flags duplicates within the same file', () => {
    const d = createDemoSeed();
    const file = structuredClone(fictionalSeed);
    file.projects[1].project_number = '9999-0001';
    const rows = seedPreview(d, file).rows;
    expect(rows[1].status).toBe('duplicate_in_file');
    expect(rows[1].action).toBe('skip');
  });

  it('reports structural errors for malformed files', () => {
    const d = createDemoSeed();
    const parsed = parseSeedJson({ client: { name: 'Houston Methodist' }, projects: [{ nope: 1 }] }, 'bad.json', ctxFor(d));
    expect(parsed.fileIssues.length).toBeGreaterThan(0);
    expect(parsed.candidates).toHaveLength(0);
  });
});

describe('tabular import', () => {
  const rows = [
    ['Fictional pipeline export'],
    ['Project No', 'Project Name', 'Principal', 'Prob', 'BSA Fee', 'Status', 'P1', 'P2', 'Start'],
    ['9999-0100', 'Fictional Imaging Center', 'Craig Puccetti', 50, '$640,000', 'Paused', '1,000', '2000', 46447],
    ['9999-0101', 'Fictional Lab', '', '25%', '', 'Unknown', '', 'x', ''],
    ['', '', '', '', '', '', '', '', ''],
  ];
  it('auto-maps common header names', () => {
    const m = autoMap(rows[1] as string[]);
    expect(m[0]).toBe('projectNumber');
    expect(m[1]).toBe('name');
    expect(m[2]).toBe('principal');
    expect(m[3]).toBe('pipelineProbability');
    expect(m[4]).toBe('bsaFee');
    expect(m[5]).toBe('categoryId');
    expect(m[8]).toBe('anticipatedStart');
  });
  it('parses rows with mapping, interpretation notes and validation', () => {
    const d = createDemoSeed();
    const ctx = ctxFor(d);
    const mapping = { ...autoMap(rows[1] as string[]), 6: 'revenuePeriods' as const, 7: 'revenuePeriods' as const };
    const parsed = parseTable(rows, 1, mapping, { fileName: 'x.csv', format: 'csv', worksheet: null, asOf: null, extractMethod: 'column mapping', clientName: null, clientCode: null }, ctx, 'potential');
    expect(parsed.candidates).toHaveLength(2);
    const [a, b] = parsed.candidates;
    expect(a.values).toMatchObject({ projectNumber: '9999-0100', bsaFee: 640000, pipelineProbability: 0.5, categoryId: 'paused', revenuePeriods: [1000, 2000], anticipatedStart: '2027-03-01' });
    expect(a.values.principal!.id).toBe('person_craig_puccetti');
    expect(a.issues.some((i) => i.level === 'info' && i.message.includes('interpreted'))).toBe(true);
    expect(b.values.pipelineProbability).toBe(0.25);
    expect(b.issues.some((i) => i.level === 'error' && i.field === 'categoryId')).toBe(true);
    expect(b.issues.some((i) => i.level === 'error' && i.field === 'revenuePeriods')).toBe(true);
    const preview = buildPreview(parsed, d, ctx);
    expect(preview.rows[0].action).toBe('add');
    expect(preview.rows[1].status).toBe('invalid');
    expect(preview.rows[1].action).toBe('skip');
    const res = commitImport(d, preview, HM, null);
    expect(res.added).toHaveLength(1);
    const p = d.projects.find((x) => x.projectNumber === '9999-0100')!;
    expect(p.businessDevelopment.revenueProjection!.basisNote).toContain('P1, P2');
    expect(p.provenance!.sourceRow).toBe(3);
  });
});
