import { useMemo, useState } from 'react';
import { Building2, ImageOff } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { StageNotice } from '@/components/ui/StageNotice';
import { Badge } from '@/components/ui/Badge';
import { ReadinessBadge, SampleBadge } from '@/components/status';
import { active, categoryLabel, personName, upcomingMilestones, type ClientWorkspace } from '@/data/repository';
import type { Project } from '@/domain/types';
import { cn } from '@/lib/cn';
import { formatCurrency, formatDate, formatPercent, TBC } from '@/lib/format';
import { useRequiredWorkspace } from '@/state/useWorkspace';

export function PortfolioPage() {
  const ws = useRequiredWorkspace();
  const [category, setCategory] = useState<string>('all');
  const cats = [...ws.client.config.portfolioCategories].sort((a, b) => a.order - b.order);
  const projects = active(ws.projects);
  const shown = useMemo(
    () => projects.filter((p) => (category === 'all' ? p.categoryId !== 'archived' : p.categoryId === category)),
    [projects, category],
  );

  return (
    <>
      <PageHeader eyebrow={ws.client.name} title="Portfolio Readiness" description="One project collection, organized by lifecycle category. Readiness is an explicit assessment — never a computed score." />
      <StageNotice stage={2} className="mb-6">
        Project detail pages, create/edit/archive, image galleries, table view, JSON and Excel/CSV import with preview and duplicate handling.
      </StageNotice>

      <div role="tablist" aria-label="Portfolio category" className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {[{ id: 'all', label: 'All current' }, ...cats].map((c) => {
          const count = c.id === 'all' ? projects.filter((p) => p.categoryId !== 'archived').length : projects.filter((p) => p.categoryId === c.id).length;
          return (
            <button
              key={c.id}
              role="tab"
              type="button"
              aria-selected={category === c.id}
              onClick={() => setCategory(c.id)}
              className={cn(
                'inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm transition-colors',
                category === c.id ? 'border-accent bg-accent-soft text-ink' : 'border-line text-muted hover:border-line-strong hover:text-ink',
              )}
            >
              {c.label}
              <span className="tabular text-xs text-subtle">{count}</span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <Card>
          <EmptyState icon={<Building2 size={18} />} title={projects.length ? 'No projects in this category' : 'No projects recorded yet'}>
            {projects.length ? 'Choose another category.' : 'Projects can be created or imported in Stage 2.'}
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((p) => (
            <ProjectCard key={p.id} ws={ws} project={p} />
          ))}
        </div>
      )}
    </>
  );
}

function ProjectCard({ ws, project: p }: { ws: ClientWorkspace; project: Project }) {
  const principal = personName(ws, p.businessDevelopment.relationshipPrincipalId) ?? p.businessDevelopment.relationshipPrincipalRaw;
  const milestone = upcomingMilestones(ws).find((m) => m.projectId === p.id);
  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="relative flex aspect-[16/9] items-center justify-center border-b border-line bg-[repeating-linear-gradient(135deg,var(--surface-2)_0_12px,var(--surface-3)_12px_13px)]">
        <span className="flex flex-col items-center gap-1.5 text-xs text-subtle">
          <ImageOff size={20} aria-hidden />
          No project image
        </span>
        <div className="absolute left-3 top-3 flex gap-1.5">
          <Badge tone="neutral" className="bg-bg/80 backdrop-blur">{categoryLabel(ws, p)}</Badge>
          {p.isSample && <SampleBadge />}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="tabular text-xs text-subtle">{p.projectNumber ?? 'No project number'}</p>
        <h3 className="mt-1 font-semibold leading-snug">{p.name}</h3>
        <dl className="mb-4 mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-xs text-subtle">Principal</dt>
            <dd className={principal ? '' : 'text-subtle'}>{principal ?? TBC}</dd>
          </div>
          <div>
            <dt className="text-xs text-subtle">BSA fee</dt>
            <dd className={`tabular ${p.businessDevelopment.bsaFee === null ? 'text-subtle' : ''}`}>{formatCurrency(p.businessDevelopment.bsaFee)}</dd>
          </div>
          <div>
            <dt className="text-xs text-subtle">Probability</dt>
            <dd className={`tabular ${p.businessDevelopment.pipelineProbability === null ? 'text-subtle' : ''}`}>{formatPercent(p.businessDevelopment.pipelineProbability)}</dd>
          </div>
          <div>
            <dt className="text-xs text-subtle">Next milestone</dt>
            <dd className={milestone ? '' : 'text-subtle'}>{milestone ? `${milestone.title} · ${milestone.date ? formatDate(milestone.date) : milestone.timingNote || TBC}` : TBC}</dd>
          </div>
        </dl>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3">
          <span className="text-xs text-subtle">Overall readiness</span>
          <ReadinessBadge status={p.overallReadiness.status} />
        </div>
      </div>
    </Card>
  );
}
