import type { Dataset } from '@/domain/types';

/**
 * Persistence boundary. The UI and store never talk to localStorage directly.
 *
 * Prototype Mode: LocalStorageAdapter (this browser only, not shared, not encrypted).
 * Production (future): an HTTP adapter backed by BSA-approved Azure services, authenticated with
 * Microsoft Entra ID tokens acquired server-side or via MSAL. The interface is async to allow that swap.
 */
export interface StorageAdapter {
  readonly kind: 'local-browser' | 'remote-api';
  readonly description: string;
  load(): Promise<unknown | null>;
  save(data: Dataset): Promise<void>;
  clear(): Promise<void>;
  /** Approximate bytes used, if measurable. */
  usage(): Promise<number | null>;
}
