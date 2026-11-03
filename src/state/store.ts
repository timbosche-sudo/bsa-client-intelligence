import { create } from 'zustand';
import { createDemoSeed } from '@/data/seed/demoSeed';
import { migrate, SchemaError } from '@/data/schema';
import type { StorageAdapter } from '@/data/persistence/StorageAdapter';
import { defaultClientConfig } from '@/domain/defaults';
import { newId, nowIso } from '@/domain/ids';
import type { Client, Dataset } from '@/domain/types';

export type LoadState = 'idle' | 'loading' | 'ready' | 'error';
/** Save status shown to the user. Only reports "saved" after the adapter has confirmed the write. */
export type SaveState = 'saved' | 'pending' | 'saving' | 'error';

interface DataState {
  loadState: LoadState;
  loadError: string | null;
  saveState: SaveState;
  saveError: string | null;
  lastSavedAt: string | null;
  data: Dataset | null;
  adapter: StorageAdapter | null;

  init(adapter: StorageAdapter): Promise<void>;
  /** Apply an immutable change to the dataset and schedule an autosave. */
  mutate(recipe: (draft: Dataset) => void, activity?: { clientId: string | null; entity: string; entityId: string | null; summary: string }): void;
  flush(): Promise<void>;
  resetToDemo(): Promise<void>;
  addClient(input: { name: string; shortName?: string; monogram?: string; sector?: string }): Client;
}

const SAVE_DEBOUNCE_MS = 400;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const useDataStore = create<DataState>((set, get) => ({
  loadState: 'idle',
  loadError: null,
  saveState: 'saved',
  saveError: null,
  lastSavedAt: null,
  data: null,
  adapter: null,

  async init(adapter) {
    if (get().loadState === 'loading' || get().loadState === 'ready') return;
    set({ loadState: 'loading', adapter });
    try {
      const raw = await adapter.load();
      if (raw === null) {
        const seed = createDemoSeed();
        await adapter.save(seed);
        set({ data: seed, loadState: 'ready', lastSavedAt: nowIso() });
        return;
      }
      const data = migrate(raw);
      set({ data, loadState: 'ready', lastSavedAt: data.savedAt });
    } catch (err) {
      const message =
        err instanceof SchemaError
          ? err.message
          : err instanceof SyntaxError
            ? 'Stored data is not valid JSON.'
            : err instanceof Error
              ? err.message
              : String(err);
      set({ loadState: 'error', loadError: message });
    }
  },

  mutate(recipe, activity) {
    const current = get().data;
    if (!current) return;
    const draft = structuredClone(current);
    recipe(draft);
    if (activity) {
      draft.activity.unshift({ id: newId('act'), at: nowIso(), actor: 'Prototype User', ...activity });
      draft.activity = draft.activity.slice(0, 500);
    }
    set({ data: draft, saveState: 'pending', saveError: null });
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void get().flush(), SAVE_DEBOUNCE_MS);
  },

  async flush() {
    const { data, adapter } = get();
    if (!data || !adapter) return;
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    set({ saveState: 'saving' });
    const savedAt = nowIso();
    try {
      await adapter.save({ ...data, savedAt });
      // Only mark saved if nothing changed while writing.
      if (get().data === data) set({ saveState: 'saved', lastSavedAt: savedAt });
    } catch (err) {
      set({ saveState: 'error', saveError: err instanceof Error ? err.message : String(err) });
    }
  },

  async resetToDemo() {
    const adapter = get().adapter;
    const seed = createDemoSeed();
    if (adapter) await adapter.save(seed);
    set({ data: seed, saveState: 'saved', saveError: null, lastSavedAt: nowIso(), loadState: 'ready', loadError: null });
  },

  addClient({ name, shortName, monogram, sector }) {
    const ts = nowIso();
    const client: Client = {
      id: newId('client'),
      createdAt: ts,
      updatedAt: ts,
      archivedAt: null,
      name: name.trim(),
      shortName: (shortName || name).trim(),
      clientCode: null,
      status: 'onboarding',
      sector: sector?.trim() || null,
      summary: '',
      strategicPriorities: [],
      relationshipLeadId: null,
      executiveSponsorId: null,
      monogram: (monogram || deriveMonogram(name)).toUpperCase().slice(0, 3),
      config: defaultClientConfig(),
    };
    get().mutate((d) => void d.clients.push(client), { clientId: client.id, entity: 'client', entityId: client.id, summary: `Created client workspace "${client.name}"` });
    return client;
  },
}));

export function deriveMonogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/* Flush pending writes when the tab is hidden or closed. */
if (typeof window !== 'undefined') {
  const flushNow = () => {
    if (useDataStore.getState().saveState === 'pending') void useDataStore.getState().flush();
  };
  window.addEventListener('pagehide', flushNow);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flushNow());
}
