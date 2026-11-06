/**
 * Where JSON backups are saved.
 *
 * Browsers with the File System Access API (Chrome, Edge on desktop):
 *  - a chosen backup folder: exports are written straight into it (permission is confirmed once per session);
 *  - otherwise a Save dialog that remembers the last folder used.
 * Other browsers (Safari, iPad): the normal download / share sheet.
 *
 * The folder handle is kept in this browser's IndexedDB. It is a permission grant, not a path, and never leaves the browser.
 */

interface WritableFile {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}
interface FileHandle {
  name: string;
  createWritable(): Promise<WritableFile>;
}
interface DirHandle {
  name: string;
  getFileHandle(name: string, opts: { create: boolean }): Promise<FileHandle>;
  queryPermission(opts: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(opts: { mode: 'readwrite' }): Promise<PermissionState>;
}
type PickerWindow = Window & {
  showSaveFilePicker?: (opts: unknown) => Promise<FileHandle>;
  showDirectoryPicker?: (opts: unknown) => Promise<DirHandle>;
};

const DB = 'bsa-ci-settings';
const STORE = 'kv';
const KEY = 'backupFolder';
const PICKER_ID = 'bsa-ci-backups';

const w = () => window as PickerWindow;
/** Session cache, so the stored handle is read from IndexedDB at most once per page load. */
let cached: DirHandle | null | undefined;

export function canChooseLocation(): boolean {
  return typeof window !== 'undefined' && typeof w().showSaveFilePicker === 'function' && typeof w().showDirectoryPicker === 'function' && window.self === window.top;
}

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function kv<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const req = fn(d.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

export async function getBackupFolder(): Promise<DirHandle | null> {
  if (!canChooseLocation()) return null;
  if (cached !== undefined) return cached;
  try {
    cached = (await kv<DirHandle | undefined>('readonly', (s) => s.get(KEY))) ?? null;
  } catch {
    cached = null;
  }
  return cached;
}

/** Opens the folder picker. Returns the folder name, or null if cancelled. */
export async function chooseBackupFolder(): Promise<string | null> {
  try {
    const h = await w().showDirectoryPicker!({ id: PICKER_ID, mode: 'readwrite' });
    cached = h;
    await kv('readwrite', (s) => s.put(h, KEY)).catch(() => undefined); // remembered across visits where supported
    return h.name;
  } catch (e) {
    if ((e as DOMException)?.name === 'AbortError') return null;
    throw e;
  }
}

export async function clearBackupFolder(): Promise<void> {
  cached = null;
  await kv('readwrite', (s) => s.delete(KEY)).catch(() => undefined);
}

export type BackupTarget =
  | { kind: 'folder'; folder: string; write(name: string, blob: Blob): Promise<string> }
  | { kind: 'file'; write(name: string, blob: Blob): Promise<string> }
  | { kind: 'download' }
  | { kind: 'cancelled' };

const writeTo = async (fh: FileHandle, blob: Blob) => {
  const out = await fh.createWritable();
  await out.write(blob);
  await out.close();
};

/**
 * Resolves where to save BEFORE the backup is built: pickers and permission prompts must run while the
 * user's click is still "fresh" (browsers require a recent user gesture).
 */
export async function resolveBackupTarget(suggestedName: string): Promise<BackupTarget> {
  if (!canChooseLocation()) return { kind: 'download' };
  const folder = await getBackupFolder();
  if (folder) {
    try {
      let perm = await folder.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') perm = await folder.requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        return {
          kind: 'folder',
          folder: folder.name,
          write: async (name, blob) => {
            await writeTo(await folder.getFileHandle(name, { create: true }), blob);
            return `${folder.name}/${name}`;
          },
        };
      }
      // Permission declined: fall through to the Save dialog.
    } catch {
      // Folder moved or deleted: forget it and ask instead.
      await clearBackupFolder();
    }
  }
  try {
    const fh = await w().showSaveFilePicker!({ id: PICKER_ID, suggestedName, types: [{ description: 'BSA Client Intelligence backup', accept: { 'application/json': ['.json'] } }] });
    return { kind: 'file', write: async (_name, blob) => (await writeTo(fh, blob), fh.name) };
  } catch (e) {
    if ((e as DOMException)?.name === 'AbortError') return { kind: 'cancelled' };
    return { kind: 'download' };
  }
}
