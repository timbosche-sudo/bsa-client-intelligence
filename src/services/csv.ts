/** CSV export with RFC 4180 quoting and spreadsheet formula-injection protection. */
export type CsvCell = string | number | boolean | null | undefined;

export function csvCell(v: CsvCell): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  // Neutralize values a spreadsheet would execute as formulas (=, +, -, @, tab, CR) — numbers are safe.
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: CsvCell[][]): string {
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function downloadCsv(filename: string, rows: CsvCell[][]): void {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const csvFilename = (client: string, what: string) => `BSA_${client.replace(/[^A-Za-z0-9]+/g, '_')}_${what}_${new Date().toISOString().slice(0, 10)}.csv`;
