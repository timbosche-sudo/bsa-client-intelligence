import { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, ArchiveRestore, Camera, ImageMinus, Trash2, Upload } from 'lucide-react';
import { z } from 'zod';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Sheet } from '@/components/ui/Sheet';
import { FieldError, FormSection, SelectField, TextArea, TextField, Toggle } from '@/components/form/fields';
import { mediaStore } from '@/data/media/MediaStore';
import { forgetMediaUrl, useMediaUrl } from '@/data/media/useMediaUrl';
import { addMedia, blankPerson, deletePerson, findDuplicatePeople, findPersonReferences, removeMedia, setPersonArchived, upsertPerson } from '@/data/mutations';
import { newId, nowIso } from '@/domain/ids';
import type { Affiliation, MediaRecord, Person } from '@/domain/types';
import { ACCEPT_ATTR, ImageValidationError, loadImage, releaseImage, validateImageFile } from '@/services/images';
import { run } from '@/state/actions';
import { useDataStore } from '@/state/store';
import { toast } from '@/state/toast';
import { HeadshotCropper } from './HeadshotCropper';

const schema = z.object({
  fullName: z.string().trim().min(2, 'Enter the person’s full name.').max(120),
  title: z.string().trim().max(120).nullable(),
  organization: z.string().trim().max(120).nullable(),
  affiliation: z.enum(['bsa', 'client', 'external']),
  studio: z.string().trim().max(80).nullable(),
  discipline: z.string().trim().max(80).nullable(),
  email: z.union([z.literal(''), z.null(), z.string().trim().email('Enter a valid email address.')]),
  phone: z.string().trim().max(40).nullable(),
  notes: z.string().max(4000),
  active: z.boolean(),
  isAppUser: z.boolean(),
});

type FormValues = Pick<Person, 'fullName' | 'title' | 'organization' | 'affiliation' | 'studio' | 'discipline' | 'email' | 'phone' | 'notes' | 'active' | 'isAppUser'>;

const toForm = (p: Person): FormValues => ({
  fullName: p.fullName,
  title: p.title,
  organization: p.organization,
  affiliation: p.affiliation,
  studio: p.studio,
  discipline: p.discipline,
  email: p.email,
  phone: p.phone,
  notes: p.notes,
  active: p.active,
  isAppUser: p.isAppUser,
});

const nullIfBlank = (s: string | null) => (s && s.trim() ? s.trim() : null);

interface Props {
  open: boolean;
  onClose(): void;
  /** Existing person, or null to create. */
  personId: string | null;
  /** Workspace the sheet was opened from; client contacts created here belong to it. */
  clientId: string;
  clientName: string;
  onCreated?(person: Person): void;
}

export function PersonSheet({ open, onClose, personId, clientId, clientName, onCreated }: Props) {
  const data = useDataStore((s) => s.data)!;
  const existing = personId ? data.people.find((p) => p.id === personId) ?? null : null;
  const [draftId] = useState(() => existing?.id ?? newId('person'));
  const [values, setValues] = useState<FormValues>(() => toForm(existing ?? blankPerson()));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [pendingHeadshot, setPendingHeadshot] = useState<{ blob: Blob; width: number; height: number; url: string; fileName: string } | null>(null);
  const [removeHeadshot, setRemoveHeadshot] = useState(false);
  const [cropSource, setCropSource] = useState<{ img: HTMLImageElement; name: string } | null>(null);
  const [confirm, setConfirm] = useState<null | 'delete' | 'archive'>(null);
  const [dupAck, setDupAck] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const storedUrl = useMediaUrl(removeHeadshot ? null : existing?.headshotMediaId);
  const previewUrl = pendingHeadshot?.url ?? storedUrl;

  useEffect(
    () => () => {
      if (pendingHeadshot) URL.revokeObjectURL(pendingHeadshot.url);
    },
    [pendingHeadshot],
  );

  const set = <K extends keyof FormValues>(k: K, v: FormValues[K]) => {
    setValues((s) => ({ ...s, [k]: v }));
    setDirty(true);
    if (k === 'fullName') setDupAck(false);
  };
  const duplicates = useMemo(() => (values.fullName.trim().length > 2 ? findDuplicatePeople(data, values.fullName, draftId) : []), [data, values.fullName, draftId]);
  const references = existing ? findPersonReferences(data, existing.id) : [];

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      validateImageFile(file);
      setCropSource({ img: await loadImage(file), name: file.name });
    } catch (err) {
      toast(err instanceof ImageValidationError ? err.message : 'The image could not be opened.', 'error');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = async () => {
    const r = schema.safeParse(values);
    if (!r.success) {
      setErrors(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    if (duplicates.length && !dupAck) {
      setErrors({ fullName: `A person named "${duplicates[0].fullName}" already exists. Save again to create a separate record anyway.` });
      setDupAck(true);
      return;
    }
    const v = r.data;
    const base = existing ?? blankPerson({ id: draftId });
    const next: Person = {
      ...base,
      fullName: v.fullName.trim(),
      title: nullIfBlank(v.title),
      organization: nullIfBlank(v.organization),
      affiliation: v.affiliation as Affiliation,
      studio: nullIfBlank(v.studio),
      discipline: nullIfBlank(v.discipline),
      email: nullIfBlank(v.email ?? null),
      phone: nullIfBlank(v.phone),
      notes: v.notes,
      active: v.active,
      isAppUser: v.isAppUser,
      // Client contacts are tied to the workspace they were created in; BSA/external people are reusable.
      homeClientId: v.affiliation === 'client' ? base.homeClientId ?? clientId : null,
    };

    let mediaRec: MediaRecord | null = null;
    if (pendingHeadshot) {
      const id = newId('media');
      try {
        await mediaStore().put(id, pendingHeadshot.blob);
      } catch {
        toast('The headshot could not be stored in this browser (storage may be full). Other changes were not saved.', 'error');
        return;
      }
      const ts = nowIso();
      mediaRec = { id, createdAt: ts, updatedAt: ts, archivedAt: null, clientId: null, ownerType: 'person', ownerId: next.id, kind: 'headshot', caption: '', credit: '', fileName: pendingHeadshot.fileName, mime: pendingHeadshot.blob.type, width: pendingHeadshot.width, height: pendingHeadshot.height, bytes: pendingHeadshot.blob.size };
    }
    const oldHeadshot = existing?.headshotMediaId ?? null;
    const result = run(
      (d) => {
        upsertPerson(d, next);
        if (removeHeadshot && oldHeadshot && !mediaRec) removeMedia(d, oldHeadshot);
        if (mediaRec) addMedia(d, mediaRec);
      },
      { clientId, entity: 'person', entityId: next.id, summary: existing ? `Updated ${next.fullName}` : `Added ${next.fullName}` },
    );
    if (!result.ok) return;
    if (oldHeadshot && (mediaRec || removeHeadshot)) {
      forgetMediaUrl(oldHeadshot);
      void mediaStore().delete(oldHeadshot).catch(() => undefined);
    }
    if (!existing) onCreated?.(useDataStore.getState().data!.people.find((p) => p.id === next.id)!);
    onClose();
  };

  const doDelete = () => {
    if (!existing) return;
    let purged: string | null = null;
    const r = run((d) => void (purged = deletePerson(d, existing.id)), { clientId, entity: 'person', entityId: existing.id, summary: `Deleted ${existing.fullName}` });
    if (r.ok) {
      if (purged) void mediaStore().delete(purged).catch(() => undefined);
      setConfirm(null);
      onClose();
    }
  };

  const doArchive = () => {
    if (!existing) return;
    const archived = !existing.archivedAt;
    run((d) => setPersonArchived(d, existing.id, archived), { clientId, entity: 'person', entityId: existing.id, summary: `${archived ? 'Archived' : 'Restored'} ${existing.fullName}` });
    setConfirm(null);
    onClose();
  };

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        confirmClose={dirty || !!pendingHeadshot}
        title={existing ? `Edit ${existing.fullName}` : 'Add person'}
        description={existing?.archivedAt ? 'This person is archived.' : 'People are shared across client workspaces. Client contacts stay with their client.'}
        footer={
          <>
            {existing && (
              <div className="mr-auto flex gap-2">
                <Button variant="ghost" size="sm" icon={existing.archivedAt ? <ArchiveRestore size={15} /> : <Archive size={15} />} onClick={() => (existing.archivedAt ? doArchive() : setConfirm('archive'))}>
                  {existing.archivedAt ? 'Restore' : 'Archive'}
                </Button>
                <Button variant="ghost" size="sm" icon={<Trash2 size={15} />} onClick={() => setConfirm('delete')}>
                  Delete
                </Button>
              </div>
            )}
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={() => void save()}>{existing ? 'Save changes' : 'Add person'}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-6">
          {/* Headshot */}
          <div className="flex flex-wrap items-center gap-5">
            <Avatar name={values.fullName || null} src={previewUrl} size="xl" />
            <div className="flex flex-col gap-2">
              <p className="text-sm font-bold">Headshot</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" icon={previewUrl ? <Camera size={15} /> : <Upload size={15} />} onClick={() => fileRef.current?.click()}>
                  {previewUrl ? 'Replace' : 'Upload'}
                </Button>
                {previewUrl && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<ImageMinus size={15} />}
                    onClick={() => {
                      if (pendingHeadshot) setPendingHeadshot(null);
                      else setRemoveHeadshot(true);
                      setDirty(true);
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-subtle">JPEG, PNG or WebP up to 15 MB. Use the official BSA headshot from Open Asset where available.</p>
              <input ref={fileRef} type="file" accept={ACCEPT_ATTR} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void onFile(e.target.files?.[0])} />
            </div>
          </div>

          <FormSection title="Profile">
            <TextField label="Full name" required value={values.fullName} onChange={(v) => set('fullName', v)} error={errors.fullName} autoComplete="off" className="sm:col-span-2" />
            <TextField label="Professional title" value={values.title} onChange={(v) => set('title', v)} error={errors.title} />
            <SelectField
              label="Affiliation"
              value={values.affiliation}
              onChange={(v) => {
                set('affiliation', v as Affiliation);
                if (v === 'bsa' && !values.organization) set('organization', 'BSA');
              }}
              options={[
                { value: 'bsa', label: 'BSA personnel' },
                { value: 'client', label: `Client contact (${clientName})` },
                { value: 'external', label: 'External partner / consultant' },
              ]}
              hint={values.affiliation === 'client' ? `Only offered within the ${clientName} workspace.` : undefined}
            />
            <TextField label="Organization" value={values.organization} onChange={(v) => set('organization', v)} />
            <TextField label="Studio or office" value={values.studio} onChange={(v) => set('studio', v)} />
            <TextField label="Professional discipline" value={values.discipline} onChange={(v) => set('discipline', v)} placeholder="e.g. Architecture, MEP engineering" />
          </FormSection>

          <FormSection title="Contact">
            <TextField label="Email" type="email" inputMode="email" value={values.email} onChange={(v) => set('email', v)} error={errors.email} autoComplete="off" />
            <TextField label="Phone" type="tel" inputMode="tel" value={values.phone} onChange={(v) => set('phone', v)} autoComplete="off" />
          </FormSection>

          <FormSection title="Status & notes">
            <Toggle label="Active" description="Inactive people stay in history but are not offered for new assignments." checked={values.active} onChange={(v) => set('active', v)} />
            <Toggle label="Application user" description="Will need sign-in when authentication is added. Contacts are not users by default." checked={values.isAppUser} onChange={(v) => set('isAppUser', v)} />
            <TextArea label="Notes" value={values.notes} onChange={(v) => set('notes', v)} rows={4} className="sm:col-span-2" hint="Internal only. Never included in client-facing reports." />
          </FormSection>

          {existing && references.length > 0 && (
            <div className="border-t border-line-strong pt-5">
              <p className="eyebrow mb-2 text-ink">Referenced by</p>
              <ul className="flex flex-col gap-1 text-sm text-muted">
                {references.slice(0, 8).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
                {references.length > 8 && <li className="text-subtle">+ {references.length - 8} more</li>}
              </ul>
            </div>
          )}
          {errors._form && <FieldError>{errors._form}</FieldError>}
        </div>
      </Sheet>

      <HeadshotCropper
        image={cropSource?.img ?? null}
        onCancel={() => {
          releaseImage(cropSource?.img);
          setCropSource(null);
        }}
        onConfirm={(r) => {
          if (pendingHeadshot) URL.revokeObjectURL(pendingHeadshot.url);
          setPendingHeadshot({ ...r, url: URL.createObjectURL(r.blob), fileName: cropSource?.name ?? 'headshot' });
          setRemoveHeadshot(false);
          releaseImage(cropSource?.img);
          setCropSource(null);
          setDirty(true);
        }}
      />

      <ConfirmDialog
        open={confirm === 'delete'}
        title={`Delete ${existing?.fullName ?? 'person'}?`}
        confirmLabel="Delete permanently"
        tone="danger"
        onClose={() => setConfirm(null)}
        onConfirm={doDelete}
        blockedReason={references.length ? `This person is referenced by ${references.length} record(s), so deleting would break history. Archive them instead.` : undefined}
      >
        Permanent deletion cannot be undone. Archiving keeps history and can be reversed.
      </ConfirmDialog>
      <ConfirmDialog open={confirm === 'archive'} title={`Archive ${existing?.fullName ?? 'person'}?`} confirmLabel="Archive" onClose={() => setConfirm(null)} onConfirm={doArchive}>
        Archived people are hidden from pickers and directories but remain on historical records. You can restore them later.
      </ConfirmDialog>
    </>
  );
}
