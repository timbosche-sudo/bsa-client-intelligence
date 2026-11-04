/**
 * Backup restore (Stage 6): parse → validate → migrate → preview → confirmed replace.
 * Nothing is written until the user confirms the preview.
 */
import { migrate, SCHEMA_VERSION, SchemaError } from '@/data/schema';
import type { MediaStore } from '@/data/media/MediaStore';
import { CLIENT_SCOPED_COLLECTIONS, type Dataset } from '@/domain/types';
import { BACKUP_FORMAT, base64ToBlob, type BackupMediaEntry } from './backup';

export interface ParsedBackup {
  data: Dataset;
  mediaFiles: BackupMediaEntry[];
  meta: { exportedAt: string | null; appVersion: string | null; schemaVersion: number; wrapped: boolean };
  warnings: string[];
}

export type ParseResult = { ok: true; backup: ParsedBackup } | { ok: false; errors: string[] };

const MAX_BACKUP_BYTES = 200 * 1024 * 1024;
const IMAGE_MIME = /^image\/(png|jpe?g|webp)$/;

export function parseBackup(text: string): ParseResult {
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, errors: ['The file is larger than 200 MB.'] };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['The file is not valid JSON.'] };
  }
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['The file does not contain a backup.'] };
  const obj = raw as Record<string, unknown>;
  const warnings: string[] = [];
  let wrapped = true;
  let dataRaw: unknown = obj.data;
  if (obj.format !== BACKUP_FORMAT) {
    if (Array.isArray(obj.clients) && typeof obj.schemaVersion === 'number') {
      wrapped = false;
      dataRaw = obj;
      warnings.push('This file is a raw dataset without backup metadata. It can be restored, but has no embedded images.');
    } else if ('projects' in obj && 'client' in obj) {
      return { ok: false, errors: ['This is a portfolio seed file. Use Portfolio Readiness → Import instead.'] };
    } else {
      return { ok: false, errors: ['This file is not a BSA Client Intelligence backup.'] };
    }
  }
  const version = typeof (dataRaw as { schemaVersion?: unknown })?.schemaVersion === 'number' ? ((dataRaw as { schemaVersion: number }).schemaVersion) : 0;
  if (version > SCHEMA_VERSION) return { ok: false, errors: [`The backup was made by a newer version of the app (schema ${version}; this app supports up to ${SCHEMA_VERSION}). Update the app first.`] };

  let data: Dataset;
  try {
    data = migrate(structuredClone(dataRaw));
  } catch (e) {
    return { ok: false, errors: [e instanceof SchemaError ? e.message : 'The backup data could not be read.'] };
  }
  if (version < SCHEMA_VERSION) warnings.push(`The backup uses schema ${version}; it will be upgraded to ${SCHEMA_VERSION}.`);

  const errors = validateIntegrity(data);
  const mediaFiles = Array.isArray(obj.mediaFiles) ? (obj.mediaFiles as BackupMediaEntry[]) : [];
  const knownMedia = new Set(data.media.map((m) => m.id));
  for (const f of mediaFiles) {
    if (!f || typeof f.id !== 'string' || typeof f.data !== 'string' || !IMAGE_MIME.test(f.mime ?? '')) errors.push('The backup contains an invalid embedded image entry.');
    else if (!knownMedia.has(f.id)) warnings.push(`Embedded image ${f.id} is not referenced by any record and will be skipped.`);
  }
  const embedded = new Set(mediaFiles.map((f) => f?.id));
  const missing = data.media.filter((m) => !embedded.has(m.id)).length;
  if (missing) warnings.push(`${missing} image record(s) have no embedded image; they will show as missing until re-uploaded.`);
  if (errors.length) return { ok: false, errors: [...new Set(errors)].slice(0, 10) };

  return {
    ok: true,
    backup: {
      data: { ...data, origin: 'restored' },
      mediaFiles: mediaFiles.filter((f) => knownMedia.has(f.id)),
      meta: { exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : null, appVersion: typeof obj.appVersion === 'string' ? obj.appVersion : null, schemaVersion: version, wrapped },
      warnings,
    },
  };
}

/** Referential checks beyond the schema envelope. */
export function validateIntegrity(d: Dataset): string[] {
  const errors: string[] = [];
  if (!d.clients.length) errors.push('The backup contains no client workspaces.');
  const clientIds = new Set(d.clients.map((c) => c.id));
  const allIds = new Map<string, string>();
  const collections: (keyof Dataset)[] = ['clients', 'people', 'memberships', 'seats', 'projects', 'workstreams', 'initiatives', 'actions', 'decisions', 'risks', 'milestones', 'meetingTemplates', 'meetings', 'reports', 'media', 'checklistTemplates', 'checklists'];
  for (const k of collections) {
    for (const r of d[k] as { id: string }[]) {
      if (allIds.has(r.id)) errors.push(`Duplicate record id "${r.id}" (${allIds.get(r.id)} and ${String(k)}).`);
      allIds.set(r.id, String(k));
    }
  }
  for (const k of CLIENT_SCOPED_COLLECTIONS) {
    const orphan = (d[k] as { clientId: string }[]).filter((r) => !clientIds.has(r.clientId)).length;
    if (orphan) errors.push(`${orphan} ${k} record(s) belong to a client that is not in the backup.`);
  }
  const people = new Set(d.people.map((p) => p.id));
  const badMembers = d.memberships.filter((m) => !people.has(m.personId)).length;
  if (badMembers) errors.push(`${badMembers} team membership(s) reference people missing from the backup.`);
  const projects = new Set(d.projects.map((p) => p.id));
  const badChecklists = d.checklists.filter((c) => !projects.has(c.projectId)).length;
  if (badChecklists) errors.push(`${badChecklists} checklist(s) reference projects missing from the backup.`);
  return errors;
}

export interface RestorePreviewRow {
  clientId: string;
  name: string;
  change: 'added' | 'removed' | 'replaced';
  current: Record<string, number> | null;
  incoming: Record<string, number> | null;
}

const COUNTED = ['projects', 'actions', 'decisions', 'meetings', 'reports'] as const;
function counts(d: Dataset, clientId: string): Record<string, number> {
  const out: Record<string, number> = { people: d.memberships.filter((m) => m.clientId === clientId).length };
  for (const k of COUNTED) out[k] = (d[k] as { clientId: string }[]).filter((r) => r.clientId === clientId).length;
  return out;
}

export function restorePreview(current: Dataset, incoming: Dataset): RestorePreviewRow[] {
  const ids = [...new Set([...current.clients.map((c) => c.id), ...incoming.clients.map((c) => c.id)])];
  return ids.map((id) => {
    const cur = current.clients.find((c) => c.id === id);
    const inc = incoming.clients.find((c) => c.id === id);
    return {
      clientId: id,
      name: inc?.name ?? cur?.name ?? id,
      change: !cur ? 'added' : !inc ? 'removed' : 'replaced',
      current: cur ? counts(current, id) : null,
      incoming: inc ? counts(incoming, id) : null,
    };
  });
}

/** Writes embedded images, then removes images not referenced by the restored data. */
export async function restoreMedia(store: MediaStore, backup: ParsedBackup): Promise<{ written: number; removed: number }> {
  for (const f of backup.mediaFiles) await store.put(f.id, base64ToBlob(f.data, f.mime));
  const keep = new Set(backup.data.media.map((m) => m.id));
  const stale = (await store.keys()).filter((k) => !keep.has(k));
  for (const k of stale) await store.delete(k);
  return { written: backup.mediaFiles.length, removed: stale.length };
}
