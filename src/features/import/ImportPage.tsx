import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronLeft, FileSpreadsheet, FileUp, Info, ShieldAlert, TriangleAlert } from 'lucide-react';
import { Badge, type Tone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { FieldError } from '@/components/form/fields';
import { assignablePeople } from '@/data/repository';
import { cn } from '@/lib/cn';
import { formatBytes } from '@/lib/format';
import { currentUserName, run } from '@/state/actions';
import { useDataStore } from '@/state/store';
import { useRequiredWorkspace } from '@/state/useWorkspace';
import {
  allowedActions,
  autoMap,
  buildPreview,
  commitImport,
  FIELDS,
  findHeaderRow,
  isSeedJson,
  parseSeedJson,
  parseTable,
  type CommitResult,
  type ImportContext,
  type Mapping,
  type ParsedImport,
  type Preview,
  type PreviewRow,
  type RowAction,
  type SourceInfo,
} from './importModel';
import { parseCsv, parseXlsx, ParseError, type Sheet } from './parsers';

const MAX_FILE = 25 * 1024 * 1024;

type Step =
  | { kind: 'choose' }
  | { kind: 'map'; file: File; format: 'csv' | 'xlsx'; sheets: Sheet[]; sheetIndex: number; headerRow: number; mapping: Mapping; defaultCategory: string }
  | { kind: 'review'; preview: Preview; back: Step | null }
  | { kind: 'done'; result: CommitResult; source: SourceInfo };

export function ImportPage() {
  const ws = useRequiredWorkspace();
  const data = useDataStore((s) => s.data)!;
  const [step, setStep] = useState<Step>({ kind: 'choose' });
  const [error, setError] = useState('');
  const ctx: ImportContext = useMemo(() => ({ client: ws.client, people: assignablePeople(data, ws.client.id) }), [ws.client, data]);

  const onFile = async (file: File | undefined) => {
    setError('');
    if (!file) return;
    if (file.size > MAX_FILE) return setError(`"${file.name}" is ${formatBytes(file.size)}. The maximum is 25 MB.`);
    const ext = file.name.toLowerCase().split('.').pop();
    try {
      if (ext === 'json') {
        let json: unknown;
        try {
          json = JSON.parse(await file.text());
        } catch {
          return setError('This file is not valid JSON.');
        }
        if ((json as { format?: string })?.format === 'bsa-client-intelligence-backup') return setError('This is an application backup. Backups are restored from Administration (restore arrives in Stage 6), not imported as projects.');
        if (!isSeedJson(json)) return setError('This JSON file is not in the recognized portfolio format (expected "client", "source" and "projects"). Use Excel or CSV with column mapping for other structures.');
        const parsed = parseSeedJson(json, file.name, ctx);
        setStep({ kind: 'review', preview: buildPreview(parsed, data, ctx), back: null });
      } else if (ext === 'csv' || ext === 'txt') {
        const rows = parseCsv(await file.text());
        startMapping(file, 'csv', [{ name: file.name, rows }]);
      } else if (ext === 'xlsx' || ext === 'xlsm') {
        startMapping(file, 'xlsx', parseXlsx(await file.arrayBuffer()));
      } else if (ext === 'xls') {
        setError('Legacy .xls workbooks are not supported. Save the file as .xlsx or CSV and try again.');
      } else {
        setError('Choose a .json, .csv or .xlsx file.');
      }
    } catch (err) {
      setError(err instanceof ParseError ? err.message : `The file could not be read: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const startMapping = (file: File, format: 'csv' | 'xlsx', sheets: Sheet[]) => {
    const sheetIndex = Math.max(0, sheets.findIndex((s) => s.rows.length > 1));
    const headerRow = findHeaderRow(sheets[sheetIndex].rows);
    const headers = (sheets[sheetIndex].rows[headerRow] ?? []).map((h) => String(h ?? ''));
    setStep({ kind: 'map', file, format, sheets, sheetIndex, headerRow, mapping: autoMap(headers), defaultCategory: 'potential' });
  };

  return (
    <>
      <Link to={`/c/${ws.client.id}/portfolio`} className="-ml-2 mb-4 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm text-muted hover:text-ink">
        <ChevronLeft size={16} aria-hidden /> Portfolio
      </Link>
      <PageHeader eyebrow={ws.client.name} title="Import projects" description="Bring in project records from the portfolio seed JSON or an Excel/CSV export. Nothing is saved until you review and approve the changes." />

      <ol className="mb-6 flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label="Import steps">
        {['Choose file', 'Map columns (Excel/CSV)', 'Review & approve', 'Done'].map((label, i) => {
          const idx = { choose: 0, map: 1, review: 2, done: 3 }[step.kind];
          return (
            <li key={label} className={cn('flex items-center gap-2', i === idx ? 'font-bold text-ink' : i < idx ? 'text-muted' : 'text-subtle')} aria-current={i === idx ? 'step' : undefined}>
              <span className={cn('tabular flex size-7 items-center justify-center rounded-full border text-xs', i === idx ? 'border-ink bg-ink text-bg' : 'border-line-strong')}>{i + 1}</span>
              {label}
            </li>
          );
        })}
      </ol>

      {step.kind === 'choose' && <ChooseStep onFile={onFile} error={error} clientName={ws.client.name} />}
      {step.kind === 'map' && (
        <MapStep
          step={step}
          clientCategories={ws.client.config.portfolioCategories}
          onChange={setStep}
          onBack={() => setStep({ kind: 'choose' })}
          onContinue={() => {
            const sheet = step.sheets[step.sheetIndex];
            const source = { fileName: step.file.name, format: step.format, worksheet: step.format === 'xlsx' ? sheet.name : null, asOf: null, extractMethod: 'column mapping', clientName: null, clientCode: null } as const;
            const parsed: ParsedImport = parseTable(sheet.rows, step.headerRow, step.mapping, source, ctx, step.defaultCategory);
            setStep({ kind: 'review', preview: buildPreview(parsed, data, ctx), back: step });
          }}
        />
      )}
      {step.kind === 'review' && (
        <ReviewStep
          preview={step.preview}
          onChange={(preview) => setStep({ ...step, preview })}
          onBack={() => setStep(step.back ?? { kind: 'choose' })}
          onCommit={() => {
            let result: CommitResult | null = null;
            const r = run((d) => void (result = commitImport(d, step.preview, ws.client.id, currentUserName())), {
              clientId: ws.client.id,
              entity: 'import',
              entityId: null,
              summary: `Imported projects from ${step.preview.source.fileName}`,
            }, false);
            if (r.ok && result) setStep({ kind: 'done', result, source: step.preview.source });
          }}
        />
      )}
      {step.kind === 'done' && <DoneStep result={step.result} source={step.source} clientId={ws.client.id} onAgain={() => setStep({ kind: 'choose' })} />}
    </>
  );
}

/* ───────────────────────── Step 1 ───────────────────────── */

function ChooseStep({ onFile, error, clientName }: { onFile(f: File | undefined): void; error: string; clientName: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div>
        <button
          type="button"
          onClick={() => ref.current?.click()}
          onDragOver={(e) => (e.preventDefault(), setOver(true))}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            onFile(e.dataTransfer.files[0]);
          }}
          className={cn('flex min-h-56 w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-6 text-center transition-colors', over ? 'border-accent bg-accent-soft' : 'border-line-strong hover:bg-surface-2')}
        >
          <FileUp size={28} className="text-subtle" aria-hidden />
          <span className="font-bold">Choose a file or drop it here</span>
          <span className="text-sm text-subtle">Portfolio seed JSON (.json), Excel (.xlsx) or CSV (.csv) · up to 25 MB</span>
        </button>
        <input ref={ref} type="file" accept=".json,.csv,.xlsx,.xlsm,application/json,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => (onFile(e.target.files?.[0]), (e.target.value = ''))} />
        {error && <div className="mt-3"><FieldError>{error}</FieldError></div>}
      </div>
      <Card className="flex flex-col gap-3 p-5 text-sm">
        <p className="flex items-center gap-2 font-bold"><ShieldAlert size={16} className="text-caution" aria-hidden /> Before importing real data</p>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-muted">
          <li>Imported records are stored only in this browser. They are not uploaded, shared or synchronized.</li>
          <li>Import real {clientName} files only on an approved BSA device. The public demo site is for fictional data.</li>
          <li>Keep source files in the git-ignored <code className="text-ink">private-data/</code> folder — never in the repository.</li>
          <li>You will see every new record, match, update and conflict before anything is saved.</li>
        </ul>
      </Card>
    </div>
  );
}

/* ───────────────────────── Step 2 ───────────────────────── */

function MapStep({ step, clientCategories, onChange, onBack, onContinue }: { step: Extract<Step, { kind: 'map' }>; clientCategories: { id: string; label: string }[]; onChange(s: Step): void; onBack(): void; onContinue(): void }) {
  const sheet = step.sheets[step.sheetIndex];
  const headers = (sheet.rows[step.headerRow] ?? []).map((h) => String(h ?? ''));
  const samples = sheet.rows.slice(step.headerRow + 1, step.headerRow + 4);
  const mappedName = Object.values(step.mapping).includes('name');
  const used = new Set(Object.values(step.mapping).filter((v) => v && v !== 'revenuePeriods'));
  const remap = (sheetIndex: number, headerRow: number) => {
    const hs = (step.sheets[sheetIndex].rows[headerRow] ?? []).map((h) => String(h ?? ''));
    onChange({ ...step, sheetIndex, headerRow, mapping: autoMap(hs) });
  };

  return (
    <div className="flex flex-col gap-5">
      <Card className="grid gap-4 p-5 sm:grid-cols-3">
        <p className="flex items-center gap-2 text-sm sm:col-span-3"><FileSpreadsheet size={16} className="text-subtle" aria-hidden /> <span className="font-bold">{step.file.name}</span> <span className="text-subtle">· {sheet.rows.length} rows</span></p>
        {step.sheets.length > 1 && (
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-bold">Worksheet</span>
            <select value={step.sheetIndex} onChange={(e) => { const i = Number(e.target.value); remap(i, findHeaderRow(step.sheets[i].rows)); }} className="h-12 rounded-lg border border-line bg-surface px-3">
              {step.sheets.map((s, i) => <option key={i} value={i}>{s.name} ({s.rows.length} rows)</option>)}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-bold">Header row</span>
          <input type="number" min={1} max={sheet.rows.length} value={step.headerRow + 1} onChange={(e) => remap(step.sheetIndex, Math.max(0, Math.min(sheet.rows.length - 1, Number(e.target.value) - 1)))} className="tabular h-12 rounded-lg border border-line bg-surface px-3" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-bold">Category when not in file</span>
          <select value={step.defaultCategory} onChange={(e) => onChange({ ...step, defaultCategory: e.target.value })} className="h-12 rounded-lg border border-line bg-surface px-3">
            {clientCategories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-line-strong px-5 py-3">
          <p className="font-bold">Map columns to project fields</p>
          <p className="text-xs text-subtle">Columns were matched automatically by name where possible. Map several columns to “Revenue projection period” to import a projection in column order; period labels are not inferred. Values over 1 in percentage columns are read as percentages.</p>
        </div>
        <ul className="divide-y divide-line">
          {headers.map((h, i) => (
            <li key={i} className="grid gap-2 px-5 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_16rem] md:items-center">
              <p className="truncate text-sm font-bold">{h || <span className="text-subtle">Column {i + 1} (no header)</span>}</p>
              <p className="truncate text-xs text-subtle">{samples.map((r) => (r[i] === null || r[i] === undefined ? '—' : String(r[i]))).join(' · ') || '—'}</p>
              <select
                aria-label={`Map column ${h || i + 1}`}
                value={step.mapping[i] ?? ''}
                onChange={(e) => onChange({ ...step, mapping: { ...step.mapping, [i]: e.target.value as Mapping[number] } })}
                className={cn('h-11 rounded-lg border bg-surface px-3 text-sm', step.mapping[i] ? 'border-accent' : 'border-line text-subtle')}
              >
                <option value="">Ignore</option>
                {FIELDS.map((f) => (
                  <option key={f.key} value={f.key} disabled={f.key !== 'revenuePeriods' && used.has(f.key) && step.mapping[i] !== f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {!mappedName && <span className="mr-auto"><FieldError>Map a column to “Project name”.</FieldError></span>}
        <Button variant="ghost" onClick={onBack}>Back</Button>
        <Button variant="primary" disabled={!mappedName} onClick={onContinue}>Preview import</Button>
      </div>
    </div>
  );
}

/* ───────────────────────── Step 3 ───────────────────────── */

const STATUS: Record<PreviewRow['status'], { label: string; tone: Tone }> = {
  new: { label: 'New', tone: 'accent' },
  match: { label: 'Existing match', tone: 'neutral' },
  duplicate_in_file: { label: 'Duplicate in file', tone: 'negative' },
  invalid: { label: 'Invalid', tone: 'negative' },
};
const ACTION_LABEL: Record<RowAction, string> = { add: 'Add', update: 'Update', skip: 'Skip' };

function ReviewStep({ preview, onChange, onBack, onCommit }: { preview: Preview; onChange(p: Preview): void; onBack(): void; onCommit(): void }) {
  const [approved, setApproved] = useState(false);
  const fileBlocked = preview.fileIssues.some((i) => i.level === 'error');
  const rows = preview.rows;
  const counts = {
    new: rows.filter((r) => r.status === 'new').length,
    match: rows.filter((r) => r.status === 'match').length,
    updates: rows.filter((r) => r.changes.length).length,
    conflicts: rows.filter((r) => r.changes.some((c) => c.conflict)).length,
    missing: rows.filter((r) => r.missing.length).length,
    errors: rows.filter((r) => r.errors.length).length,
  };
  const toAdd = rows.filter((r) => r.action === 'add').length;
  const toUpdate = rows.filter((r) => r.action === 'update').length;
  const setAction = (i: number, action: RowAction) => {
    setApproved(false);
    onChange({ ...preview, rows: rows.map((r, j) => (j === i ? { ...r, action } : r)) });
  };
  const bulk = (fn: (r: PreviewRow) => RowAction) => {
    setApproved(false);
    onChange({ ...preview, rows: rows.map((r) => (allowedActions(r, fileBlocked).includes(fn(r)) ? { ...r, action: fn(r) } : r)) });
  };

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <p className="text-sm">
          <span className="font-bold">{preview.source.fileName}</span>
          <span className="text-subtle">
            {preview.source.worksheet && ` · worksheet ${preview.source.worksheet}`}
            {preview.source.asOf && ` · as of ${preview.source.asOf}`}
            {preview.source.clientName && ` · client ${preview.source.clientName}`}
          </span>
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {[
            ['New projects', counts.new],
            ['Existing matches', counts.match],
            ['With field updates', counts.updates],
            ['With conflicts', counts.conflicts],
            ['Missing key values', counts.missing],
            ['Validation errors', counts.errors],
          ].map(([l, n]) => (
            <div key={l as string} className="rounded-lg border border-line p-3">
              <dt className="text-xs text-subtle">{l}</dt>
              <dd className="tabular text-2xl font-black">{n}</dd>
            </div>
          ))}
        </dl>
        {preview.fileIssues.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2">
            {preview.fileIssues.map((i, k) => <IssueLine key={k} issue={i} />)}
          </ul>
        )}
      </Card>

      {!fileBlocked && rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-subtle">Bulk:</span>
          <Button size="sm" onClick={() => bulk((r) => (r.status === 'new' ? 'add' : r.action))}>Add all new</Button>
          <Button size="sm" onClick={() => bulk((r) => (r.status === 'match' && r.changes.length ? 'update' : r.action))}>Update all matches</Button>
          <Button size="sm" variant="ghost" onClick={() => bulk(() => 'skip')}>Skip all</Button>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {rows.map((r, i) => (
          <PreviewRowCard key={i} row={r} actions={allowedActions(r, fileBlocked)} onAction={(a) => setAction(i, a)} />
        ))}
      </ul>

      <Card className="flex flex-col gap-4 p-5">
        <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" checked={approved} disabled={fileBlocked || toAdd + toUpdate === 0} onChange={(e) => setApproved(e.target.checked)} className="mt-0.5 size-5 accent-[var(--brand)]" />
          <span>
            I have reviewed this preview and approve adding <strong>{toAdd}</strong> and updating <strong>{toUpdate}</strong> project record(s). Updates overwrite only the fields listed; blank source values never erase existing data.
          </span>
        </label>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onBack}>Back</Button>
          <Button variant="primary" disabled={!approved || fileBlocked || toAdd + toUpdate === 0} onClick={onCommit}>
            Import {toAdd + toUpdate} record(s)
          </Button>
        </div>
      </Card>
    </div>
  );
}

function IssueLine({ issue }: { issue: { level: 'error' | 'warning' | 'info'; message: string } }) {
  const Icon = issue.level === 'error' ? AlertCircle : issue.level === 'warning' ? TriangleAlert : Info;
  return (
    <li className="flex items-start gap-2 text-sm">
      <Icon size={15} className={cn('mt-0.5 shrink-0', issue.level === 'error' ? 'fill-brand text-white' : issue.level === 'warning' ? 'text-caution' : 'text-accent')} aria-hidden />
      <span><span className="sr-only">{issue.level}: </span>{issue.message}</span>
    </li>
  );
}

function PreviewRowCard({ row, actions, onAction }: { row: PreviewRow; actions: RowAction[]; onAction(a: RowAction): void }) {
  const [open, setOpen] = useState(row.errors.length > 0 || row.changes.some((c) => c.conflict));
  const v = row.candidate.values;
  const s = STATUS[row.status];
  return (
    <li className="rounded-xl border border-line bg-surface">
      <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex min-h-11 min-w-0 flex-1 items-start gap-3 text-left">
          <ChevronDown size={18} className={cn('mt-0.5 shrink-0 text-subtle transition-transform', open && 'rotate-180')} aria-hidden />
          <span className="min-w-0">
            <span className="block font-bold">{v.name || <span className="text-subtle">Unnamed record</span>}</span>
            <span className="tabular block text-xs text-subtle">{row.candidate.ref} · {v.projectNumber ?? 'No project number'}{row.existing && ` · matches “${row.existing.name}”`}</span>
          </span>
        </button>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <Badge tone={s.tone}>{s.label}</Badge>
          {row.changes.length > 0 && <Badge tone="outline">{row.changes.length} field change(s)</Badge>}
          {row.changes.some((c) => c.conflict) && <Badge tone="caution">Conflicts</Badge>}
          {row.warnings.length > 0 && <Badge tone="caution">{row.warnings.length} warning(s)</Badge>}
          <div role="radiogroup" aria-label={`Action for ${v.name ?? row.candidate.ref}`} className="flex rounded-lg border border-line p-0.5">
            {(['add', 'update', 'skip'] as RowAction[]).filter((a) => actions.includes(a)).map((a) => (
              <button key={a} type="button" role="radio" aria-checked={row.action === a} onClick={() => onAction(a)} className={cn('h-9 rounded-md px-3 text-sm pointer-coarse:h-10', row.action === a ? (a === 'skip' ? 'bg-surface-3 font-bold' : 'bg-ink font-bold text-bg') : 'text-subtle hover:text-ink')}>
                {ACTION_LABEL[a]}
              </button>
            ))}
          </div>
        </div>
      </div>
      {open && (
        <div className="grid gap-5 border-t border-line p-4 lg:grid-cols-2">
          {row.changes.length > 0 && (
            <div className="lg:col-span-2">
              <p className="eyebrow mb-2 text-ink">Fields to update</p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead><tr className="text-left text-xs text-subtle"><th className="py-1 font-normal">Field</th><th className="py-1 font-normal">Current</th><th className="py-1 font-normal">Incoming</th></tr></thead>
                  <tbody>
                    {row.changes.map((c) => (
                      <tr key={c.key} className="border-t border-line">
                        <td className="py-2 pr-3 font-bold">{c.label}{c.conflict && <span className="ml-2 text-xs font-normal text-caution">overwrites</span>}</td>
                        <td className="tabular py-2 pr-3 text-muted">{c.from}</td>
                        <td className="tabular py-2">{c.to}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {row.status === 'new' && <IncomingSummary row={row} />}
          {(row.errors.length > 0 || row.warnings.length > 0 || row.infos.length > 0 || row.missing.length > 0) && (
            <ul className="flex flex-col gap-2">
              {row.errors.map((i, k) => <IssueLine key={`e${k}`} issue={i} />)}
              {row.warnings.map((i, k) => <IssueLine key={`w${k}`} issue={i} />)}
              {row.missing.length > 0 && <IssueLine issue={{ level: 'info', message: `Missing values (will show as To Be Confirmed): ${row.missing.join(', ')}.` }} />}
              {row.infos.map((i, k) => <IssueLine key={`i${k}`} issue={i} />)}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function IncomingSummary({ row }: { row: PreviewRow }) {
  const v = row.candidate.values;
  const items: [string, string | null][] = [
    ['Studio', v.studio ?? null],
    ['Principal', v.principal ? v.principal.raw ?? null : null],
    ['BSA fee', v.bsaFee != null ? `$${v.bsaFee.toLocaleString()}` : null],
    ['Probability', v.pipelineProbability != null ? `${+(v.pipelineProbability * 100).toFixed(2)}%` : null],
    ['Fee mix (A/E/I)', [v.feeArchitecture, v.feeEngineering, v.feeInteriors].some((x) => x != null) ? [v.feeArchitecture, v.feeEngineering, v.feeInteriors].map((x) => (x == null ? '—' : `${+(x * 100).toFixed(2)}%`)).join(' / ') : null],
    ['Revenue periods', v.revenuePeriods ? `${v.revenuePeriods.length} (labels unresolved)` : null],
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
      {items.map(([l, val]) => (
        <div key={l}>
          <dt className="text-xs text-subtle">{l}</dt>
          <dd className={cn('tabular', !val && 'text-subtle')}>{val ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ───────────────────────── Step 4 ───────────────────────── */

function DoneStep({ result, source, clientId, onAgain }: { result: CommitResult; source: SourceInfo; clientId: string; onAgain(): void }) {
  return (
    <Card className="flex flex-col items-start gap-4 p-6">
      <CheckCircle2 size={28} className="text-positive" aria-hidden />
      <div>
        <h2 className="text-xl font-black tracking-tight">Import complete</h2>
        <p className="mt-1 text-sm text-muted">
          From {source.fileName}: {result.added.length} added, {result.updated.length} updated, {result.skipped} skipped. Provenance and history were recorded on each project.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link to={`/c/${clientId}/portfolio?sort=updated&dir=desc`} className="inline-flex h-11 items-center rounded-lg bg-brand px-4 text-sm font-bold text-brand-contrast hover:bg-brand-strong">View portfolio</Link>
        <Button onClick={onAgain}>Import another file</Button>
      </div>
    </Card>
  );
}
