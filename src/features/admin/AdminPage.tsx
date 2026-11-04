import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, Database, Download, Eraser, History, ListChecks, ListOrdered, Pencil, SlidersHorizontal, Plus, RotateCcw, ShieldAlert, Sparkles, Upload } from 'lucide-react';
import { z } from 'zod';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { environment } from '@/config/environment';
import { CLIENT_STATUS_LABELS } from '@/domain/labels';
import { listClients } from '@/data/repository';
import { Monogram } from '@/layout/ClientSelector';
import { exportFullBackup } from '@/services/exportBackup';
import { formatBytes, formatDateTime } from '@/lib/format';
import { useDataStore } from '@/state/store';
import { useRequiredWorkspace } from '@/state/useWorkspace';
import { mediaStore } from '@/data/media/MediaStore';
import { orphanMediaIds } from '@/data/mutations';
import { toast } from '@/state/toast';
import { FieldError } from '@/components/form/fields';
import { CategoriesSheet } from './CategoriesSheet';
import { ChecklistTemplatesSheet } from './ChecklistTemplatesSheet';
import { RestoreDialog } from './RestoreDialog';
import { ClientProfileSheet } from './ClientProfileSheet';
import { ReadinessDimensionsSheet } from './ReadinessDimensionsSheet';
import { removeSampleData, sampleDataSummary, type SampleDataSummary } from '@/data/adminMutations';
import { run } from '@/state/actions';

const clientSchema = z.object({
  name: z.string().trim().min(2, 'Enter the client name (at least 2 characters).').max(120),
  shortName: z.string().trim().max(60).optional(),
  monogram: z
    .string()
    .trim()
    .max(3, 'Use up to 3 characters.')
    .regex(/^[A-Za-z0-9]*$/, 'Letters and numbers only.')
    .optional(),
  sector: z.string().trim().max(120).optional(),
});

export function AdminPage() {
  const ws = useRequiredWorkspace();
  const data = useDataStore((s) => s.data)!;
  const { adapter, lastSavedAt, resetToDemo } = useDataStore();
  const [params, setParams] = useSearchParams();
  const [formOpen, setFormOpen] = useState(params.get('newClient') === '1');
  const [resetOpen, setResetOpen] = useState(false);
  const [usage, setUsage] = useState<number | null>(null);
  const [media, setMedia] = useState<{ count: number; orphans: string[]; quota: number | null; used: number | null } | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [profile, setProfile] = useState<string | null>(null);
  const [dimsOpen, setDimsOpen] = useState(false);
  const [sampleOpen, setSampleOpen] = useState(false);
  const samples = sampleDataSummary(data);
  const clients = listClients(data, { includeArchived: true });

  useEffect(() => {
    if (params.get('newClient') === '1') {
      setFormOpen(true);
      params.delete('newClient');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  useEffect(() => {
    void adapter?.usage().then(setUsage);
  }, [adapter, data]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const keys = await mediaStore().keys().catch(() => [] as string[]);
      const est = await navigator.storage?.estimate?.().catch(() => null);
      if (alive) setMedia({ count: keys.length, orphans: orphanMediaIds(data, keys), quota: est?.quota ?? null, used: est?.usage ?? null });
    })();
    return () => {
      alive = false;
    };
  }, [data]);

  const cleanOrphans = async () => {
    if (!media?.orphans.length) return;
    await Promise.all(media.orphans.map((id) => mediaStore().delete(id).catch(() => undefined)));
    toast(`Removed ${media.orphans.length} unreferenced image(s) from browser storage.`);
    setMedia({ ...media, count: media.count - media.orphans.length, orphans: [] });
  };

  const resetAll = async () => {
    const keys = await mediaStore().keys().catch(() => [] as string[]);
    await Promise.all(keys.map((k) => mediaStore().delete(k).catch(() => undefined)));
    await resetToDemo();
    setResetOpen(false);
    toast('All data in this browser was replaced with the demonstration data.');
  };

  const exportBackup = exportFullBackup;

  const removeSamples = () => {
    let purge: string[] = [];
    const r = run(
      (d) => void (purge = removeSampleData(d)),
      { clientId: null, entity: 'project', entityId: null, summary: `Removed ${samples.projects} sample project${samples.projects === 1 ? '' : 's'}` },
    );
    if (r.ok) purge.forEach((id) => void mediaStore().delete(id).catch(() => undefined));
    setSampleOpen(false);
  };

  return (
    <>
      <PageHeader eyebrow="Platform" title="Administration" description="Client workspaces, data backup and environment status." />

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="Client workspaces"
          icon={<Building2 size={18} />}
          actions={
            <Button size="sm" variant="primary" icon={<Plus size={15} aria-hidden />} onClick={() => setFormOpen((o) => !o)}>
              Add client
            </Button>
          }
          className="xl:col-span-2"
        >
          {formOpen && <NewClientForm onDone={() => setFormOpen(false)} />}
          <ul className="flex flex-col divide-y divide-line">
            {clients.map((c) => {
              const projects = data.projects.filter((p) => p.clientId === c.id).length;
              const members = data.memberships.filter((m) => m.clientId === c.id).length;
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                  <Monogram client={c} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-subtle">
                      {projects} project{projects === 1 ? '' : 's'} · {members} team member{members === 1 ? '' : 's'}
                    </p>
                  </div>
                  <Badge tone={c.status === 'active' ? 'accent' : 'outline'}>{CLIENT_STATUS_LABELS[c.status]}</Badge>
                  {c.id === ws.client.id && <Badge tone="neutral">Current</Badge>}
                  <Button size="sm" variant="ghost" icon={<Pencil size={15} aria-hidden />} onClick={() => setProfile(c.id)}>Edit</Button>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3">
            <Button size="sm" icon={<ListOrdered size={15} aria-hidden />} onClick={() => setCategoriesOpen(true)}>
              Portfolio categories — {ws.client.name}
            </Button>
            <Button size="sm" icon={<ListChecks size={15} aria-hidden />} onClick={() => setTemplatesOpen(true)}>
              Readiness checklist templates
            </Button>
            <Button size="sm" icon={<SlidersHorizontal size={15} aria-hidden />} onClick={() => setDimsOpen(true)}>
              Readiness dimensions
            </Button>
            <p className="text-xs text-subtle">Meeting templates are managed from Meetings → Templates.</p>
          </div>
        </Panel>

        <Panel title="Data & backup" icon={<Database size={18} />}>
          <dl className="mb-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-subtle">Storage</dt>
            <dd>{adapter?.description ?? '—'}</dd>
            <dt className="text-subtle">Size</dt>
            <dd className="tabular">{formatBytes(usage)}</dd>
            <dt className="text-subtle">Last saved</dt>
            <dd>{lastSavedAt ? formatDateTime(lastSavedAt) : 'Not yet saved'}</dd>
            <dt className="text-subtle">Data origin</dt>
            <dd>{data.origin === 'demo-seed' ? 'Built-in demonstration data' : data.origin === 'restored' ? 'Restored from backup' : 'Empty workspace'}</dd>
            <dt className="text-subtle">Schema</dt>
            <dd className="tabular">v{data.schemaVersion}</dd>
            <dt className="text-subtle">Images</dt>
            <dd className="tabular">
              {media ? `${media.count} stored${media.orphans.length ? ` (${media.orphans.length} unreferenced)` : ''}` : '…'}
              {media?.used != null && media.quota ? ` · browser storage ${formatBytes(media.used)} of ${formatBytes(media.quota)}` : ''}
            </dd>
          </dl>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button variant="secondary" icon={<Download size={16} aria-hidden />} onClick={exportBackup}>
              Export backup (JSON)
            </Button>
            <Button variant="secondary" icon={<Upload size={16} aria-hidden />} onClick={() => setRestoreOpen(true)}>
              Restore from backup
            </Button>
            {!!media?.orphans.length && (
              <Button variant="secondary" icon={<Sparkles size={16} aria-hidden />} onClick={() => void cleanOrphans()}>
                Remove unreferenced images
              </Button>
            )}
            {samples.projects > 0 && (
              <Button variant="secondary" icon={<Eraser size={16} aria-hidden />} onClick={() => setSampleOpen(true)}>
                Remove sample data
              </Button>
            )}
            <Button variant="danger" icon={<RotateCcw size={16} aria-hidden />} onClick={() => setResetOpen(true)}>
              Reset to demo data
            </Button>
          </div>
          <p className="mt-4 text-xs text-subtle">
            Backups contain every client workspace in this browser. Treat exported files as confidential and store them only in BSA-approved locations.
          </p>
        </Panel>

        <Panel title="Environment & security" icon={<ShieldAlert size={18} />}>
          <ul className="flex flex-col gap-3 text-sm">
            <EnvRow label="Mode" value={environment.mode === 'prototype' ? 'Prototype Mode' : 'Production'} warn={environment.mode === 'prototype'} />
            <EnvRow label="Authentication" value="None — anyone with this browser can view and edit" warn />
            <EnvRow label="Authorization" value="Not enforced; roles shown for layout only" warn />
            <EnvRow label="Data storage" value="Browser-local, unencrypted, not synchronized" warn />
            <EnvRow label="AI services" value={environment.aiEnabled ? 'Enabled' : 'Disabled — no data leaves this browser'} />
            <EnvRow label="App version" value={environment.appVersion} />
          </ul>
        </Panel>

        <Panel title="Recent activity" icon={<History size={18} />} className="xl:col-span-2">
          {data.activity.length === 0 ? (
            <EmptyState compact title="No changes recorded in this browser yet" />
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {data.activity.slice(0, 10).map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm">
                  <span>{a.summary}</span>
                  <span className="text-xs text-subtle">
                    {a.actor} · {formatDateTime(a.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <ResetDialog open={resetOpen} onClose={() => setResetOpen(false)} onExport={exportBackup} onConfirm={() => void resetAll()} />
      <RemoveSamplesDialog open={sampleOpen} summary={samples} onClose={() => setSampleOpen(false)} onExport={exportBackup} onConfirm={removeSamples} />
      {categoriesOpen && <CategoriesSheet client={ws.client} data={data} onClose={() => setCategoriesOpen(false)} />}
      {restoreOpen && <RestoreDialog onClose={() => setRestoreOpen(false)} />}
      {profile && data.clients.find((c) => c.id === profile) && <ClientProfileSheet client={data.clients.find((c) => c.id === profile)!} currentClientId={ws.client.id} onClose={() => setProfile(null)} />}
      {dimsOpen && <ReadinessDimensionsSheet client={ws.client} data={data} onClose={() => setDimsOpen(false)} />}
      {templatesOpen && <ChecklistTemplatesSheet client={ws.client} data={data} onClose={() => setTemplatesOpen(false)} />}
    </>
  );
}

function EnvRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <li className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <span className="w-36 shrink-0 text-subtle">{label}</span>
      <span className={warn ? 'text-caution' : ''}>{value}</span>
    </li>
  );
}

function NewClientForm({ onDone }: { onDone(): void }) {
  const addClient = useDataStore((s) => s.addClient);
  const data = useDataStore((s) => s.data)!;
  const navigate = useNavigate();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => nameRef.current?.focus(), []);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const parsed = clientSchema.safeParse(raw);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    const dup = data.clients.find((c) => c.name.trim().toLowerCase() === parsed.data.name.toLowerCase());
    if (dup) {
      setErrors({ name: `A workspace named "${dup.name}" already exists.` });
      return;
    }
    const client = addClient(parsed.data);
    onDone();
    navigate(`/c/${client.id}/overview`);
  };

  return (
    <form onSubmit={submit} noValidate className="mb-5 grid gap-4 rounded-lg border border-line bg-surface-2 p-4 sm:grid-cols-2">
      <Field label="Client name" name="name" required error={errors.name} inputRef={nameRef} placeholder="e.g. Memorial Health" />
      <Field label="Short name" name="shortName" error={errors.shortName} hint="Optional — used where space is limited" />
      <Field label="Monogram" name="monogram" error={errors.monogram} hint="Optional — up to 3 characters" />
      <Field label="Sector" name="sector" error={errors.sector} hint="Optional" />
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" variant="primary">Create workspace</Button>
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

function Field({ label, name, error, hint, required, placeholder, inputRef }: { label: string; name: string; error?: string; hint?: string; required?: boolean; placeholder?: string; inputRef?: React.Ref<HTMLInputElement> }) {
  const id = `f-${name}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-bold">
        {label} {required && <span className="text-brand" aria-hidden>*</span>}
      </label>
      <input
        ref={inputRef}
        id={id}
        name={name}
        required={required}
        placeholder={placeholder}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        className="h-12 rounded-lg border border-line bg-surface px-3 text-base outline-none placeholder:text-subtle focus:border-accent aria-[invalid=true]:border-negative sm:text-sm"
      />
      {error ? (
        <FieldError id={`${id}-err`}>{error}</FieldError>
      ) : (
        hint && <p id={`${id}-hint`} className="text-xs text-subtle">{hint}</p>
      )}
    </div>
  );
}

function RemoveSamplesDialog({ open, summary, onClose, onConfirm, onExport }: { open: boolean; summary: SampleDataSummary; onClose(): void; onConfirm(): void; onExport(): void }) {
  const n = summary.projects;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Remove sample data?"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="secondary" icon={<Download size={16} aria-hidden />} onClick={onExport}>Export backup first</Button>
          <Button variant="danger" onClick={onConfirm}>Remove {n} sample project{n === 1 ? '' : 's'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm text-muted">
        <p>
          This permanently removes the <strong className="text-ink">{n} fictional sample project{n === 1 ? '' : 's'}</strong> (marked “Sample”) from every workspace in this browser, together with their images
          {summary.checklists ? ` and ${summary.checklists} checklist${summary.checklists === 1 ? '' : 's'}` : ''}.
        </p>
        <p>
          <strong className="text-ink">Everything else is kept:</strong> people and leadership, workstreams, initiatives, actions, decisions, risks, milestones, meetings, reports, and any projects you created or imported.
          {summary.unlinked ? ` ${summary.unlinked} of your record${summary.unlinked === 1 ? '' : 's'} linked to a sample project will be kept and unlinked.` : ''}
        </p>
      </div>
    </Dialog>
  );
}

function ResetDialog({ open, onClose, onConfirm, onExport }: { open: boolean; onClose(): void; onConfirm(): void; onExport(): void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Reset to demonstration data?"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="secondary" icon={<Download size={16} aria-hidden />} onClick={onExport}>Export backup first</Button>
          <Button variant="danger" onClick={onConfirm}>Replace all data</Button>
        </>
      }
    >
      <p className="text-sm text-muted">
        This replaces <strong className="text-ink">every client workspace stored in this browser</strong> with the built-in demonstration data and deletes all stored images. Changes you have made will be lost unless you export a backup first.
      </p>
    </Dialog>
  );
}
