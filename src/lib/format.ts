export const TBC = 'To Be Confirmed';
export const NOT_ASSESSED = 'Not Assessed';

const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const usdCompact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });

export function formatCurrency(value: number | null | undefined, { compact = false, empty = TBC } = {}): string {
  if (value === null || value === undefined || Number.isNaN(value)) return empty;
  return compact ? usdCompact.format(value) : usd0.format(value);
}

/** Fractions (0–1) to percentages without altering the stored value. */
export function formatPercent(fraction: number | null | undefined, empty = TBC): string {
  if (fraction === null || fraction === undefined) return empty;
  const pct = fraction * 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
}

export function formatDate(iso: string | null | undefined, empty = TBC): string {
  if (!iso) return empty;
  const d = iso.length === 10 ? new Date(`${iso}T00:00:00`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return empty;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined, empty = TBC): string {
  if (!iso) return empty;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return empty;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function formatBytes(n: number | null): string {
  if (n === null) return 'Unknown';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
