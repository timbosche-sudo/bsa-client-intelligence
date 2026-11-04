import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Download, FileUp, Info, Loader2, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { mediaStore } from '@/data/media/MediaStore';
import { exportFullBackup } from '@/services/exportBackup';
import { parseBackup, restoreMedia, restorePreview, type ParsedBackup } from '@/services/restore';
import { formatDateTime } from '@/lib/format';
import { useDataStore } from '@/state/store';
import { toast } from '@/state/toast';

const COLS = ['people', 'projects', 'actions', 'decisions', 'meetings', 'reports'] as const;

export function RestoreDialog({ onClose }: { onClose(): void }) {
  const current = useDataStore((s) => s.data)!;
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [backup, setBackup] = useState<ParsedBackup | null>(null);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setFileName(f.name);
    setBackup(null);
    setAck(false);
    const r = parseBackup(await f.text());
    if (r.ok) {
      setErrors([]);
      setBackup(r.backup);
    } else setErrors(r.errors);
    if (fileRef.current) fileRef.current.value = '';
  };

  const restore = async () => {
    if (!backup) return;
    setBusy(true);
    try {
      // Images first: if writing fails, existing records are untouched.
      const media = await restoreMedia(mediaStore(), backup);
      await useDataStore.getState().replaceData(backup.data);
      toast(`Backup restored: ${backup.data.clients.length} client workspace(s), ${media.written} image(s).`);
      onClose();
      navigate('/');
    } catch (e) {
      toast(`Restore failed: ${e instanceof Error ? e.message : String(e)}. Your current data was not replaced.`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const preview = backup ? restorePreview(current, backup.data) : [];

  return (
    <Dialog
      open
      onClose={onClose}
      title="Restore from backup"
      description="Replaces all client workspaces and images in this browser with the contents of a backup file."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="danger" icon={busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} disabled={!backup || !ack || busy} onClick={() => void restore()}>
            Replace all data
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button icon={<FileUp size={16} />} onClick={() => fileRef.current?.click()}>{fileName ? 'Choose another file' : 'Choose backup file'}</Button>
          {fileName && <span className="text-sm text-muted">{fileName}</span>}
          <input ref={fileRef} type="file" accept=".json,application/json" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void onFile(e.target.files?.[0])} />
        </div>

        {errors.length > 0 && (
          <ul role="alert" className="flex flex-col gap-1.5 border-l-2 border-brand bg-surface-2 px-4 py-3 text-sm">
            {errors.map((e, i) => <li key={i} className="flex gap-2"><AlertCircle size={15} className="mt-0.5 shrink-0 fill-brand text-white" aria-hidden />{e}</li>)}
          </ul>
        )}

        {backup && (
          <>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><dt className="text-xs text-subtle">Exported</dt><dd>{backup.meta.exportedAt ? formatDateTime(backup.meta.exportedAt) : 'Unknown'}</dd></div>
              <div><dt className="text-xs text-subtle">App version</dt><dd>{backup.meta.appVersion ?? 'Unknown'}</dd></div>
              <div><dt className="text-xs text-subtle">Schema</dt><dd>v{backup.meta.schemaVersion}{backup.meta.schemaVersion !== backup.data.schemaVersion ? ` → v${backup.data.schemaVersion}` : ''}</dd></div>
              <div><dt className="text-xs text-subtle">Images</dt><dd>{backup.mediaFiles.length} embedded</dd></div>
            </dl>
            {backup.warnings.length > 0 && (
              <ul className="flex flex-col gap-1.5 text-sm text-muted">
                {backup.warnings.map((w, i) => <li key={i} className="flex gap-2"><Info size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden />{w}</li>)}
              </ul>
            )}
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-subtle">
                    <th className="px-3 py-2 font-normal">Client</th>
                    <th className="px-3 py-2 font-normal">Change</th>
                    {COLS.map((c) => <th key={c} className="px-2 py-2 text-right font-normal">{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r) => (
                    <tr key={r.clientId} className="border-t border-line">
                      <td className="px-3 py-2 font-bold">{r.name}</td>
                      <td className="px-3 py-2"><Badge tone={r.change === 'removed' ? 'negative' : r.change === 'added' ? 'accent' : 'neutral'}>{r.change === 'removed' ? 'Removed' : r.change === 'added' ? 'Added' : 'Replaced'}</Badge></td>
                      {COLS.map((c) => (
                        <td key={c} className="tabular px-2 py-2 text-right">
                          {r.current?.[c] ?? '—'} → <strong>{r.incoming?.[c] ?? '—'}</strong>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-subtle">Counts show current → after restore.</p>
            <div className="flex flex-col gap-3 rounded-lg border border-line-strong bg-surface-2 p-4">
              <Button size="sm" className="self-start" icon={<Download size={15} />} onClick={() => void exportFullBackup()}>Export current data first</Button>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
                <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 size-5 accent-[var(--brand)]" />
                <span>I understand this permanently replaces <strong>all</strong> data and images in this browser with this backup.</span>
              </label>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
