/**
 * File parsers for project import. Pure functions (no React), unit-tested.
 * - CSV: RFC 4180 (quoted fields, escaped quotes, CRLF), delimiter auto-detected, BOM stripped.
 * - XLSX: unzipped with fflate and read via DOMParser — values only (no formulas/styles evaluated).
 */
import { unzipSync, strFromU8 } from 'fflate';

export type Cell = string | number | boolean | null;

export interface Sheet {
  name: string;
  rows: Cell[][];
}

export class ParseError extends Error {}

/* ───────────────────────── CSV ───────────────────────── */

export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const counts = [',', ';', '\t'].map((d) => ({ d, n: firstLine.split(d).length - 1 }));
  return counts.sort((a, b) => b.n - a.n)[0].n > 0 ? counts[0].d : ',';
}

export function parseCsv(input: string, delimiter?: string): Cell[][] {
  const text = input.replace(/^﻿/, '');
  const d = delimiter ?? detectDelimiter(text);
  const rows: Cell[][] = [];
  let row: Cell[] = [];
  let field = '';
  let quoted = false;
  let i = 0;
  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    if (!(row.length === 1 && row[0] === '')) rows.push(row);
    row = [];
  };
  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"' && field === '') {
      quoted = true;
      i++;
      continue;
    }
    if (ch === d) {
      pushField();
      i++;
      continue;
    }
    if (ch === '\r' || ch === '\n') {
      pushRow();
      i += ch === '\r' && text[i + 1] === '\n' ? 2 : 1;
      continue;
    }
    field += ch;
    i++;
  }
  if (quoted) throw new ParseError('The CSV file has an unterminated quoted field.');
  if (field !== '' || row.length) pushRow();
  return rows;
}

/* ───────────────────────── XLSX ───────────────────────── */

const MAX_XLSX_BYTES = 25 * 1024 * 1024;

function xml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new ParseError('The workbook contains malformed XML.');
  return doc;
}

/** Elements by local name, ignoring XML namespaces/prefixes. */
function byLocal(root: Document | Element, name: string): Element[] {
  return Array.from(root.getElementsByTagNameNS('*', name));
}

export function columnIndex(ref: string): number {
  const letters = ref.replace(/[^A-Z]/gi, '').toUpperCase();
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function parseXlsx(buffer: ArrayBuffer): Sheet[] {
  if (buffer.byteLength > MAX_XLSX_BYTES) throw new ParseError('The workbook is larger than 25 MB.');
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(buffer));
  } catch {
    throw new ParseError('This is not a valid .xlsx workbook. Older .xls files must be saved as .xlsx or CSV first.');
  }
  const read = (path: string) => (files[path] ? strFromU8(files[path]) : null);
  const workbook = read('xl/workbook.xml');
  if (!workbook) throw new ParseError('The workbook is missing xl/workbook.xml.');

  const shared: string[] = [];
  const ss = read('xl/sharedStrings.xml');
  if (ss) for (const si of byLocal(xml(ss), 'si')) shared.push(byLocal(si, 't').map((t) => t.textContent ?? '').join(''));

  const rels = new Map<string, string>();
  const relsXml = read('xl/_rels/workbook.xml.rels');
  if (relsXml) for (const r of byLocal(xml(relsXml), 'Relationship')) rels.set(r.getAttribute('Id') ?? '', r.getAttribute('Target') ?? '');

  const sheets: Sheet[] = [];
  byLocal(xml(workbook), 'sheet').forEach((s, i) => {
    const name = s.getAttribute('name') ?? `Sheet${i + 1}`;
    const rid = s.getAttribute('r:id') ?? Array.from(s.attributes).find((a) => a.name.endsWith(':id'))?.value ?? '';
    let target = rels.get(rid) ?? `worksheets/sheet${i + 1}.xml`;
    target = target.replace(/^\/?xl\//, '').replace(/^\//, '');
    const sheetXml = read(`xl/${target}`);
    if (!sheetXml) return;
    const rows: Cell[][] = [];
    for (const r of byLocal(xml(sheetXml), 'row')) {
      const rowIndex = Number(r.getAttribute('r') ?? rows.length + 1) - 1;
      const cells: Cell[] = [];
      for (const c of byLocal(r, 'c')) {
        const col = columnIndex(c.getAttribute('r') ?? '') ;
        const type = c.getAttribute('t');
        const v = byLocal(c, 'v')[0]?.textContent ?? null;
        let value: Cell = null;
        if (type === 's') value = v !== null ? shared[Number(v)] ?? null : null;
        else if (type === 'inlineStr') value = byLocal(c, 't').map((t) => t.textContent ?? '').join('');
        else if (type === 'str' || type === 'e') value = v;
        else if (type === 'b') value = v === '1';
        else if (v !== null && v !== '') value = Number(v);
        cells[col >= 0 ? col : cells.length] = value;
      }
      rows[rowIndex] = Array.from(cells, (x) => (x === undefined ? null : x));
    }
    sheets.push({ name, rows: Array.from(rows, (r) => r ?? []) });
  });
  if (!sheets.length) throw new ParseError('No worksheets were found in the workbook.');
  return sheets;
}

/* ───────────────────────── Value coercion ───────────────────────── */

export const isBlank = (v: Cell | undefined): boolean => v === null || v === undefined || (typeof v === 'string' && (v.trim() === '' || v.trim() === '-' || v.trim() === '—'));

export function toText(v: Cell | undefined): string | null {
  if (isBlank(v)) return null;
  return String(v).trim();
}

/** "$1,234.50", "(1,000)", "1234" → number. Returns undefined when present but unparseable. */
export function toNumber(v: Cell | undefined): number | null | undefined {
  if (isBlank(v)) return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return undefined;
  let s = String(v).trim();
  const negative = /^\(.*\)$/.test(s);
  s = s.replace(/[()$,\s]/g, '');
  if (s === '' || Number.isNaN(Number(s))) return undefined;
  return negative ? -Number(s) : Number(s);
}

/**
 * Fractions: "50%" → 0.5, 0.5 → 0.5. Values > 1 without a % sign are interpreted as percentages (50 → 0.5)
 * and flagged with `interpreted: true` so the preview can show the rule that was applied.
 */
export function toFraction(v: Cell | undefined): { value: number | null; interpreted: boolean } | undefined {
  if (isBlank(v)) return { value: null, interpreted: false };
  const hasPct = typeof v === 'string' && v.includes('%');
  const n = toNumber(typeof v === 'string' ? v.replace('%', '') : v);
  if (n === undefined || n === null) return n === null ? { value: null, interpreted: false } : undefined;
  if (hasPct) return { value: n / 100, interpreted: false };
  if (n > 1) return { value: n / 100, interpreted: true };
  return { value: n, interpreted: false };
}

/** ISO dates, US m/d/yyyy, or Excel serial numbers → YYYY-MM-DD. */
export function toIsoDate(v: Cell | undefined): string | null | undefined {
  if (isBlank(v)) return null;
  if (typeof v === 'number') {
    if (v < 20000 || v > 80000) return undefined; // not a plausible Excel date serial (1954–2119)
    const ms = Math.round((v - 25569) * 86400 * 1000);
    return new Date(ms).toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (us) {
    const year = us[3].length === 2 ? 2000 + Number(us[3]) : Number(us[3]);
    return `${year}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  }
  return undefined;
}
