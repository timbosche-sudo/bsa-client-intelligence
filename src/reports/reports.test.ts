import { describe, expect, it } from 'vitest';
import { createDemoSeed, DEMO_CLIENT_IDS } from '@/data/seed/demoSeed';
import { getWorkspace } from '@/data/repository';
import { blankPerson, upsertPerson } from '@/data/mutations';
import { blankAction, upsertAction } from '@/data/strategyMutations';
import { blankMeeting, endMeeting, startMeeting, upsertMeeting } from '@/data/meetingMutations';
import type { Dataset, ReportDoc } from '@/domain/types';
import { buildAccountabilityBrief, buildClientAlignmentReport, buildInternalTeamReport, buildPortfolioReadinessReport } from './builders';
import { approveReport, CLIENT_RELEASE_CHECKS, createReport, deleteReport, recordExport } from './reportMutations';

const HM = DEMO_CLIENT_IDS.houstonMethodist;
const MH = DEMO_CLIENT_IDS.memorialHealth;
const CRAIG = 'person_craig_puccetti';
const ctx = { preparedBy: 'Tester', version: 1, now: new Date('2026-11-04T12:00:00Z') };
const text = (doc: ReportDoc) => JSON.stringify(doc.sections);
const section = (doc: ReportDoc, title: string) => doc.sections.find((s) => s.title === title);

function withClientContent(): Dataset {
  const d = createDemoSeed();
  const contact = blankPerson({ fullName: 'Pat Client', affiliation: 'client', organization: 'Houston Methodist', homeClientId: HM });
  upsertPerson(d, contact);
  // Approved, client-owned (proposed + confirmed), BSA-owned, and internal-only actions.
  upsertAction(d, { ...blankAction(HM), title: 'Share facility condition data', ownerId: contact.id, confidentiality: 'approved' });
  upsertAction(d, { ...blankAction(HM), title: 'Confirm restart budget window', ownerId: contact.id, confidentiality: 'approved', commitment: 'confirmed', dueDate: '2026-12-01' });
  upsertAction(d, { ...blankAction(HM), title: 'Prepare cost-innovation briefing', ownerId: CRAIG, confidentiality: 'approved' });
  upsertAction(d, { ...blankAction(HM), title: 'Resolve principal delegation concerns', ownerId: CRAIG, confidentiality: 'internal' });
  upsertAction(d, { ...blankAction(HM), title: 'Candidate item', confidentiality: 'candidate' });
  d.workstreams.find((w) => w.id === 'ws_hm_4')!.confidentiality = 'approved';
  d.decisions[0].confidentiality = 'approved'; // proposed → "requiring client input"
  d.milestones[1].confidentiality = 'approved';
  // Data in another client must never appear.
  upsertAction(d, { ...blankAction(MH), title: 'Memorial secret item', confidentiality: 'approved' });
  return d;
}

describe('client alignment report', () => {
  it('includes only records approved for client release', () => {
    const d = withClientContent();
    const doc = buildClientAlignmentReport(getWorkspace(d, HM), {}, ctx);
    const t = text(doc);
    expect(t).toContain('Share facility condition data');
    expect(t).toContain('Prepare cost-innovation briefing');
    expect(t).toContain('Cost Innovation and Design Value');
    expect(t).toContain('Adopt five-workstream structure'); // approved classification, pending status
    expect(t).toContain('Anticipated restart of paused work');
    expect(t).not.toContain('Resolve principal delegation concerns');
    expect(t).not.toContain('Candidate item');
    expect(t).not.toContain('Delivery Excellence'); // internal workstream
    expect(t).not.toContain('Memorial secret item');
    expect(t).not.toMatch(/\$\d/); // no fees
    expect(doc.sections.some((s) => /risk/i.test(s.title))).toBe(false);
  });

  it('distinguishes proposed requests from confirmed commitments', () => {
    const doc = buildClientAlignmentReport(getWorkspace(withClientContent(), HM), {}, ctx);
    const table = section(doc, 'Houston Methodist responsibilities')!.blocks.find((b) => b.type === 'table');
    expect(table && table.type === 'table' && table.rows.map((r) => [r[0], r[3]])).toEqual([
      ['Confirm restart budget window', 'Confirmed commitment'],
      ['Share facility condition data', 'Proposed request'],
    ]);
    const bsa = section(doc, 'BSA responsibilities')!.blocks[0];
    expect(bsa.type === 'table' && bsa.rows.map((r) => r[0])).toEqual(['Prepare cost-innovation briefing']);
  });

  it('reports exclusions for the reviewer and warns when nothing is approved', () => {
    const doc = buildClientAlignmentReport(getWorkspace(createDemoSeed(), HM), {}, ctx);
    expect(doc.sections[0].blocks[0]).toMatchObject({ type: 'callout' });
    expect(doc.reviewNotes.join(' ')).toMatch(/Excluded because not approved/);
    expect(doc.reviewNotes.join(' ')).toMatch(/Never included: risks/);
  });
});

describe('internal reports', () => {
  it('internal team report covers meeting, actions, workstreams and milestones', () => {
    const d = createDemoSeed();
    const m = { ...blankMeeting(HM, d.meetingTemplates[0]), facilitatorId: CRAIG, attendeeIds: [CRAIG], startsAt: '2026-11-03T15:00:00Z' };
    upsertMeeting(d, m);
    startMeeting(d, m.id);
    upsertAction(d, { ...blankAction(HM), title: 'From the meeting', ownerId: CRAIG, meetingId: m.id, dueDate: '2026-11-01' });
    endMeeting(d, m.id);
    const doc = buildInternalTeamReport(getWorkspace(d, HM), { meetingId: m.id }, ctx);
    expect(doc.confidentiality).toBe('internal');
    expect(section(doc, 'Client and meeting')).toBeTruthy();
    const newActions = section(doc, 'New actions from this meeting')!.blocks[0];
    expect(newActions.type === 'table' && newActions.rows[0][2]).toMatch(/overdue/);
    const ws = section(doc, 'Workstream updates')!.blocks[0];
    expect(ws.type === 'table' && ws.rows).toHaveLength(5);
    expect(text(doc)).toContain('Anticipated restart of paused work');
  });

  it('uses a provided executive summary, else a record-based one', () => {
    const ws = getWorkspace(createDemoSeed(), HM);
    expect(text(buildInternalTeamReport(ws, { executiveSummary: 'Custom summary.' }, ctx))).toContain('Custom summary.');
    expect(text(buildInternalTeamReport(ws, {}, ctx))).toContain('open actions');
  });

  it('accountability brief lists a person’s commitments', () => {
    const d = createDemoSeed();
    d.actions[0].ownerId = CRAIG;
    d.initiatives[0].championId = CRAIG;
    const doc = buildAccountabilityBrief(getWorkspace(d, HM), { personId: CRAIG }, ctx);
    expect(doc.subtitle).toBe('Craig Puccetti');
    expect(text(doc)).toContain(d.actions[0].title);
    expect(text(doc)).toContain(d.initiatives[0].title);
  });

  it('portfolio readiness report filters categories and never invents values', () => {
    const doc = buildPortfolioReadinessReport(getWorkspace(createDemoSeed(), HM), { categories: ['potential', 'active'] }, ctx);
    const inv = section(doc, 'Portfolio inventory')!.blocks[0];
    expect(inv.type === 'table' && inv.rows.map((r) => r[0])).toEqual(['DEMO-101', 'DEMO-102', 'DEMO-104']);
    expect(inv.type === 'table' && inv.rows[1][4]).toBe('To be confirmed');
    const ready = section(doc, 'Readiness assessments')!.blocks[1];
    expect(ready.type === 'table' && ready.rows[0].slice(1)).toEqual(Array(7).fill('Not assessed'));
    expect(text(doc)).toContain('(sample)');
  });
});

describe('report records', () => {
  it('versions by subject, requires approval checks, and gates release exports', () => {
    const d = withClientContent();
    const a = createReport(d, { clientId: HM, kind: 'client_alignment', params: {}, preparedBy: 'Tester' });
    const b = createReport(d, { clientId: HM, kind: 'client_alignment', params: {}, preparedBy: 'Tester' });
    expect([a.version, b.version]).toEqual([1, 2]);
    expect(b.status).toBe('draft');
    expect(() => recordExport(d, b.id, false)).toThrow(/approved before release/);
    recordExport(d, b.id, true);
    expect(() => approveReport(d, b.id, { approvedBy: 'Craig', checks: [CLIENT_RELEASE_CHECKS[0]] })).toThrow(/every review item/);
    approveReport(d, b.id, { approvedBy: 'Craig', checks: [...CLIENT_RELEASE_CHECKS] });
    recordExport(d, b.id, false);
    const rec = d.reports.find((r) => r.id === b.id)!;
    expect(rec.status).toBe('approved');
    expect(rec.exports.map((e) => e.draft)).toEqual([true, false]);
    expect(() => deleteReport(d, b.id)).toThrow(/Archive/);
    deleteReport(d, a.id);
    expect(d.reports.some((r) => r.id === a.id)).toBe(false);
  });

  it('freezes content: later record changes do not alter a generated report', () => {
    const d = createDemoSeed();
    const r = createReport(d, { clientId: HM, kind: 'internal_team', params: {}, preparedBy: 'Tester' });
    expect(r.status).toBe('final');
    d.actions[0].title = 'Renamed later';
    expect(JSON.stringify(d.reports[0].content)).not.toContain('Renamed later');
  });

  it('validates parameters and keeps clients separate', () => {
    const d = createDemoSeed();
    expect(() => createReport(d, { clientId: MH, kind: 'accountability_brief', params: { personId: CRAIG }, preparedBy: 'x' })).toThrow(/person/);
    expect(() => createReport(d, { clientId: HM, kind: 'portfolio_readiness', params: { categories: [] }, preparedBy: 'x' })).toThrow(/category/);
  });
});
