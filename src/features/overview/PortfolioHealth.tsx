import { Info } from 'lucide-react';
import { active, type ClientWorkspace, type PortfolioSummary } from '@/data/repository';
import { READINESS_LABELS, type ReadinessStatus } from '@/domain/types';
import { EmptyState } from '@/components/ui/EmptyState';

// Ordered sequential ramp from the accent; distinguishes categories without implying good/bad.
const CATEGORY_SHADES = ['var(--accent)', 'color-mix(in oklab, var(--accent) 65%, var(--surface-3))', 'color-mix(in oklab, var(--accent) 38%, var(--surface-3))', 'var(--border-strong)', 'var(--border)'];

const READINESS_ORDER: ReadinessStatus[] = ['ready', 'partially_ready', 'not_ready', 'not_applicable', 'not_assessed'];
const READINESS_COLOR: Record<ReadinessStatus, string> = {
  ready: 'var(--positive)',
  partially_ready: 'var(--caution)',
  not_ready: 'var(--negative)',
  not_applicable: 'var(--text-subtle)',
  not_assessed: 'var(--border-strong)',
};

/** Executive summary of recorded portfolio facts. Readiness is shown only as explicit human assessments. */
export function PortfolioHealth({ ws, summary }: { ws: ClientWorkspace; summary: PortfolioSummary }) {
  if (summary.total === 0) {
    return <EmptyState compact title="No projects recorded yet">Projects can be added or imported in the Portfolio Readiness module (Stage 2).</EmptyState>;
  }
  const projects = active(ws.projects).filter((p) => p.categoryId !== 'archived');
  const readinessCounts = READINESS_ORDER.map((s) => ({ s, n: projects.filter((p) => p.overallReadiness.status === s).length })).filter((r) => r.n > 0);
  const cats = summary.byCategory.filter((c) => c.count > 0);
  const hasSample = projects.some((p) => p.isSample);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-xs font-medium text-muted">By portfolio category</p>
        <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={cats.map((c) => `${c.label}: ${c.count}`).join(', ')}>
          {cats.map((c, i) => (
            <span key={c.categoryId} style={{ flexGrow: c.count, background: CATEGORY_SHADES[i % CATEGORY_SHADES.length] }} />
          ))}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          {cats.map((c, i) => (
            <li key={c.categoryId} className="flex items-center gap-2 text-sm">
              <span className="size-2.5 rounded-sm" style={{ background: CATEGORY_SHADES[i % CATEGORY_SHADES.length] }} aria-hidden />
              <span className="text-muted">{c.label}</span>
              <span className="tabular font-semibold">{c.count}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-muted">Overall readiness (explicit assessments)</p>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {readinessCounts.map(({ s, n }) => (
            <li key={s} className="rounded-lg border border-line bg-surface-2 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <span className="size-2 rounded-full" style={{ background: READINESS_COLOR[s] }} aria-hidden />
                {READINESS_LABELS[s]}
              </p>
              <p className="tabular mt-1 text-xl font-semibold">{n}</p>
            </li>
          ))}
        </ul>
      </div>

      <p className="flex items-start gap-2 text-xs text-subtle">
        <Info size={13} className="mt-px shrink-0" aria-hidden />
        <span>
          No scores are calculated. Readiness reflects assessments recorded by accountable leaders; unassessed projects are shown as Not Assessed.
          {hasSample && ' Projects in this demonstration are fictional samples.'}
        </span>
      </p>
    </div>
  );
}
