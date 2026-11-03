import { mediaStore } from '@/data/media/MediaStore';
import { useDataStore } from '@/state/store';
import { toast } from '@/state/toast';
import { backupFilename, buildBackup, downloadJson } from './backup';

/** Flushes pending edits, then downloads a full backup including embedded images. */
export async function exportFullBackup(): Promise<void> {
  try {
    await useDataStore.getState().flush();
    const data = useDataStore.getState().data;
    if (!data) return;
    const backup = await buildBackup(data, mediaStore());
    downloadJson(backupFilename(), backup);
    toast(backup.media.missing.length ? `Backup exported. ${backup.media.note}` : `Backup exported with ${backup.media.count} image(s).`, backup.media.missing.length ? 'info' : 'success');
  } catch (err) {
    toast(`Backup failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
  }
}
