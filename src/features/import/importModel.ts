/**
 * Project import: source → candidates → preview → approved commit.
 *
 * Rules (see docs/seed-data-mapping.md):
 *  - Values are preserved exactly; no project numbers, fees or probabilities are altered.
 *    The only transformation rule is percentage interpretation for tabular sources, which is reported.
 *  - Duplicate detection uses client + project number; internal IDs are always newly generated.
 *  - Revenue period labels are never inferred.
 *  - Nothing is written until the user approves the preview.
 */
import { z } from 'zod';
import { blankProject, personKey, upsertProject } from '@/data/mutations';
import type { Client, Dataset, ID, Person, Project, Provenance, ReadinessStatus } from '@/domain/types';
import { nowIso } from '@/domain/ids';
import { formatCurrency, formatPercent } from '@/lib/format';
import { isBlank, toFraction, toIsoDate, toNumber, toText, type Cell } from './parsers';

/* ───────────────────────── Field definitions ───────────────────────── */

export type FieldKey =
  | 'projectNumber'
  | 'name'
  | 'description'
  | 'location'
  | 'studio'
  | 'categoryId'
  | 'projectType'
  | 'sizeValue'
  | 'principal'
  | 'pipelineProbability'
  | 'estimatedConstructionCost'
  | 'bsaFee'
  | 'feeArchitecture'
  | 'feeEngineering'
  | 'feeInteriors'
  | 'anticipatedAuthorization'
  | 'anticipatedStart'
  | 'anticipatedCompletion'
  | 'revenuePeriods'
  | 'overallReadiness';

type Kind = 'text' | 'currency' | 'fraction' | 'date' | 'number' | 'category' | 'person' | 'periods' | 'readiness';

export interface FieldDef {
  key: FieldKey;
  label: string;
  kind: Kind;
  /** Header synonyms for automatic column mapping (lower-case, punctuation-insensitive). */
  synonyms: string[];
  important?: boolean;
}

export const FIELDS: FieldDef[] = [
  { key: 'projectNumber', label: 'Project number', kind: 'text', synonyms: ['project number', 'project no', 'project #', 'proj no', 'proj number', 'job number', 'number', 'project id'], important: true },
  { key: 'name', label: 'Project name', kind: 'text', synonyms: ['project name', 'name', 'project', 'project title', 'title'], important: true },
  { key: 'description', label: 'Description', kind: 'text', synonyms: ['description', 'scope', 'notes'] },
  { key: 'location', label: 'Location', kind: 'text', synonyms: ['location', 'city', 'site', 'address'] },
  { key: 'studio', label: 'Studio', kind: 'text', synonyms: ['studio', 'office'], important: true },
  { key: 'categoryId', label: 'Portfolio category', kind: 'category', synonyms: ['category', 'portfolio category', 'status', 'portfolio status', 'stage'] },
  { key: 'projectType', label: 'Project type', kind: 'text', synonyms: ['project type', 'type', 'market', 'building type'] },
  { key: 'sizeValue', label: 'Size (SF)', kind: 'number', synonyms: ['size', 'sf', 'square feet', 'gsf', 'area'] },
  { key: 'principal', label: 'Relationship principal', kind: 'person', synonyms: ['principal', 'relationship principal', 'pic', 'principal in charge', 'client principal'], important: true },
  { key: 'pipelineProbability', label: 'Pipeline probability', kind: 'fraction', synonyms: ['probability', 'pipeline probability', 'win probability', 'prob', 'go'], important: true },
  { key: 'estimatedConstructionCost', label: 'Estimated construction cost', kind: 'currency', synonyms: ['construction cost', 'estimated construction cost', 'cost', 'budget', 'construction budget'] },
  { key: 'bsaFee', label: 'BSA fee', kind: 'currency', synonyms: ['bsa fee', 'fee', 'total fee', 'fees'], important: true },
  { key: 'feeArchitecture', label: 'Architecture fee %', kind: 'fraction', synonyms: ['architecture', 'arch', 'arch %', 'architecture %', 'architectural'] },
  { key: 'feeEngineering', label: 'Engineering fee %', kind: 'fraction', synonyms: ['engineering', 'eng', 'eng %', 'engineering %', 'mep'] },
  { key: 'feeInteriors', label: 'Interiors fee %', kind: 'fraction', synonyms: ['interiors', 'interior', 'int', 'interiors %', 'interior design'] },
  { key: 'anticipatedAuthorization', label: 'Anticipated authorization', kind: 'date', synonyms: ['authorization', 'anticipated authorization', 'auth date', 'authorization date'] },
  { key: 'anticipatedStart', label: 'Anticipated start', kind: 'date', synonyms: ['start', 'start date', 'anticipated start'] },
  { key: 'anticipatedCompletion', label: 'Anticipated completion', kind: 'date', synonyms: ['completion', 'end', 'finish', 'completion date', 'anticipated completion'] },
  { key: 'revenuePeriods', label: 'Revenue projection period', kind: 'periods', synonyms: [] },
  { key: 'overallReadiness', label: 'Overall readiness', kind: 'readiness', synonyms: ['readiness', 'restart readiness'] },
];

export const fieldDef = (k: FieldKey) => FIELDS.find((f) => f.key === k)!;

export type Values = Partial<{
  projectNumber: string | null;
  name: string | null;
  description: string | null;
  location: string | null;
  studio: string | null;
  categoryId: string | null;
  projectType: string | null;
  sizeValue: number | null;
  principal: { id: ID | null; raw: string | null };
  pipelineProbability: number | null;
  estimatedConstructionCost: number | null;
  bsaFee: number | null;
  feeArchitecture: number | null;
  feeEngineering: number | null;
  feeInteriors: number | null;
  anticipatedAuthorization: string | null;
  anticipatedStart: string | null;
  anticipatedCompletion: string | null;
  revenuePeriods: (number | null)[];
  overallReadiness: ReadinessStatus;
}>;

export interface Issue {
  level: 'error' | 'warning' | 'info';
  field?: FieldKey;
  message: string;
}

export interface Candidate {
  ref: string;
  sourceRow: number | null;
  sourceRecordId: string | null;
  values: Values;
  issues: Issue[];
}

export interface SourceInfo {
  fileName: string;
  format: 'bsa-seed-json' | 'csv' | 'xlsx';
  worksheet: string | null;
  asOf: string | null;
  extractMethod: string | null;
  /** Client named in the file, when the format carries one. */
  clientName: string | null;
  clientCode: string | null;
  /** Source column headers mapped to revenue periods (tabular only). */
  periodColumns?: string[];
}

export interface ParsedImport {
  source: SourceInfo;
  candidates: Candidate[];
  fileIssues: Issue[];
}

/* ───────────────────────── Context helpers ───────────────────────── */

export interface ImportContext {
  client: Client;
  people: Person[];
}

export function matchPerson(raw: string | null, people: Person[]): { id: ID | null; raw: string | null; issue?: Issue } {
  if (!raw) return { id: null, raw: null };
  const key = personKey(raw);
  const hits = people.filter((p) => !p.archivedAt && personKey(p.fullName) === key);
  if (hits.length === 1) return { id: hits[0].id, raw };
  if (hits.length > 1) return { id: null, raw, issue: { level: 'warning', field: 'principal', message: `"${raw}" matches ${hits.length} people; left unassigned for manual selection.` } };
  return { id: null, raw, issue: { level: 'info', field: 'principal', message: `Principal "${raw}" is not in the people directory; the source name is kept for later matching.` } };
}

export function matchCategory(raw: string | null, client: Client): string | null | undefined {
  if (!raw) return null;
  const k = raw.trim().toLowerCase();
  return client.config.portfolioCategories.find((c) => c.id.toLowerCase() === k || c.label.toLowerCase() === k)?.id;
}

const READINESS_VALUES: ReadinessStatus[] = ['not_assessed', 'ready', 'partially_ready', 'not_ready', 'not_applicable'];

/* ───────────────────────── BSA seed JSON ───────────────────────── */

const seedProject = z.object({
  id: z.string().optional(),
  name: z.string(),
  project_number: z.string().nullable().optional(),
  client: z.string().nullable().optional(),
  studio: z.string().nullable().optional(),
  principal: z.string().nullable().optional(),
  pipeline_probability: z.number().nullable().optional(),
  discipline_fee_mix: z.object({ architecture: z.number().nullable().optional(), engineering: z.number().nullable().optional(), interiors: z.number().nullable().optional() }).partial().nullable().optional(),
  bsa_fee: z.number().nullable().optional(),
  revenue_projection_12_periods: z.array(z.number().nullable()).nullable().optional(),
  portfolio_category: z.string().nullable().optional(),
  restart_readiness: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  source_row: z.number().nullable().optional(),
}).passthrough();

export const seedFileSchema = z.object({
  client: z.object({ name: z.string(), client_code: z.string().nullable().optional() }),
  source: z.object({ filename: z.string().optional(), worksheet: z.string().optional(), extract_method: z.string().optional(), as_of: z.string().optional() }).partial().optional(),
  projects: z.array(seedProject),
});

export function isSeedJson(data: unknown): boolean {
  return !!data && typeof data === 'object' && 'projects' in data && 'client' in data;
}

export function parseSeedJson(data: unknown, fileName: string, ctx: ImportContext): ParsedImport {
  const r = seedFileSchema.safeParse(data);
  if (!r.success) {
    return {
      source: { fileName, format: 'bsa-seed-json', worksheet: null, asOf: null, extractMethod: null, clientName: null, clientCode: null },
      candidates: [],
      fileIssues: r.error.issues.slice(0, 5).map((i) => ({ level: 'error' as const, message: `Invalid file structure at ${i.path.join('.') || 'root'}: ${i.message}` })),
    };
  }
  const f = r.data;
  const source: SourceInfo = {
    fileName: f.source?.filename ? `${f.source.filename} (via ${fileName})` : fileName,
    format: 'bsa-seed-json',
    worksheet: f.source?.worksheet ?? null,
    asOf: f.source?.as_of && /^\d{4}-\d{2}-\d{2}$/.test(f.source.as_of) ? f.source.as_of : null,
    extractMethod: f.source?.extract_method ?? null,
    clientName: f.client.name,
    clientCode: f.client.client_code ?? null,
  };
  const candidates = f.projects.map((p, i): Candidate => {
    const issues: Issue[] = [];
    const principal = matchPerson(p.principal ?? null, ctx.people);
    if (principal.issue) issues.push(principal.issue);
    const cat = matchCategory(p.portfolio_category ?? null, ctx.client);
    if (cat === undefined) issues.push({ level: 'error', field: 'categoryId', message: `Category "${p.portfolio_category}" is not configured for this client.` });
    if (p.client && p.client.trim().toLowerCase() !== f.client.name.trim().toLowerCase()) issues.push({ level: 'error', message: `Record is for "${p.client}", not "${f.client.name}".` });
    const readiness = p.restart_readiness && READINESS_VALUES.includes(p.restart_readiness as ReadinessStatus) ? (p.restart_readiness as ReadinessStatus) : undefined;
    if (p.restart_readiness && !readiness) issues.push({ level: 'warning', field: 'overallReadiness', message: `Readiness "${p.restart_readiness}" is not recognized; left as Not Assessed.` });
    const values: Values = {
      projectNumber: p.project_number ?? null,
      name: p.name,
      studio: p.studio ?? null,
      principal: { id: principal.id, raw: principal.raw },
      pipelineProbability: p.pipeline_probability ?? null,
      bsaFee: p.bsa_fee ?? null,
      feeArchitecture: p.discipline_fee_mix?.architecture ?? null,
      feeEngineering: p.discipline_fee_mix?.engineering ?? null,
      feeInteriors: p.discipline_fee_mix?.interiors ?? null,
      ...(cat ? { categoryId: cat } : {}),
      ...(p.revenue_projection_12_periods ? { revenuePeriods: p.revenue_projection_12_periods } : {}),
      ...(p.notes ? { description: p.notes } : {}),
      ...(readiness ? { overallReadiness: readiness } : {}),
    };
    return { ref: p.source_row ? `Source row ${p.source_row}` : `Record ${i + 1}`, sourceRow: p.source_row ?? null, sourceRecordId: p.id ?? null, values, issues };
  });
  return { source, candidates, fileIssues: [] };
}

/* ───────────────────────── Tabular (CSV / XLSX) ───────────────────────── */

export type Mapping = Record<number, FieldKey | ''>; // column index → field

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9%#]+/g, ' ').trim();

export function autoMap(headers: string[]): Mapping {
  const mapping: Mapping = {};
  const used = new Set<FieldKey>();
  headers.forEach((h, i) => {
    const n = norm(h);
    if (!n) return (mapping[i] = '');
    const exact = FIELDS.find((f) => !used.has(f.key) && (norm(f.label) === n || f.synonyms.includes(n)));
    if (exact) {
      used.add(exact.key);
      mapping[i] = exact.key;
      return;
    }
    mapping[i] = '';
  });
  return mapping;
}

export function findHeaderRow(rows: Cell[][]): number {
  // First row with at least two non-blank text cells.
  const i = rows.findIndex((r) => r.filter((c) => typeof c === 'string' && c.trim()).length >= 2);
  return i === -1 ? 0 : i;
}

export function parseTable(rows: Cell[][], headerRow: number, mapping: Mapping, source: Omit<SourceInfo, 'periodColumns'>, ctx: ImportContext, defaultCategory: string): ParsedImport {
  const headers = (rows[headerRow] ?? []).map((h) => String(h ?? ''));
  const periodCols = Object.entries(mapping).filter(([, f]) => f === 'revenuePeriods').map(([i]) => Number(i)).sort((a, b) => a - b);
  const fileIssues: Issue[] = [];
  if (!Object.values(mapping).includes('name')) fileIssues.push({ level: 'error', message: 'Map a column to "Project name" to continue.' });
  const candidates: Candidate[] = [];

  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    if (row.every((c) => isBlank(c))) continue;
    const issues: Issue[] = [];
    const values: Values = {};
    for (const [colStr, key] of Object.entries(mapping)) {
      if (!key || key === 'revenuePeriods') continue;
      const def = fieldDef(key);
      const raw = row[Number(colStr)];
      const bad = () => issues.push({ level: 'error', field: key, message: `${def.label}: "${String(raw)}" could not be read.` });
      switch (def.kind) {
        case 'text':
          (values as Record<string, unknown>)[key] = toText(raw);
          break;
        case 'currency':
        case 'number': {
          const n = toNumber(raw);
          if (n === undefined) bad();
          else (values as Record<string, unknown>)[key] = n;
          break;
        }
        case 'fraction': {
          const f = toFraction(raw);
          if (f === undefined) bad();
          else {
            (values as Record<string, unknown>)[key] = f.value;
            if (f.interpreted) issues.push({ level: 'info', field: key, message: `${def.label}: ${String(raw)} interpreted as ${formatPercent(f.value)} (values over 1 are read as percentages).` });
          }
          break;
        }
        case 'date': {
          const d = toIsoDate(raw);
          if (d === undefined) bad();
          else (values as Record<string, unknown>)[key] = d;
          break;
        }
        case 'category': {
          const t = toText(raw);
          const c = matchCategory(t, ctx.client);
          if (c === undefined) issues.push({ level: 'error', field: key, message: `Category "${t}" is not configured for ${ctx.client.name}.` });
          else if (c) values.categoryId = c;
          break;
        }
        case 'person': {
          const m = matchPerson(toText(raw), ctx.people);
          values.principal = { id: m.id, raw: m.raw };
          if (m.issue) issues.push(m.issue);
          break;
        }
        case 'readiness': {
          const t = toText(raw)?.toLowerCase().replace(/\s+/g, '_');
          if (t && READINESS_VALUES.includes(t as ReadinessStatus)) values.overallReadiness = t as ReadinessStatus;
          else if (t) issues.push({ level: 'warning', field: key, message: `Readiness "${toText(raw)}" not recognized; left as Not Assessed.` });
          break;
        }
        default:
          break;
      }
    }
    if (periodCols.length) {
      const periods: (number | null)[] = [];
      for (const c of periodCols) {
        const n = toNumber(row[c]);
        if (n === undefined) {
          issues.push({ level: 'error', field: 'revenuePeriods', message: `Revenue period "${headers[c]}": "${String(row[c])}" could not be read.` });
          periods.push(null);
        } else periods.push(n);
      }
      values.revenuePeriods = periods;
    }
    if (values.categoryId === undefined) values.categoryId = defaultCategory;
    candidates.push({ ref: `Row ${r + 1}`, sourceRow: r + 1, sourceRecordId: null, values, issues });
  }
  return { source: { ...source, periodColumns: periodCols.map((c) => headers[c]) }, candidates, fileIssues };
}

/* ───────────────────────── Preview ───────────────────────── */

/**
 * - new: no existing project corresponds to this record.
 * - match: the existing project is identified with certainty (same stable source id, or an unambiguous project number).
 * - ambiguous: the project number is shared and the right target cannot be determined; nothing happens unless you choose.
 */
export type RowStatus = 'new' | 'match' | 'ambiguous' | 'duplicate_in_file' | 'invalid';
export type RowAction = 'add' | 'update' | 'skip';

export interface FieldChange {
  key: FieldKey;
  label: string;
  from: string;
  to: string;
  /** Existing value is set and would be overwritten. */
  conflict: boolean;
}

export interface PreviewRow {
  candidate: Candidate;
  status: RowStatus;
  /** How `existing` was identified. */
  matchedBy: 'source-id' | 'project-number' | null;
  existing: Project | null;
  changes: FieldChange[];
  missing: string[];
  errors: Issue[];
  warnings: Issue[];
  infos: Issue[];
  action: RowAction;
}

export interface Preview {
  source: SourceInfo;
  fileIssues: Issue[];
  rows: PreviewRow[];
}

/** Reads a field from a project in the same shape as Values. */
function projectValue(p: Project, key: FieldKey): unknown {
  const bd = p.businessDevelopment;
  switch (key) {
    case 'projectNumber': return p.projectNumber;
    case 'name': return p.name;
    case 'description': return p.description || null;
    case 'location': return p.location;
    case 'studio': return p.studio;
    case 'categoryId': return p.categoryId;
    case 'projectType': return p.projectType;
    case 'sizeValue': return p.size.value;
    case 'principal': return { id: bd.relationshipPrincipalId, raw: bd.relationshipPrincipalRaw };
    case 'pipelineProbability': return bd.pipelineProbability;
    case 'estimatedConstructionCost': return bd.estimatedConstructionCost;
    case 'bsaFee': return bd.bsaFee;
    case 'feeArchitecture': return bd.feeMix.architecture;
    case 'feeEngineering': return bd.feeMix.engineering;
    case 'feeInteriors': return bd.feeMix.interiors;
    case 'anticipatedAuthorization': return bd.anticipatedAuthorization;
    case 'anticipatedStart': return bd.anticipatedStart;
    case 'anticipatedCompletion': return bd.anticipatedCompletion;
    case 'revenuePeriods': return bd.revenueProjection?.periods.map((x) => x.amount) ?? null;
    case 'overallReadiness': return p.overallReadiness.status;
  }
}

function isEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined || v === '') return true;
  if (typeof v === 'object' && !Array.isArray(v) && 'id' in v) {
    const pv = v as { id: unknown; raw?: unknown };
    return !pv.id && !pv.raw;
  }
  return false;
}

function display(key: FieldKey, v: unknown, ctx: ImportContext): string {
  if (isEmptyValue(v)) return '—';
  const kind = fieldDef(key).kind;
  if (kind === 'currency') return formatCurrency(v as number);
  if (kind === 'fraction') return formatPercent(v as number);
  if (kind === 'person') {
    const pv = v as { id: ID | null; raw: string | null };
    return ctx.people.find((p) => p.id === pv.id)?.fullName ?? `${pv.raw} (unmatched)`;
  }
  if (kind === 'category') return ctx.client.config.portfolioCategories.find((c) => c.id === v)?.label ?? String(v);
  if (kind === 'periods') {
    const arr = v as (number | null)[];
    return `${arr.length} periods, total ${formatCurrency(arr.reduce<number>((s, x) => s + (x ?? 0), 0))}`;
  }
  return String(v);
}

/**
 * Incoming values that must never overwrite existing data: blanks, and "Not Assessed" readiness
 * (the absence of an assessment is not an assessment, so it never replaces one a leader recorded).
 */
function isIgnorableIncoming(key: FieldKey, v: unknown): boolean {
  return isEmptyValue(v) || (key === 'overallReadiness' && v === 'not_assessed');
}

function same(key: FieldKey, current: unknown, incoming: unknown): boolean {
  if (key === 'principal') {
    const c = current as { id: ID | null; raw: string | null };
    const i = incoming as { id: ID | null; raw: string | null };
    // Matched people compare by id; unmatched source names compare by raw text.
    return i.id ? c.id === i.id : !c.id && (c.raw ?? null) === (i.raw ?? null);
  }
  return JSON.stringify(current ?? null) === JSON.stringify(incoming ?? null);
}

export function buildPreview(parsed: ParsedImport, data: Dataset, ctx: ImportContext): Preview {
  const fileIssues = [...parsed.fileIssues];
  const client = ctx.client;
  if (parsed.source.clientName && parsed.source.clientName.trim().toLowerCase() !== client.name.trim().toLowerCase()) {
    fileIssues.push({ level: 'error', message: `This file is for "${parsed.source.clientName}", but the current workspace is "${client.name}". Switch to the matching client workspace before importing.` });
  }
  if (parsed.source.clientCode && client.clientCode && parsed.source.clientCode !== client.clientCode) {
    fileIssues.push({ level: 'error', message: `Client code ${parsed.source.clientCode} in the file does not match this workspace (${client.clientCode}).` });
  }
  const fileBlocked = fileIssues.some((i) => i.level === 'error');
  const existing = data.projects.filter((p) => p.clientId === client.id);
  const num = (x: string | null | undefined) => x?.trim().toLowerCase() || null;
  const sid = (c: Candidate) => c.sourceRecordId?.trim() || null;
  const existingBySid = new Map(existing.filter((p) => p.provenance?.sourceRecordId).map((p) => [p.provenance!.sourceRecordId!, p]));
  // Existing projects already claimed by some record in this file through its stable id.
  const claimed = new Set(parsed.candidates.map((c) => (sid(c) ? existingBySid.get(sid(c)!)?.id : undefined)).filter(Boolean) as string[]);
  const seenIds = new Map<string, string>();
  const seenNumbers = new Map<string, string>();

  const rows = parsed.candidates.map((c): PreviewRow => {
    const issues = [...c.issues];
    const v = c.values;
    if (!v.name || !String(v.name).trim()) issues.push({ level: 'error', field: 'name', message: 'Project name is missing.' });
    if (v.pipelineProbability != null && (v.pipelineProbability < 0 || v.pipelineProbability > 1)) issues.push({ level: 'error', field: 'pipelineProbability', message: 'Probability must be between 0% and 100%.' });
    for (const k of ['bsaFee', 'estimatedConstructionCost', 'sizeValue'] as const) if (v[k] != null && (v[k] as number) < 0) issues.push({ level: 'error', field: k, message: `${fieldDef(k).label} cannot be negative.` });
    const mix = [v.feeArchitecture, v.feeEngineering, v.feeInteriors];
    if (mix.every((x) => x != null) && Math.abs(mix.reduce<number>((s, x) => s + (x as number), 0) - 1) > 0.0001) issues.push({ level: 'warning', message: `Fee mix totals ${formatPercent(mix.reduce<number>((s, x) => s + (x as number), 0))}, not 100%. Imported as recorded.` });
    if (v.revenuePeriods && v.bsaFee != null) {
      const total = v.revenuePeriods.reduce<number>((s, x) => s + (x ?? 0), 0);
      if (total > v.bsaFee) issues.push({ level: 'warning', field: 'revenuePeriods', message: `Revenue projection total (${formatCurrency(total)}) exceeds the BSA fee (${formatCurrency(v.bsaFee)}). Imported as recorded; confirm the projection basis.` });
    }
    if (v.revenuePeriods) issues.push({ level: 'info', field: 'revenuePeriods', message: 'Revenue period calendar labels are unresolved and will not be inferred.' });
    if (v.projectNumber && parsed.source.clientCode && !v.projectNumber.startsWith(parsed.source.clientCode)) issues.push({ level: 'warning', field: 'projectNumber', message: `Project number does not begin with client code ${parsed.source.clientCode}.` });

    const id = sid(c);
    const number = num(v.projectNumber);
    // Other records in this file that share the project number.
    const siblings = number ? parsed.candidates.filter((o) => o !== c && num(o.values.projectNumber) === number) : [];
    let status: RowStatus = 'new';
    let match: Project | null = null;
    let matchedBy: PreviewRow['matchedBy'] = null;

    if (id && seenIds.has(id)) {
      status = 'duplicate_in_file';
      issues.push({ level: 'error', message: `Same record id "${id}" as ${seenIds.get(id)} in this file.` });
    } else if (!id && number && seenNumbers.has(number)) {
      status = 'duplicate_in_file';
      issues.push({ level: 'error', field: 'projectNumber', message: `Duplicate of ${seenNumbers.get(number)} in this file (no record id to tell them apart).` });
    } else {
      if (id) seenIds.set(id, c.ref);
      if (number) seenNumbers.set(number, seenNumbers.get(number) ?? c.ref);
      if (siblings.length && id && siblings.every((o) => sid(o) && sid(o) !== id)) {
        issues.push({ level: 'info', field: 'projectNumber', message: `Shares project number ${v.projectNumber} with ${siblings.map((o) => `${o.ref} (“${o.values.name}”)`).join(', ')}. Kept as a separate scope entry; the two are never merged automatically.` });
      }
      const byId = id ? existingBySid.get(id) ?? null : null;
      if (byId) {
        match = byId;
        matchedBy = 'source-id';
        status = 'match';
      } else if (number) {
        const hits = existing.filter((p) => num(p.projectNumber) === number);
        const open = hits.filter((p) => !claimed.has(p.id));
        const certain = open.length === 1 && siblings.length === 0 && (!id || !open[0].provenance?.sourceRecordId);
        if (certain) {
          match = open[0];
          matchedBy = 'project-number';
          status = 'match';
          if (id) issues.push({ level: 'info', message: `Matched by project number. The record id "${id}" will be stored so future imports match it directly.` });
        } else if (open.length) {
          status = 'ambiguous';
          issues.push({
            level: 'warning',
            field: 'projectNumber',
            message: `Project number ${v.projectNumber} is shared${siblings.length ? ` by ${siblings.length + 1} records in this file` : ''} and also used by existing project${open.length > 1 ? 's' : ''} ${open.map((p) => `“${p.name}”`).join(', ')}. It can’t be matched with certainty, so nothing happens unless you choose: add as a new project, update “${open[0].name}”, or skip.`,
          });
          match = open[0];
        } else if (hits.length) {
          issues.push({ level: 'info', field: 'projectNumber', message: `Existing project${hits.length > 1 ? 's' : ''} ${hits.map((p) => `“${p.name}”`).join(', ')} share${hits.length > 1 ? '' : 's'} this project number but ${hits.length > 1 ? 'are' : 'is'} a different entry in this file. Will be added separately.` });
        }
      } else if (v.name) {
        const byName = existing.find((p) => p.name.trim().toLowerCase() === String(v.name).trim().toLowerCase());
        if (byName) issues.push({ level: 'warning', message: `No project number; an existing project has the same name ("${byName.name}"). Adding would create a possible duplicate.` });
      }
    }
    const errors = issues.filter((i) => i.level === 'error');
    if (errors.length && status !== 'duplicate_in_file') status = status === 'match' || status === 'ambiguous' ? status : 'invalid';

    const changes: FieldChange[] = [];
    if (match) {
      for (const key of Object.keys(v) as FieldKey[]) {
        const incoming = v[key];
        if (isIgnorableIncoming(key, incoming)) continue; // blank source values never erase existing data
        const current = projectValue(match, key);
        if (key === 'principal' && match.businessDevelopment.relationshipPrincipalId) {
          // An assigned principal is a leadership decision made in the app; the file never replaces it.
          if (!same(key, current, incoming)) issues.push({ level: 'info', field: 'principal', message: `File lists principal "${(incoming as { raw: string | null }).raw}"; the assigned principal (${display(key, current, ctx)}) is kept.` });
          continue;
        }
        if (same(key, current, incoming)) continue;
        if (key === 'revenuePeriods') {
          const tot = (a: unknown) => ((a as (number | null)[] | null) ?? []).reduce<number>((s, x) => s + (x ?? 0), 0);
          if (tot(current) > 0 && tot(incoming) === 0) issues.push({ level: 'warning', field: 'revenuePeriods', message: `The file's revenue projection is all zero. Updating would replace the current projection (${formatCurrency(tot(current))} total). Confirm this is intended before updating.` });
        }
        changes.push({ key, label: fieldDef(key).label, from: display(key, current, ctx), to: display(key, incoming, ctx), conflict: !isEmptyValue(current) });
      }
    }
    const missing = FIELDS.filter((f) => f.important && isEmptyValue(v[f.key as keyof Values])).map((f) => f.label);
    const action: RowAction = fileBlocked || errors.length ? 'skip' : status === 'new' ? 'add' : 'skip';
    return { candidate: c, status, matchedBy, existing: match, changes, missing, errors, warnings: issues.filter((i) => i.level === 'warning'), infos: issues.filter((i) => i.level === 'info'), action };
  });
  return { source: parsed.source, fileIssues, rows };
}

/** Allowed actions for a row; rows with errors can only be skipped. */
export function allowedActions(row: PreviewRow, fileBlocked: boolean): RowAction[] {
  if (fileBlocked || row.errors.length) return ['skip'];
  if (row.status === 'ambiguous') return ['skip', 'add', 'update'];
  if (row.status === 'match') return row.changes.length ? ['skip', 'update'] : ['skip'];
  return ['add', 'skip'];
}

/* ───────────────────────── Commit ───────────────────────── */

function applyValues(p: Project, v: Values, onlyNonEmpty: boolean, source: SourceInfo): Project {
  const n = structuredClone(p);
  const bd = n.businessDevelopment;
  const set = <K extends keyof Values>(k: K, fn: (val: NonNullable<Values[K]> | null) => void) => {
    if (!(k in v)) return;
    const val = v[k];
    if (onlyNonEmpty && isIgnorableIncoming(k as FieldKey, val)) return;
    fn((val ?? null) as NonNullable<Values[K]> | null);
  };
  set('projectNumber', (x) => (n.projectNumber = x));
  set('name', (x) => (n.name = x ?? n.name));
  set('description', (x) => (n.description = x ?? ''));
  set('location', (x) => (n.location = x));
  set('studio', (x) => (n.studio = x));
  set('categoryId', (x) => (n.categoryId = x ?? n.categoryId));
  set('projectType', (x) => (n.projectType = x));
  set('sizeValue', (x) => (n.size = { ...n.size, value: x }));
  set('principal', (x) => {
    if (onlyNonEmpty && bd.relationshipPrincipalId) return; // never replace an assigned principal
    bd.relationshipPrincipalId = x?.id ?? null;
    bd.relationshipPrincipalRaw = x?.id ? null : x?.raw ?? null;
  });
  set('pipelineProbability', (x) => (bd.pipelineProbability = x));
  set('estimatedConstructionCost', (x) => (bd.estimatedConstructionCost = x));
  set('bsaFee', (x) => (bd.bsaFee = x));
  set('feeArchitecture', (x) => (bd.feeMix.architecture = x));
  set('feeEngineering', (x) => (bd.feeMix.engineering = x));
  set('feeInteriors', (x) => (bd.feeMix.interiors = x));
  set('anticipatedAuthorization', (x) => (bd.anticipatedAuthorization = x));
  set('anticipatedStart', (x) => (bd.anticipatedStart = x));
  set('anticipatedCompletion', (x) => (bd.anticipatedCompletion = x));
  set('revenuePeriods', (x) => {
    bd.revenueProjection = x
      ? {
          periods: x.map((amount, i) => ({ index: i + 1, label: null, amount })),
          calendarMapping: 'unresolved',
          basisNote: source.periodColumns?.length ? `Imported from source columns: ${source.periodColumns.join(', ')}. Calendar mapping not established.` : 'Imported sequence; calendar mapping not established by source.',
        }
      : null;
  });
  set('overallReadiness', (x) => (n.overallReadiness = { ...n.overallReadiness, status: x ?? 'not_assessed' }));
  return n;
}

export interface CommitResult {
  added: ID[];
  updated: ID[];
  skipped: number;
}

export function commitImport(d: Dataset, preview: Preview, clientId: ID, importedBy: string | null): CommitResult {
  const fileBlocked = preview.fileIssues.some((i) => i.level === 'error');
  if (fileBlocked) throw new Error('This file has blocking errors and cannot be imported.');
  const ts = nowIso();
  const result: CommitResult = { added: [], updated: [], skipped: 0 };
  for (const row of preview.rows) {
    if (!allowedActions(row, false).includes(row.action) || row.action === 'skip') {
      result.skipped++;
      continue;
    }
    const provenance: Provenance = {
      sourceFile: preview.source.fileName,
      worksheet: preview.source.worksheet,
      sourceRow: row.candidate.sourceRow,
      sourceRecordId: row.candidate.sourceRecordId,
      sourceAsOf: preview.source.asOf,
      importedAt: ts,
      importedBy,
      extractMethod: preview.source.extractMethod,
    };
    if (row.action === 'add') {
      const base = blankProject(clientId, row.candidate.values.categoryId ?? 'potential');
      const p = { ...applyValues(base, row.candidate.values, false, preview.source), provenance };
      upsertProject(d, p, importedBy, `Imported from ${preview.source.fileName}${row.candidate.sourceRow ? ` (${row.candidate.ref})` : ''}.`);
      result.added.push(p.id);
    } else if (row.action === 'update' && row.existing) {
      const current = d.projects.find((p) => p.id === row.existing!.id);
      if (!current) {
        result.skipped++;
        continue;
      }
      // Keep the original provenance, but record the stable source id when it wasn't known, so later imports match by id.
      const kept = current.provenance ?? provenance;
      const next = { ...applyValues(current, row.candidate.values, true, preview.source), provenance: kept.sourceRecordId ? kept : { ...kept, sourceRecordId: row.candidate.sourceRecordId } };
      const changed = row.changes.map((c) => c.label).join(', ') || 'source record id';
      upsertProject(d, next, importedBy, `Updated from ${preview.source.fileName} (${row.candidate.ref}): ${changed}.`);
      result.updated.push(current.id);
    }
  }
  return result;
}
