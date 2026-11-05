import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BarChart3, ChevronRight, FileText, Handshake, UserCheck } from 'lucide-react';
import { Badge, type Tone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { ConfidentialityBadge } from '@/components/status';
import type { ReportKind, ReportStatus } from '@/domain/types';
import { formatDateTime } from '@/lib/format';
import { useRequiredWorkspace } from '@/state/useWorkspace';
import { REPORT_TITLES } from './builders';
import { ReportSetupSheet } from './ReportSetupSheet';

export const REPORT_STATUS: Record<ReportStatus, { label: string; tone: Tone }> = {
  final: { label: 'Generated', tone: 'neutral' },
  draft: { label: 'Draft — needs approval', tone: 'caution' },
  approved: { label: 'Approved for release', tone: 'positive' },
};

const TYPES: { kind: ReportKind; icon: typeof FileText; body: string }[] = [
  { kind: 'internal_team', icon: FileText, body: 'Executive summary, initiative updates, confirmed decisions, risks, new and outstanding actions, champions, milestones and next meeting.' },
  { kind: 'accountability_brief', icon: UserCheck, body: 'One person’s action plans, actions, due dates, dependencies, related projects and recent decisions affecting their work.' },
  { kind: 'client_alignment', icon: Handshake, body: 'External-facing. Only content approved for client release; proposed requests distinguished from confirmed commitments. Requires approval.' },
  { kind: 'portfolio_readiness', icon: BarChart3, body: 'Inventory, status, milestones, readiness assessments, resource gaps, open decisions, critical risks and recommended actions.' },
];

export function ReportsPage() {
  const ws = useRequiredWorkspace();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [setup, setSetup] = useState<{ kind: ReportKind; initial?: Record<string, string>; key: number } | null>(null);
  const [filter, setFilter] = useState<'' | ReportKind>('');
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    const kind = params.get('new') as ReportKind | null;
    if (kind && kind in REPORT_TITLES) {
      setSetup({ kind, initial: Object.fromEntries([...params.entries()].filter(([k]) => k !== 'new')), key: Date.now() });
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const history = ws.reports
    .filter((r) => (showArchived || !r.archivedAt) && (!filter || r.kind === filter))
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));

  return (
    <>
      <PageHeader eyebrow={ws.client.name} title="Reports" description="Reports are generated from the workspace’s current records and frozen when created, so what you preview is exactly what you export. Delivery is by download; automated email is not available." />

      <ul className="mb-10 grid gap-4 md:grid-cols-2">
        {TYPES.map(({ kind, icon: Icon, body }) => (
          <li key={kind}>
            <Card className="flex h-full flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-surface-3 text-accent"><Icon size={18} aria-hidden /></span>
                <ConfidentialityBadge level={kind === 'client_alignment' ? 'approved' : 'internal'} />
              </div>
              <h2 className="font-black tracking-tight">{REPORT_TITLES[kind]}</h2>
              <p className="text-sm text-muted">{body}</p>
              <Button className="mt-auto self-start" variant={kind === 'client_alignment' ? 'secondary' : 'primary'} onClick={() => setSetup({ kind, key: Date.now() })}>
                {kind === 'client_alignment' ? 'Create draft' : 'Create report'}
              </Button>
            </Card>
          </li>
        ))}
      </ul>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-black tracking-tight">Report history</h2>
        <span className="h-px flex-1 bg-line-strong" aria-hidden />
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Report type" className="h-11 rounded-lg border border-line bg-surface px-3 text-sm">
          <option value="">All report types</option>
          {TYPES.map((t) => <option key={t.kind} value={t.kind}>{REPORT_TITLES[t.kind]}</option>)}
        </select>
        <label className="flex h-11 items-center gap-2 rounded-lg border border-line px-3 text-sm text-muted">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="size-4 accent-[var(--accent)]" /> Archived
        </label>
      </div>
      {history.length === 0 ? (
        <Card><EmptyState compact title="No reports generated yet" className="py-8">Generated reports and their export history appear here.</EmptyState></Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {history.map((r) => (
              <li key={r.id}>
                <Link to={`/c/${ws.client.id}/reports/${r.id}`} className="flex min-h-16 flex-col gap-2 px-4 py-3.5 hover:bg-surface-2 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{r.title}</span>
                    <span className="block text-xs text-subtle">
                      Version {r.version} · {formatDateTime(r.generatedAt)} · Prepared by {r.preparedBy ?? 'Unknown'} · {r.exports.length} export{r.exports.length === 1 ? '' : 's'}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    {r.archivedAt && <Badge tone="outline">Archived</Badge>}
                    <Badge tone={REPORT_STATUS[r.status].tone}>{REPORT_STATUS[r.status].label}</Badge>
                    <ChevronRight size={16} className="text-subtle" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {setup && <ReportSetupSheet key={setup.key} ws={ws} kind={setup.kind} initial={setup.initial} onClose={() => setSetup(null)} onCreated={(id) => navigate(`/c/${ws.client.id}/reports/${id}`)} />}
    </>
  );
}
