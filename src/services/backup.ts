import { environment } from '@/config/environment';
import type { Dataset } from '@/domain/types';
import type { MediaStore } from '@/data/media/MediaStore';

export const BACKUP_FORMAT = 'bsa-client-intelligence-backup';

export interface BackupMediaEntry {
  id: string;
  mime: string;
  /** base64-encoded bytes */
  data: string;
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  appVersion: string;
  schemaVersion: number;
  exportedAt: string;
  scope: { kind: 'all-clients' } | { kind: 'single-client'; clientId: string };
  media: { included: boolean; count: number; missing: string[]; note: string };
  mediaFiles: BackupMediaEntry[];
  data: Dataset;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

export function base64ToBlob(data: string, mime: string): Blob {
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Builds a portable backup. Images referenced by the dataset are embedded (base64) when a media store is given. */
export async function buildBackup(data: Dataset, store: MediaStore | null, now = new Date()): Promise<BackupFile> {
  const mediaFiles: BackupMediaEntry[] = [];
  const missing: string[] = [];
  if (store) {
    for (const rec of data.media ?? []) {
      const blob = await store.get(rec.id).catch(() => null);
      if (blob) mediaFiles.push({ id: rec.id, mime: blob.type || rec.mime, data: await blobToBase64(blob) });
      else missing.push(rec.id);
    }
  }
  return {
    format: BACKUP_FORMAT,
    appVersion: environment.appVersion,
    schemaVersion: data.schemaVersion,
    exportedAt: now.toISOString(),
    scope: { kind: 'all-clients' },
    media: {
      included: !!store,
      count: mediaFiles.length,
      missing,
      note: store
        ? missing.length
          ? `${missing.length} image(s) referenced by records were not found in this browser and are not included.`
          : 'All images are embedded in this file.'
        : 'Images were not included.',
    },
    mediaFiles,
    data,
  };
}

export function backupFilename(now = new Date()): string {
  const stamp = now.toISOString().slice(0, 16).replace(/[:T]/g, '-');
  return `bsa-client-intelligence-backup-${stamp}.json`;
}

/** Triggers a browser download. The file contains whatever data is in this browser — handle it as confidential. */
export function downloadJson(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
