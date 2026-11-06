import { mediaStore } from '@/data/media/MediaStore';
import { useDataStore } from '@/state/store';
import { toast } from '@/state/toast';
import { backupFilename, buildBackup, downloadJson } from './backup';
import { resolveBackupTarget } from './backupLocation';

/**
 * Saves a full backup including embedded images: into the chosen backup folder, via a Save dialog, or as a
 * download, depending on what this browser supports (see backupLocation.ts).
 */
export async function exportFullBackup(): Promise<void> {
  try {
    const name = backupFilename();
    const target = await resolveBackupTarget(name);
    if (target.kind === 'cancelled') return;
    await useDataStore.getState().flush();
    const data = useDataStore.getState().data;
    if (!data) return;
    const backup = await buildBackup(data, mediaStore());
    let where = 'your Downloads folder';
    if (target.kind === 'download') downloadJson(name, backup);
    else where = await target.write(name, new Blob([JSON.stringify(backup)], { type: 'application/json' }));
    const images = backup.media.missing.length ? ` ${backup.media.note}` : ` (${backup.media.count} image${backup.media.count === 1 ? '' : 's'} included)`;
    toast(`Backup saved to ${where}.${images}`, backup.media.missing.length ? 'info' : 'success');
  } catch (err) {
    toast(`Backup failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
  }
}
