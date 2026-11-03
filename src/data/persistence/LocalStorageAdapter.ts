import type { Dataset } from '@/domain/types';
import type { StorageAdapter } from './StorageAdapter';

export const DATA_KEY = 'bsa-ci:dataset';

/** Browser-local persistence for Prototype Mode. Data stays on this device and browser profile only. */
export class LocalStorageAdapter implements StorageAdapter {
  readonly kind = 'local-browser' as const;
  readonly description = 'This browser only — not shared, not synchronized, not encrypted.';

  constructor(
    private readonly storage: Storage = window.localStorage,
    private readonly key: string = DATA_KEY,
  ) {}

  async load(): Promise<unknown | null> {
    const raw = this.storage.getItem(this.key);
    if (!raw) return null;
    return JSON.parse(raw);
  }

  async save(data: Dataset): Promise<void> {
    try {
      this.storage.setItem(this.key, JSON.stringify(data));
    } catch (err) {
      if (err instanceof DOMException && (err.name === 'QuotaExceededError' || err.code === 22)) {
        throw new Error('Browser storage is full. Export a backup and remove unused records or images.');
      }
      throw err;
    }
  }

  async clear(): Promise<void> {
    this.storage.removeItem(this.key);
  }

  async usage(): Promise<number | null> {
    const raw = this.storage.getItem(this.key);
    return raw ? new Blob([raw]).size : 0;
  }
}
