import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Building2, Download, FileUp, LayoutGrid, Plus, Rows3, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { ReadinessBadge, SampleBadge } from '@/components/status';
import { categoryLabel, upcomingMilestones, type ClientWorkspace } from '@/data/repository';
import { READINESS_LABELS, type Project, type ReadinessStatus } from '@/domain/types';
import { cn } from '@/lib/cn';
import { formatCurrency, formatDate, formatPercent, TBC } from '@/lib/format';
import { useRequiredWorkspace } from '@/state/useWorkspace';
import { csvFilename, downloadCsv } from '@/services/csv';
import { ProjectCover } from './ProjectCover';
import { ProjectEditSheet } from './ProjectEditSheet';
import { EMPTY_FILTERS, filterOptions, filterProjects, matchesCategory, principalLabel, sortProjects, type PortfolioFilters, type SortKey, type SortState } from './projectFilters';

export function PortfolioPage() {
  const ws = useRequiredWorkspace();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    if (params.get('new') === '1') {
      setCreating(true);
      const n = new URLSearchParams(params);
      n.delete('new');
      setParams(n, { replace: true });
    }
  }, [params, setParams]);

  const filters: PortfolioFilters = { ...EMPTY_FILTERS, ...Object.fromEntries([...params.entries()].filter(([k]) => k in EMPTY_FILTERS)) } as PortfolioFilters;
  const view = params.get('view') === 'table' ? 'table' : 'cards';
  const sort: SortState = { key: (params.get('sort') as SortKey) || 'name', dir: params.get('dir') === 'desc' ? 'desc' : 'asc' };
  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (!v || v === (EMPTY_FILTERS as unknown as Record<string, string>)[k]) next.delete(k);
    else next.set(k, v);
    setParams(next, { replace: true });
  };

  const cats = [...ws.client.config.portfolioCategories].sort((a, b) => a.order - b.order);
  const all = ws.projects;
  const shown = useMemo(() => sortProjects(filterProjects(all, filters), sort, ws), [all, params, ws]); // eslint-disable-line react-hooks/exhaustive-deps
  const opts = useMemo(() => filterOptions(all, ws), [all, ws]);
  const activeFilterCount = (['studio', 'principal', 'type', 'readiness', 'startYear', 'q'] as const).filter((k) => filters[k]).length;
  const count = (c: string) => all.filter((p) => matchesCategory(p, c)).length;

  return (
    <>
      <PageHeader
        eyebrow={ws.client.name}
        title="Portfolio Readiness"
        description="One project collection organized by lifecycle category. Readiness is an explicit assessment by accountable leaders — never a computed score."
        actions={
          <>
            <Link to={`/c/${ws.client.id}/portfolio/import`} className="inline-flex h-11 items-center gap-2 rounded-lg border border-line bg-surface-2 px-4 text-sm hover:border-line-strong">
              <FileUp size={16} aria-hidden /> Import
            </Link>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>New project</Button>
          </>
        }
      />

      {/* Category tabs */}
      <div role="tablist" aria-label="Portfolio category" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {[{ id: 'current', label: 'All current' }, ...cats.filter((c) => c.id !== 'archived'), { id: 'archived', label: 'Archived' }, { id: 'all', label: 'Everything' }].map((c) => (
          <button
            key={c.id}
            role="tab"
            type="button"
            aria-selected={filters.category === c.id}
            onClick={() => setParam('category', c.id)}
            className={cn('inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm transition-colors', filters.category === c.id ? 'border-ink bg-ink font-bold text-bg' : 'border-line text-muted hover:border-line-strong hover:text-ink')}
          >
            {c.label}
            <span className={cn('tabular text-xs', filters.category === c.id ? 'text-bg/70' : 'text-subtle')}>{count(c.id)}</span>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="mb-5 flex flex-col gap-3">
        <div className="flex gap-2">
          <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3 focus-within:border-accent">
            <Search size={16} className="shrink-0 text-subtle" aria-hidden />
            <input value={filters.q} onChange={(e) => setParam('q', e.target.value)} placeholder="Search project name or number" aria-label="Search projects" className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-subtle sm:text-sm" />
          </label>
          <div role="group" aria-label="View" className="hidden rounded-lg border border-line p-0.5 md:flex">
            {[
              { v: 'cards', icon: LayoutGrid, l: 'Cards' },
              { v: 'table', icon: Rows3, l: 'Table' },
            ].map(({ v, icon: Icon, l }) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => setParam('view', v === 'cards' ? '' : v)} className={cn('inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm', view === v ? 'bg-surface-3 font-bold text-ink' : 'text-subtle hover:text-ink')}>
                <Icon size={16} aria-hidden /> {l}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          <FilterSelect label="Studio" value={filters.studio} onChange={(v) => setParam('studio', v)} options={opts.studios.map((s) => ({ value: s, label: s }))} />
          <FilterSelect label="Principal" value={filters.principal} onChange={(v) => setParam('principal', v)} options={opts.principals} />
          <FilterSelect label="Project type" value={filters.type} onChange={(v) => setParam('type', v)} options={opts.types.map((s) => ({ value: s, label: s }))} />
          <FilterSelect label="Readiness" value={filters.readiness} onChange={(v) => setParam('readiness', v)} options={(Object.keys(READINESS_LABELS) as ReadinessStatus[]).map((s) => ({ value: s, label: READINESS_LABELS[s] }))} />
          <FilterSelect label="Anticipated start" value={filters.startYear} onChange={(v) => setParam('startYear', v)} options={[...opts.years.map((y) => ({ value: y, label: y })), ...(opts.hasUndatedStart ? [{ value: 'none', label: 'Not yet dated' }] : [])]} />
          <select value={`${sort.key}:${sort.dir}`} onChange={(e) => { const [k, d] = e.target.value.split(':'); const n = new URLSearchParams(params); n.set('sort', k); n.set('dir', d); setParams(n, { replace: true }); }} aria-label="Sort by" className="h-11 rounded-lg border border-line bg-surface px-3 text-sm">
            <option value="name:asc">Sort: Name A–Z</option>
            <option value="number:asc">Sort: Project number</option>
            <option value="fee:desc">Sort: Fee (high–low)</option>
            <option value="probability:desc">Sort: Probability (high–low)</option>
            <option value="start:asc">Sort: Anticipated start</option>
            <option value="readiness:asc">Sort: Readiness</option>
            <option value="updated:desc">Sort: Recently updated</option>
          </select>
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            icon={<Download size={15} />}
            onClick={() =>
              downloadCsv(csvFilename(ws.client.name, 'Portfolio'), [
                ['Project number', 'Project name', 'Category', 'Studio', 'Type', 'Location', 'Relationship principal', 'BSA fee', 'Pipeline probability', 'Architecture %', 'Engineering %', 'Interiors %', 'Anticipated start', 'Anticipated completion', 'Overall readiness', 'Sample record', 'Archived'],
                ...shown.map((p) => [
                  p.projectNumber,
                  p.name,
                  categoryLabel(ws, p),
                  p.studio,
                  p.projectType,
                  p.location,
                  principalLabel(ws, p),
                  p.businessDevelopment.bsaFee,
                  p.businessDevelopment.pipelineProbability,
                  p.businessDevelopment.feeMix.architecture,
                  p.businessDevelopment.feeMix.engineering,
                  p.businessDevelopment.feeMix.interiors,
                  p.businessDevelopment.anticipatedStart,
                  p.businessDevelopment.anticipatedCompletion,
                  READINESS_LABELS[p.overallReadiness.status],
                  p.isSample ? 'Yes' : 'No',
                  p.archivedAt ? 'Yes' : 'No',
                ]),
              ])
            }
          >
            Export CSV ({shown.length})
          </Button>
        </div>
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-3 text-sm text-muted">
            <span>
              {shown.length} of {count(filters.category)} shown
            </span>
            <button type="button" onClick={() => setParams(new URLSearchParams(filters.category !== 'current' ? { category: filters.category } : {}), { replace: true })} className="inline-flex min-h-11 items-center gap-1 font-bold text-accent hover:underline">
              <X size={14} aria-hidden /> Clear filters
            </button>
          </div>
        )}
      </div>

      {shown.length === 0 ? (
        <Card>
          <EmptyState icon={<Building2 size={18} />} title={all.length ? 'No projects match' : 'No projects recorded yet'} action={!all.length ? <Button variant="primary" size="sm" onClick={() => setCreating(true)}>Create the first project</Button> : undefined}>
            {all.length ? 'Adjust the category or filters.' : 'Create projects manually or import them from a JSON or Excel/CSV file.'}
          </EmptyState>
        </Card>
      ) : view === 'table' ? (
        <>
          <div className="md:hidden">
            <CardGrid ws={ws} projects={shown} />
          </div>
          <div className="hidden md:block">
            <ProjectTable ws={ws} projects={shown} sort={sort} onSort={(key) => { const n = new URLSearchParams(params); n.set('sort', key); n.set('dir', sort.key === key && sort.dir === 'asc' ? 'desc' : 'asc'); setParams(n, { replace: true }); }} />
          </div>
        </>
      ) : (
        <CardGrid ws={ws} projects={shown} />
      )}

      {creating && <ProjectEditSheet ws={ws} open projectId={null} onClose={() => setCreating(false)} onSaved={(id) => navigate(`/c/${ws.client.id}/portfolio/${id}`)} />}
    </>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange(v: string): void; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className={cn('h-11 min-w-0 rounded-lg border bg-surface px-3 text-sm', value ? 'border-accent text-ink' : 'border-line text-muted')}>
      <option value="">{label}: All</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function CardGrid({ ws, projects }: { ws: ClientWorkspace; projects: Project[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((p) => (
        <li key={p.id}>
          <ProjectCard ws={ws} project={p} />
        </li>
      ))}
    </ul>
  );
}

function nextMilestone(ws: ClientWorkspace, p: Project) {
  const m = upcomingMilestones(ws).find((x) => x.projectId === p.id);
  return m ? `${m.title} · ${m.date ? formatDate(m.date) : m.timingNote || TBC}` : null;
}

function ProjectCard({ ws, project: p }: { ws: ClientWorkspace; project: Project }) {
  const principal = principalLabel(ws, p);
  const milestone = nextMilestone(ws, p);
  return (
    <Link to={`/c/${ws.client.id}/portfolio/${p.id}`} className="group flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-line-strong">
      <div className="relative aspect-[16/9] border-b border-line">
        <ProjectCover mediaId={p.coverImageId} alt={p.name} />
        <div className="absolute left-3 top-3 flex gap-1.5">
          <Badge tone="overlay">{categoryLabel(ws, p)}</Badge>
          {p.isSample && <SampleBadge />}
          {p.archivedAt && <Badge tone="overlay">Archived</Badge>}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="tabular text-xs text-subtle">{p.projectNumber ?? 'No project number'}</p>
        <h2 className="mt-1 font-black leading-snug tracking-tight group-hover:underline">{p.name}</h2>
        <dl className="my-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Fact label="Principal" value={principal} />
          <Fact label="BSA fee" value={p.businessDevelopment.bsaFee === null ? null : formatCurrency(p.businessDevelopment.bsaFee)} tabular />
          <Fact label="Probability" value={p.businessDevelopment.pipelineProbability === null ? null : formatPercent(p.businessDevelopment.pipelineProbability)} tabular />
          <Fact label="Next milestone" value={milestone} />
        </dl>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3">
          <span className="text-xs text-subtle">Overall readiness</span>
          <ReadinessBadge status={p.overallReadiness.status} />
        </div>
      </div>
    </Link>
  );
}

function Fact({ label, value, tabular }: { label: string; value: string | null; tabular?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className={cn('truncate', tabular && 'tabular', !value && 'text-subtle')}>{value ?? TBC}</dd>
    </div>
  );
}

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: 'name', label: 'Project' },
  { key: 'category', label: 'Category' },
  { key: 'principal', label: 'Principal' },
  { key: 'fee', label: 'BSA fee', className: 'text-right' },
  { key: 'probability', label: 'Prob.', className: 'text-right' },
  { key: 'start', label: 'Start' },
  { key: 'readiness', label: 'Readiness' },
];

function ProjectTable({ ws, projects, sort, onSort }: { ws: ClientWorkspace; projects: Project[]; sort: SortState; onSort(k: SortKey): void }) {
  const navigate = useNavigate();
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="border-b border-line-strong text-left">
            <th scope="col" className="w-14 py-3 pl-4"><span className="sr-only">Image</span></th>
            {COLUMNS.map((c) => (
              <th key={c.key} scope="col" aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={cn('px-3 py-1 font-normal', c.className)}>
                <button type="button" onClick={() => onSort(c.key)} className={cn('inline-flex min-h-11 items-center gap-1 text-[11px] uppercase tracking-[0.12em] hover:text-ink', sort.key === c.key ? 'font-bold text-ink' : 'text-subtle')}>
                  {c.label}
                  {sort.key === c.key && (sort.dir === 'asc' ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => {
            const principal = principalLabel(ws, p);
            return (
              <tr key={p.id} onClick={() => navigate(`/c/${ws.client.id}/portfolio/${p.id}`)} className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2">
                <td className="py-2 pl-4">
                  <div className="size-10 overflow-hidden rounded-full">
                    <ProjectCover mediaId={p.coverImageId} alt="" compact />
                  </div>
                </td>
                <td className="max-w-[22rem] px-3 py-3">
                  <Link to={`/c/${ws.client.id}/portfolio/${p.id}`} onClick={(e) => e.stopPropagation()} className="font-bold hover:underline">{p.name}</Link>
                  <p className="tabular text-xs text-subtle">
                    {p.projectNumber ?? 'No number'}
                    {p.isSample && ' · Sample'}
                    {p.archivedAt && ' · Archived'}
                  </p>
                </td>
                <td className="px-3">{categoryLabel(ws, p)}</td>
                <td className={cn('px-3', !principal && 'text-subtle')}>{principal ?? TBC}</td>
                <td className={cn('tabular px-3 text-right', p.businessDevelopment.bsaFee === null && 'text-subtle')}>{formatCurrency(p.businessDevelopment.bsaFee)}</td>
                <td className={cn('tabular px-3 text-right', p.businessDevelopment.pipelineProbability === null && 'text-subtle')}>{formatPercent(p.businessDevelopment.pipelineProbability, '—')}</td>
                <td className={cn('tabular px-3', !p.businessDevelopment.anticipatedStart && 'text-subtle')}>{formatDate(p.businessDevelopment.anticipatedStart, '—')}</td>
                <td className="px-3"><ReadinessBadge status={p.overallReadiness.status} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
