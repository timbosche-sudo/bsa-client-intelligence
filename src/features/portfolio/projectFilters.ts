import { personName, type ClientWorkspace } from '@/data/repository';
import type { Project, ReadinessStatus } from '@/domain/types';

export interface PortfolioFilters {
  q: string;
  category: string; // 'current' (all except archived) | 'all' | category id
  studio: string;
  principal: string; // person id | raw name prefixed with "raw:" | ''
  type: string;
  readiness: '' | ReadinessStatus;
  startYear: string; // '' | 'none' | YYYY
}

export const EMPTY_FILTERS: PortfolioFilters = { q: '', category: 'current', studio: '', principal: '', type: '', readiness: '', startYear: '' };

export type SortKey = 'name' | 'number' | 'category' | 'principal' | 'fee' | 'probability' | 'start' | 'readiness' | 'updated';
export interface SortState {
  key: SortKey;
  dir: 'asc' | 'desc';
}

const READINESS_RANK: Record<ReadinessStatus, number> = { ready: 0, partially_ready: 1, not_ready: 2, not_applicable: 3, not_assessed: 4 };

export function principalKey(p: Project): string {
  return p.businessDevelopment.relationshipPrincipalId ?? (p.businessDevelopment.relationshipPrincipalRaw ? `raw:${p.businessDevelopment.relationshipPrincipalRaw}` : '');
}

export function principalLabel(ws: Pick<ClientWorkspace, 'people'>, p: Project): string | null {
  return personName(ws, p.businessDevelopment.relationshipPrincipalId) ?? p.businessDevelopment.relationshipPrincipalRaw;
}

/**
 * 'current'  — everything not archived (neither archived record nor "Archived" category)
 * 'archived' — archived records or the "Archived" category
 * 'all'      — everything
 * otherwise  — that category, excluding archived records
 */
export function matchesCategory(p: Project, category: string): boolean {
  const archived = !!p.archivedAt || p.categoryId === 'archived';
  if (category === 'all') return true;
  if (category === 'current') return !archived;
  if (category === 'archived') return archived;
  return !p.archivedAt && p.categoryId === category;
}

export function filterProjects(projects: Project[], f: PortfolioFilters): Project[] {
  const q = f.q.trim().toLowerCase();
  return projects.filter((p) => {
    if (!matchesCategory(p, f.category)) return false;
    if (q && !(p.name.toLowerCase().includes(q) || (p.projectNumber ?? '').toLowerCase().includes(q))) return false;
    if (f.studio && (p.studio ?? '') !== f.studio) return false;
    if (f.principal && principalKey(p) !== f.principal) return false;
    if (f.type && (p.projectType ?? '') !== f.type) return false;
    if (f.readiness && p.overallReadiness.status !== f.readiness) return false;
    if (f.startYear) {
      const y = p.businessDevelopment.anticipatedStart?.slice(0, 4) ?? 'none';
      if (y !== f.startYear) return false;
    }
    return true;
  });
}

/** Sorts with nulls/unknowns always last, regardless of direction. */
export function sortProjects(projects: Project[], s: SortState, ws: Pick<ClientWorkspace, 'people' | 'client'>): Project[] {
  const catOrder = (id: string) => ws.client.config.portfolioCategories.find((c) => c.id === id)?.order ?? 99;
  const val = (p: Project): string | number | null => {
    switch (s.key) {
      case 'name':
        return p.name.toLowerCase();
      case 'number':
        return p.projectNumber?.toLowerCase() ?? null;
      case 'category':
        return catOrder(p.categoryId);
      case 'principal':
        return principalLabel(ws, p)?.toLowerCase() ?? null;
      case 'fee':
        return p.businessDevelopment.bsaFee;
      case 'probability':
        return p.businessDevelopment.pipelineProbability;
      case 'start':
        return p.businessDevelopment.anticipatedStart;
      case 'readiness':
        return p.overallReadiness.status === 'not_assessed' ? null : READINESS_RANK[p.overallReadiness.status];
      case 'updated':
        return p.updatedAt;
    }
  };
  const dir = s.dir === 'asc' ? 1 : -1;
  return [...projects].sort((a, b) => {
    const va = val(a);
    const vb = val(b);
    if (va === null && vb === null) return a.name.localeCompare(b.name);
    if (va === null) return 1;
    if (vb === null) return -1;
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return a.name.localeCompare(b.name);
  });
}

/** Distinct option values present in the data (filters never offer values that match nothing). */
export function filterOptions(projects: Project[], ws: Pick<ClientWorkspace, 'people'>) {
  const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b));
  const principals = new Map<string, string>();
  projects.forEach((p) => {
    const k = principalKey(p);
    if (k) principals.set(k, principalLabel(ws, p) ?? k);
  });
  const years = uniq(projects.map((p) => p.businessDevelopment.anticipatedStart?.slice(0, 4) ?? null));
  return {
    studios: uniq(projects.map((p) => p.studio)),
    types: uniq(projects.map((p) => p.projectType)),
    principals: [...principals.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label)),
    years,
    hasUndatedStart: projects.some((p) => !p.businessDevelopment.anticipatedStart),
  };
}
