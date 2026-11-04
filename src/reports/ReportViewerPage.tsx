import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Archive, ArchiveRestore, ChevronLeft, Download, ExternalLink, Loader2, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { FieldError, TextField } from '@/components/form/fields';
import type { ReportRecord } from '@/domain/types';
import { formatDateTime } from '@/lib/format';
import { currentUserName, run } from '@/state/actions';
import { toast } from '@/state/toast';
import { useRequiredWorkspace } from '@/state/useWorkspace';
import { REPORT_TITLES } from './builders';
import { downloadReportPdf, openReportPdf } from './pdf';
import { ReportPreview } from './ReportPreview';
import { approveReport, CLIENT_RELEASE_CHECKS, createReport, deleteReport, recordExport, setReportArchived } from './reportMutations';
import { REPORT_STATUS } from './ReportsPage';

export function ReportViewerPage() {
  const ws = useRequiredWorkspace();
  const { reportId } = useParams();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<'download' | 'open' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const r = ws.reports.find((x) => x.id === reportId);
  if (!r) {
    return (
      <Card>
        <EmptyState title="Report not found in this workspace" action={<Link to={`/c/${ws.client.id}/reports`} className="font-bold text-accent hover:underline">Back to reports</Link>} />
      </Card>
    );
  }
  const isClient = r.kind === 'client_alignment';
  const draft = isClient && r.status !== 'approved';

  const exportPdf = async (mode: 'download' | 'open') => {
    const res = run((d) => recordExport(d, r.id, draft), { clientId: ws.client.id, entity: 'report', entityId: r.id, summary: `Exported ${draft ? 'draft of ' : ''}"${r.title}" v${r.version}` }, false);
    if (!res.ok) return;
    setBusy(mode);
    try {
      if (mode === 'download') await downloadReportPdf(r.content, { draft });
      else await openReportPdf(r.content, { draft });
      toast(draft ? 'Draft PDF created (watermarked, not for distribution).' : 'PDF created.');
    } catch (e) {
      toast(`PDF could not be created: ${e instanceof Error ? e.message : String(e)}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  const regenerate = () => {
    let id = '';
    const res = run((d) => void (id = createReport(d, { clientId: ws.client.id, kind: r.kind, params: r.parameters, preparedBy: currentUserName() }).id), { clientId: ws.client.id, entity: 'report', entityId: null, summary: `Regenerated ${REPORT_TITLES[r.kind]}` });
    if (res.ok) navigate(`/c/${ws.client.id}/reports/${id}`);
  };

  return (
    <>
      <Link to={`/c/${ws.client.id}/reports`} className="-ml-2 mb-4 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm text-muted hover:text-ink">
        <ChevronLeft size={16} aria-hidden /> Reports
      </Link>
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="eyebrow">Version {r.version}</p>
            <Badge tone={REPORT_STATUS[r.status].tone}>{REPORT_STATUS[r.status].label}</Badge>
            {r.archivedAt && <Badge tone="outline">Archived</Badge>}
          </div>
          <h1 className="text-2xl font-black tracking-tight text-balance md:text-[30px]">{r.title}</h1>
          <p className="mt-2 text-sm text-muted">Generated {formatDateTime(r.generatedAt)} by {r.preparedBy}. Content is frozen; regenerate to reflect newer records.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={draft ? 'secondary' : 'primary'} icon={busy === 'download' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} disabled={!!busy} onClick={() => void exportPdf('download')}>
            {draft ? 'Download draft PDF' : 'Download PDF'}
          </Button>
          <Button icon={busy === 'open' ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />} disabled={!!busy} onClick={() => void exportPdf('open')}>Open PDF</Button>
          <Button variant="ghost" icon={<RefreshCw size={16} />} onClick={regenerate}>New version</Button>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 rounded-xl bg-surface-3 p-2 sm:p-6">
          <ReportPreview doc={r.content} draft={draft} />
        </div>
        <aside className="flex flex-col gap-4">
          {isClient && <ReleasePanel record={r} clientId={ws.client.id} />}
          <Card className="p-5">
            <p className="font-black tracking-tight">Export history</p>
            {r.exports.length === 0 ? (
              <p className="mt-2 text-sm text-subtle">Not exported yet.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                {[...r.exports].reverse().map((e, i) => <li key={i} className="flex justify-between gap-2"><span>{formatDateTime(e.at)}</span><span className="text-subtle">{e.draft ? 'Draft' : 'Release'}</span></li>)}
              </ul>
            )}
            <p className="mt-3 text-xs text-subtle">Downloads go to this device. Distribution through Microsoft 365 is planned for production.</p>
          </Card>
          <Card className="flex flex-wrap gap-2 p-4">
            <Button size="sm" variant="ghost" icon={r.archivedAt ? <ArchiveRestore size={15} /> : <Archive size={15} />} onClick={() => run((d) => setReportArchived(d, r.id, !r.archivedAt), { clientId: ws.client.id, entity: 'report', entityId: r.id, summary: `${r.archivedAt ? 'Restored' : 'Archived'} report "${r.title}"` })}>
              {r.archivedAt ? 'Restore' : 'Archive'}
            </Button>
            <Button size="sm" variant="ghost" icon={<Trash2 size={15} />} onClick={() => setConfirmDelete(true)}>Delete</Button>
          </Card>
        </aside>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this report?"
        confirmLabel="Delete report"
        tone="danger"
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          const res = run((d) => deleteReport(d, r.id), { clientId: ws.client.id, entity: 'report', entityId: r.id, summary: `Deleted report "${r.title}"` });
          if (res.ok) navigate(`/c/${ws.client.id}/reports`);
          setConfirmDelete(false);
        }}
        blockedReason={r.status === 'approved' ? 'Approved client reports are kept as a record of what was released. Archive it instead.' : undefined}
      >
        The report record and its export history are removed. Underlying records are not affected.
      </ConfirmDialog>
    </>
  );
}

function ReleasePanel({ record: r, clientId }: { record: ReportRecord; clientId: string }) {
  const [checks, setChecks] = useState<string[]>([]);
  const [approver, setApprover] = useState(currentUserName());
  const [error, setError] = useState('');
  const approved = r.status === 'approved';
  return (
    <Card className="p-5">
      <p className="flex items-center gap-2 font-black tracking-tight"><ShieldCheck size={18} className="text-accent" aria-hidden /> Client release</p>
      <ul className="mt-3 flex flex-col gap-2 text-sm text-muted">
        {r.content.reviewNotes.map((n, i) => <li key={i} className="border-l-2 border-line-strong pl-3">{n}</li>)}
      </ul>
      {approved ? (
        <p className="mt-4 rounded-lg bg-surface-2 p-3 text-sm">
          Approved for release by <strong>{r.approval!.approvedBy}</strong> on {formatDateTime(r.approval!.approvedAt)}. The approved content is frozen; changes require a new version and a new approval.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm">Review the preview, then confirm each item to approve this version for client release. Until then, exports are watermarked drafts.</p>
          {CLIENT_RELEASE_CHECKS.map((c) => (
            <label key={c} className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
              <input type="checkbox" checked={checks.includes(c)} onChange={(e) => setChecks(e.target.checked ? [...checks, c] : checks.filter((x) => x !== c))} className="mt-0.5 size-5 shrink-0 accent-[var(--brand)]" />
              <span>{c}</span>
            </label>
          ))}
          <TextField label="Approved by" required value={approver} onChange={setApprover} />
          {error && <FieldError>{error}</FieldError>}
          <Button
            variant="primary"
            icon={<ShieldCheck size={16} />}
            disabled={checks.length < CLIENT_RELEASE_CHECKS.length || !approver.trim()}
            onClick={() => {
              const res = run((d) => approveReport(d, r.id, { approvedBy: approver, checks }), { clientId, entity: 'report', entityId: r.id, summary: `Approved "${r.title}" v${r.version} for client release` });
              if (!res.ok) setError(res.error ?? '');
            }}
          >
            Approve for release
          </Button>
        </div>
      )}
    </Card>
  );
}
