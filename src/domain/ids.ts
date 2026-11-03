/** Stable, opaque identifiers. Prefix aids debugging; the random part guarantees uniqueness. */
export function newId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  return `${prefix}_${rand}`;
}

export const nowIso = (): string => new Date().toISOString();
