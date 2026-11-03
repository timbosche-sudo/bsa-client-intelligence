/**
 * Binary storage for images. Prototype: IndexedDB in this browser.
 * Production: Azure Blob Storage behind an authenticated API (short-lived SAS URLs).
 */
export interface MediaStore {
  put(id: string, blob: Blob): Promise<void>;
  get(id: string): Promise<Blob | null>;
  delete(id: string): Promise<void>;
  keys(): Promise<string[]>;
}

const DB_NAME = 'bsa-ci-media';
const STORE = 'blobs';

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export class IndexedDbMediaStore implements MediaStore {
  private db: Promise<IDBDatabase> | null = null;
  constructor(private readonly dbName = DB_NAME) {}

  private open(): Promise<IDBDatabase> {
    if (!this.db) {
      this.db = new Promise((resolve, reject) => {
        const r = indexedDB.open(this.dbName, 1);
        r.onupgradeneeded = () => r.result.createObjectStore(STORE);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error ?? new Error('IndexedDB is unavailable in this browser.'));
      });
    }
    return this.db;
  }

  private async tx(mode: IDBTransactionMode) {
    return (await this.open()).transaction(STORE, mode).objectStore(STORE);
  }

  async put(id: string, blob: Blob) {
    // Store as ArrayBuffer + type: Safari has historically had issues persisting Blobs in IndexedDB.
    const buf = await blob.arrayBuffer();
    await req((await this.tx('readwrite')).put({ type: blob.type, buf }, id));
  }
  async get(id: string) {
    const v = (await req((await this.tx('readonly')).get(id))) as { type: string; buf: ArrayBuffer } | undefined;
    return v ? new Blob([v.buf], { type: v.type }) : null;
  }
  async delete(id: string) {
    await req((await this.tx('readwrite')).delete(id));
  }
  async keys() {
    return (await req((await this.tx('readonly')).getAllKeys())).map(String);
  }
}

let instance: MediaStore | null = null;
export const mediaStore = (): MediaStore => (instance ??= new IndexedDbMediaStore());
/** For tests. */
export const setMediaStore = (s: MediaStore) => {
  instance = s;
};
