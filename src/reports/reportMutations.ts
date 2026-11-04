/** Report records: generation (versioned, frozen content), client-release approval, export history. */
import { IntegrityError } from '@/data/mutations';
import { getWorkspace } from '@/data/repository';
import { newId, nowIso } from '@/domain/ids';
import type { Dataset, ID, ReportKind, ReportRecord } from '@/domain/types';
import { buildReport, REPORT_TITLES } from './builders';

/** Reports of the same kind and subject share a version sequence. */
export function reportKey(kind: ReportKind, params: Record<string, unknown>): string {
  if (kind === 'internal_team') return `${kind}:${params.meetingId ?? 'status'}`;
  if (kind === 'accountability_brief') return `${kind}:${params.personId}`;
  if (kind === 'portfolio_readiness') return `${kind}:${[...((params.categories as string[]) ?? [])].sort().join(',')}`;
  return kind;
}

/** Reviewer confirmations required before a client-facing report can be released (Part 12.3). */
export const CLIENT_RELEASE_CHECKS = [
  'I reviewed every item in this report.',
  'It contains no internal performance, staffing or personnel matters.',
  'It contains no confidential financial information or unapproved discussions.',
  'Client responsibilities are correctly labeled as proposed requests or confirmed commitments.',
] as const;

export function createReport(d: Dataset, input: { clientId: ID; kind: ReportKind; params: Record<string, unknown>; preparedBy: string; now?: Date }): ReportRecord {
  const ws = getWorkspace(d, input.clientId);
  if (input.kind === 'accountability_brief' && !ws.people.some((p) => p.id === input.params.personId)) throw new IntegrityError('Choose a person in this workspace.');
  if (input.kind === 'portfolio_readiness' && !((input.params.categories as string[]) ?? []).length) throw new IntegrityError('Choose at least one portfolio category.');
  if (input.kind === 'internal_team' && input.params.meetingId && !ws.meetings.some((m) => m.id === input.params.meetingId)) throw new IntegrityError('Meeting not found in this workspace.');
  const key = reportKey(input.kind, input.params);
  const version = 1 + Math.max(0, ...d.reports.filter((r) => r.clientId === input.clientId && reportKey(r.kind, r.parameters) === key).map((r) => r.version));
  const content = buildReport(ws, input.kind, input.params, { preparedBy: input.preparedBy.trim() || 'Unknown', version, now: input.now });
  const ts = nowIso();
  const rec: ReportRecord = {
    id: newId('report'),
    createdAt: ts,
    updatedAt: ts,
    archivedAt: null,
    clientId: input.clientId,
    kind: input.kind,
    title: `${REPORT_TITLES[input.kind]} — ${content.subtitle}`,
    version,
    preparedBy: content.preparedBy,
    confidentiality: content.confidentiality,
    generatedAt: content.generatedAt,
    parameters: input.params,
    status: input.kind === 'client_alignment' ? 'draft' : 'final',
    content,
    approval: null,
    exports: [],
  };
  d.reports.push(rec);
  return rec;
}

export function approveReport(d: Dataset, id: ID, input: { approvedBy: string; checks: string[] }): void {
  const r = d.reports.find((x) => x.id === id);
  if (!r) throw new IntegrityError('Report not found.');
  if (r.kind !== 'client_alignment') throw new IntegrityError('Only client-facing reports require release approval.');
  if (r.status !== 'draft') throw new IntegrityError('This report is already approved.');
  if (!input.approvedBy.trim()) throw new IntegrityError('Record who is approving the report for release.');
  const missing = CLIENT_RELEASE_CHECKS.filter((c) => !input.checks.includes(c));
  if (missing.length) throw new IntegrityError('Confirm every review item before approving.', [...missing]);
  Object.assign(r, { status: 'approved', approval: { approvedBy: input.approvedBy.trim(), approvedAt: nowIso(), checks: [...input.checks] }, updatedAt: nowIso() });
}

/** Records an export. Distribution exports of client-facing reports require approval. */
export function recordExport(d: Dataset, id: ID, draft: boolean): void {
  const r = d.reports.find((x) => x.id === id);
  if (!r) throw new IntegrityError('Report not found.');
  if (r.kind === 'client_alignment' && !draft && r.status !== 'approved') throw new IntegrityError('Client-facing reports must be approved before release. Export a watermarked draft for review instead.');
  r.exports = [...r.exports, { at: nowIso(), draft }];
  r.updatedAt = nowIso();
}

export function deleteReport(d: Dataset, id: ID): void {
  const r = d.reports.find((x) => x.id === id);
  if (!r) return;
  if (r.status === 'approved' || r.exports.some((e) => !e.draft && r.kind === 'client_alignment')) throw new IntegrityError('Released client reports are kept as a record. Archive it instead.');
  d.reports = d.reports.filter((x) => x.id !== id);
}

export function setReportArchived(d: Dataset, id: ID, archived: boolean): void {
  const r = d.reports.find((x) => x.id === id);
  if (r) Object.assign(r, { archivedAt: archived ? nowIso() : null, updatedAt: nowIso() });
}
