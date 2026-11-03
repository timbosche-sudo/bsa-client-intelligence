import { environment } from '@/config/environment';
import type { Dataset } from '@/domain/types';

export const BACKUP_FORMAT = 'bsa-client-intelligence-backup';

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  appVersion: string;
  schemaVersion: number;
  exportedAt: string;
  scope: { kind: 'all-clients' } | { kind: 'single-client'; clientId: string };
  media: { included: boolean; note: string };
  data: Dataset;
}

export function buildBackup(data: Dataset, now = new Date()): BackupFile {
  return {
    format: BACKUP_FORMAT,
    appVersion: environment.appVersion,
    schemaVersion: data.schemaVersion,
    exportedAt: now.toISOString(),
    scope: { kind: 'all-clients' },
    media: {
      included: false,
      note: 'Stage 1: no media assets exist yet. Image upload (Stage 2) will add embedded media to backups.',
    },
    data,
  };
}

export function backupFilename(now = new Date()): string {
  const stamp = now.toISOString().slice(0, 16).replace(/[:T]/g, '-');
  return `bsa-client-intelligence-backup-${stamp}.json`;
}

/** Triggers a browser download. The file contains whatever data is in this browser — handle it as confidential. */
export function downloadJson(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
