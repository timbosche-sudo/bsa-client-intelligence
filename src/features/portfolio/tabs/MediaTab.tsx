import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, ImagePlus, Link2, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog } from '@/components/ui/Dialog';
import { Sheet } from '@/components/ui/Sheet';
import { FieldError, SelectField, TextField } from '@/components/form/fields';
import { mediaStore } from '@/data/media/MediaStore';
import { forgetMediaUrl, useMediaUrl } from '@/data/media/useMediaUrl';
import { addMedia, removeMedia, setProjectCover, updateMedia, upsertProject } from '@/data/mutations';
import type { ClientWorkspace } from '@/data/repository';
import { newId, nowIso } from '@/domain/ids';
import { MEDIA_KIND_LABELS, type MediaKind, type MediaRecord, type Project } from '@/domain/types';
import { formatBytes } from '@/lib/format';
import { ACCEPT_ATTR, ImageValidationError, loadImage, releaseImage, renderImage, validateImageFile } from '@/services/images';
import { currentUserName, run } from '@/state/actions';
import { toast } from '@/state/toast';
import { Section } from './shared';

const PROJECT_KINDS: MediaKind[] = ['rendering', 'construction', 'plan', 'photo', 'other'];
const MAX_EDGE = 2400;

export function MediaTab({ ws, project }: { ws: ClientWorkspace; project: Project }) {
  const images = project.imageIds.map((id) => ws.media.find((m) => m.id === id)).filter((m): m is MediaRecord => !!m);
  const [pending, setPending] = useState<File[] | null>(null);
  const [editing, setEditing] = useState<MediaRecord | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<MediaRecord | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const ok: File[] = [];
    for (const f of Array.from(files)) {
      try {
        validateImageFile(f);
        ok.push(f);
      } catch (err) {
        toast(err instanceof ImageValidationError ? err.message : `Could not read ${f.name}.`, 'error');
      }
    }
    if (ok.length) setPending(ok);
    if (fileRef.current) fileRef.current.value = '';
  };

  const remove = (rec: MediaRecord) => {
    const r = run((d) => removeMedia(d, rec.id), { clientId: ws.client.id, entity: 'media', entityId: rec.id, summary: `Removed image from "${project.name}"` });
    if (r.ok) {
      forgetMediaUrl(rec.id);
      void mediaStore().delete(rec.id).catch(() => undefined);
    }
    setDeleting(null);
  };

  return (
    <div className="flex flex-col gap-10">
      <Section
        title={`Images (${images.length})`}
        actions={
          <>
            <Button size="sm" variant="primary" icon={<ImagePlus size={15} />} onClick={() => fileRef.current?.click()}>Upload images</Button>
            <input ref={fileRef} type="file" multiple accept={ACCEPT_ATTR} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => onFiles(e.target.files)} />
          </>
        }
      >
        {images.length === 0 ? (
          <button type="button" onClick={() => fileRef.current?.click()} className="flex min-h-40 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong text-sm text-subtle hover:bg-surface-2">
            <ImagePlus size={22} aria-hidden />
            Add renderings, construction photography or plans
            <span className="text-xs">JPEG, PNG or WebP · up to 15 MB each</span>
          </button>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {images.map((m, i) => (
              <ImageTile
                key={m.id}
                rec={m}
                isCover={project.coverImageId === m.id}
                onView={() => setViewing(i)}
                onEdit={() => setEditing(m)}
                onCover={() => run((d) => setProjectCover(d, project.id, m.id), { clientId: ws.client.id, entity: 'project', entityId: project.id, summary: 'Set cover image' })}
                onDelete={() => setDeleting(m)}
              />
            ))}
          </ul>
        )}
      </Section>

      <DocumentLinks ws={ws} project={project} />

      {pending && <UploadSheet ws={ws} project={project} files={pending} onClose={() => setPending(null)} />}
      {editing && <EditImageSheet ws={ws} rec={editing} onClose={() => setEditing(null)} />}
      {viewing !== null && images[viewing] && <Lightbox images={images} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} />}
      <ConfirmDialog open={!!deleting} title="Delete this image?" confirmLabel="Delete image" tone="danger" onClose={() => setDeleting(null)} onConfirm={() => deleting && remove(deleting)}>
        The image is removed from this project and from this browser’s storage. Export a backup first if you may need it.
      </ConfirmDialog>
    </div>
  );
}

function ImageTile({ rec, isCover, onView, onEdit, onCover, onDelete }: { rec: MediaRecord; isCover: boolean; onView(): void; onEdit(): void; onCover(): void; onDelete(): void }) {
  const url = useMediaUrl(rec.id);
  return (
    <li className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface">
      <button type="button" onClick={onView} className="relative aspect-[4/3] bg-surface-3" aria-label={`View ${rec.caption || rec.fileName}`}>
        {url && <img src={url} alt={rec.caption || ''} className="h-full w-full object-cover" loading="lazy" />}
        <span className="absolute left-2 top-2 flex gap-1.5">
          <Badge tone="overlay">{MEDIA_KIND_LABELS[rec.kind]}</Badge>
          {isCover && <Badge tone="accent">Cover</Badge>}
        </span>
      </button>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className={`text-sm ${rec.caption ? '' : 'text-subtle'}`}>{rec.caption || 'No caption'}</p>
        <p className="text-xs text-subtle">{rec.credit ? `Credit: ${rec.credit}` : 'Credit not recorded'} · {rec.width}×{rec.height} · {formatBytes(rec.bytes)}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          <Button size="sm" variant="ghost" icon={<Pencil size={14} />} onClick={onEdit}>Details</Button>
          {!isCover && <Button size="sm" variant="ghost" icon={<Star size={14} />} onClick={onCover}>Make cover</Button>}
          <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={onDelete} aria-label="Delete image" className="ml-auto">
            <span className="sr-only">Delete</span>
          </Button>
        </div>
      </div>
    </li>
  );
}

function UploadSheet({ ws, project, files, onClose }: { ws: ClientWorkspace; project: Project; files: File[]; onClose(): void }) {
  const [meta, setMeta] = useState(() => files.map(() => ({ kind: 'rendering' as MediaKind, caption: '', credit: '' })));
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const set = (i: number, patch: Partial<(typeof meta)[number]>) => setMeta((m) => m.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const upload = async () => {
    setBusy(true);
    const created: MediaRecord[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        setProgress(`Processing ${i + 1} of ${files.length}…`);
        const img = await loadImage(files[i]);
        const out = await renderImage(img, null, MAX_EDGE, 0.85).finally(() => releaseImage(img));
        const id = newId('media');
        await mediaStore().put(id, out.blob);
        const ts = nowIso();
        created.push({ id, createdAt: ts, updatedAt: ts, archivedAt: null, clientId: ws.client.id, ownerType: 'project', ownerId: project.id, kind: meta[i].kind, caption: meta[i].caption.trim(), credit: meta[i].credit.trim(), fileName: files[i].name, mime: out.blob.type, width: out.width, height: out.height, bytes: out.blob.size });
      }
    } catch (err) {
      created.forEach((c) => void mediaStore().delete(c.id).catch(() => undefined));
      toast(err instanceof Error ? `Upload failed: ${err.message}` : 'Upload failed. Browser storage may be full.', 'error');
      setBusy(false);
      return;
    }
    const r = run(
      (d) => {
        created.forEach((c) => addMedia(d, c));
        const p = d.projects.find((x) => x.id === project.id)!;
        upsertProject(d, p, currentUserName(), `Added ${created.length} image(s).`);
      },
      { clientId: ws.client.id, entity: 'media', entityId: project.id, summary: `Uploaded ${created.length} image(s) to "${project.name}"` },
    );
    setBusy(false);
    if (r.ok) onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Upload ${files.length} image${files.length > 1 ? 's' : ''}`}
      description="Images are resized to 2400 px on the long edge and compressed before storage."
      footer={
        <>
          {progress && busy && <span className="mr-auto text-sm text-muted" role="status">{progress}</span>}
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={() => void upload()} disabled={busy}>{busy ? 'Uploading…' : 'Upload'}</Button>
        </>
      }
    >
      <p className="mb-5 border-l-2 border-bsa-yellow bg-surface-2 px-3 py-2 text-sm">
        Upload only authentic project imagery BSA has rights to use. Internet images and AI-generated imagery must not be used (BSA Brand Guide pp.34 & 38). Record the photographer or rendering credit.
      </p>
      <ul className="flex flex-col gap-5">
        {files.map((f, i) => (
          <li key={i} className="grid gap-3 rounded-lg border border-line p-4 sm:grid-cols-[6rem_1fr]">
            <FilePreview file={f} />
            <div className="grid gap-3 sm:grid-cols-2">
              <p className="truncate text-sm font-bold sm:col-span-2">{f.name} <span className="font-normal text-subtle">· {formatBytes(f.size)}</span></p>
              <SelectField label="Image type" value={meta[i].kind} onChange={(v) => set(i, { kind: v as MediaKind })} options={PROJECT_KINDS.map((k) => ({ value: k, label: MEDIA_KIND_LABELS[k] }))} />
              <TextField label="Credit / attribution" value={meta[i].credit} onChange={(v) => set(i, { credit: v })} placeholder="e.g. Photographer name / BSA" />
              <TextField label="Caption" value={meta[i].caption} onChange={(v) => set(i, { caption: v })} className="sm:col-span-2" />
            </div>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

function FilePreview({ file }: { file: File }) {
  const [url] = useState(() => URL.createObjectURL(file));
  return <img src={url} alt="" className="aspect-square w-24 rounded-lg object-cover" onLoad={() => setTimeout(() => URL.revokeObjectURL(url), 60_000)} />;
}

function EditImageSheet({ ws, rec, onClose }: { ws: ClientWorkspace; rec: MediaRecord; onClose(): void }) {
  const [m, setM] = useState(rec);
  return (
    <Sheet
      open
      onClose={onClose}
      width="md"
      title="Image details"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              const r = run((d) => updateMedia(d, { ...m, caption: m.caption.trim(), credit: m.credit.trim() }), { clientId: ws.client.id, entity: 'media', entityId: m.id, summary: 'Updated image details' });
              if (r.ok) onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <SelectField label="Image type" value={m.kind} onChange={(v) => setM({ ...m, kind: v as MediaKind })} options={PROJECT_KINDS.map((k) => ({ value: k, label: MEDIA_KIND_LABELS[k] }))} />
        <TextField label="Caption" value={m.caption} onChange={(v) => setM({ ...m, caption: v })} />
        <TextField label="Credit / attribution" value={m.credit} onChange={(v) => setM({ ...m, credit: v })} />
        <p className="text-xs text-subtle">Original file: {m.fileName}</p>
      </div>
    </Sheet>
  );
}

function Lightbox({ images, index, onIndex, onClose }: { images: MediaRecord[]; index: number; onIndex(i: number): void; onClose(): void }) {
  const rec = images[index];
  const url = useMediaUrl(rec.id);
  const go = (d: number) => onIndex((index + d + images.length) % images.length);
  return (
    <Dialog open onClose={onClose} title={rec.caption || MEDIA_KIND_LABELS[rec.kind]} description={`${index + 1} of ${images.length}${rec.credit ? ` · Credit: ${rec.credit}` : ''}`} size="lg">
      <div
        className="relative flex items-center justify-center bg-black"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') go(1);
          if (e.key === 'ArrowLeft') go(-1);
        }}
      >
        {url && <img src={url} alt={rec.caption || ''} className="max-h-[60dvh] w-auto object-contain" />}
        {images.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous image" className="absolute left-2 inline-flex size-11 items-center justify-center rounded-full bg-black/70 text-white"><ChevronLeft size={20} /></button>
            <button type="button" onClick={() => go(1)} aria-label="Next image" className="absolute right-2 inline-flex size-11 items-center justify-center rounded-full bg-black/70 text-white"><ChevronRight size={20} /></button>
          </>
        )}
      </div>
    </Dialog>
  );
}

function DocumentLinks({ ws, project }: { ws: ClientWorkspace; project: Project }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const add = () => {
    let parsed: URL;
    try {
      parsed = new URL(url.trim());
    } catch {
      return setError('Enter a full link, starting with https://');
    }
    if (parsed.protocol !== 'https:') return setError('Use a secure https:// link.');
    if (!title.trim()) return setError('Give the document a title.');
    const r = run(
      (d) => {
        const p = d.projects.find((x) => x.id === project.id)!;
        upsertProject(d, { ...p, documentLinks: [...p.documentLinks, { id: newId('doc'), title: title.trim(), url: parsed.toString(), addedAt: nowIso() }] }, currentUserName(), `Linked document "${title.trim()}".`);
      },
      { clientId: ws.client.id, entity: 'project', entityId: project.id, summary: `Linked document "${title.trim()}"` },
    );
    if (r.ok) {
      setTitle('');
      setUrl('');
      setError('');
      setAdding(false);
    }
  };

  const removeLink = (id: string, t: string) => {
    if (!window.confirm(`Remove the link to "${t}"? The document itself is not affected.`)) return;
    run(
      (d) => {
        const p = d.projects.find((x) => x.id === project.id)!;
        upsertProject(d, { ...p, documentLinks: p.documentLinks.filter((l) => l.id !== id) }, currentUserName(), `Removed document link "${t}".`);
      },
      { clientId: ws.client.id, entity: 'project', entityId: project.id, summary: `Removed document link "${t}"` },
    );
  };

  return (
    <Section title={`Documents (${project.documentLinks.length})`} actions={!adding && <Button size="sm" icon={<Plus size={15} />} onClick={() => setAdding(true)}>Link document</Button>}>
      <p className="mb-4 text-xs text-subtle">Documents stay in their system of record (e.g. SharePoint or Teams). The app stores a link only; access is controlled by that system.</p>
      {adding && (
        <div className="mb-4 grid gap-3 rounded-lg border border-line p-4 sm:grid-cols-[1fr_1.5fr_auto] sm:items-end">
          <TextField label="Title" value={title} onChange={setTitle} />
          <TextField label="Link (https://)" type="url" inputMode="url" value={url} onChange={setUrl} />
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => (setAdding(false), setError(''))}>Cancel</Button>
            <Button variant="primary" onClick={add}>Add</Button>
          </div>
          {error && <div className="sm:col-span-3"><FieldError>{error}</FieldError></div>}
        </div>
      )}
      {project.documentLinks.length === 0 ? (
        !adding && <p className="text-sm text-subtle">No documents linked.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {project.documentLinks.map((l) => (
            <li key={l.id} className="flex items-center gap-3 py-2">
              <Link2 size={16} className="shrink-0 text-subtle" aria-hidden />
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 min-w-0 flex-1 items-center gap-1.5 text-sm font-bold hover:underline">
                <span className="truncate">{l.title}</span>
                <ExternalLink size={13} className="shrink-0" aria-hidden />
              </a>
              <Button size="sm" variant="ghost" iconOnly icon={<Trash2 size={15} />} aria-label={`Remove link ${l.title}`} onClick={() => removeLink(l.id, l.title)} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
