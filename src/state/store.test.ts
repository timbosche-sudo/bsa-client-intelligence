import { beforeEach, describe, expect, it } from 'vitest';
import { LocalStorageAdapter } from '@/data/persistence/LocalStorageAdapter';
import { deriveMonogram, useDataStore } from './store';

const fresh = () =>
  useDataStore.setState({ loadState: 'idle', data: null, adapter: null, saveState: 'saved', saveError: null, lastSavedAt: null, loadError: null });

describe('data store', () => {
  beforeEach(() => {
    localStorage.clear();
    fresh();
  });

  it('seeds demo data on first run and persists it', async () => {
    const adapter = new LocalStorageAdapter(localStorage, 'k1');
    await useDataStore.getState().init(adapter);
    expect(useDataStore.getState().loadState).toBe('ready');
    expect(await adapter.load()).not.toBeNull();
  });

  it('reports pending until a save completes, and survives reload', async () => {
    const adapter = new LocalStorageAdapter(localStorage, 'k2');
    await useDataStore.getState().init(adapter);
    const client = useDataStore.getState().addClient({ name: 'Example Health System' });
    expect(useDataStore.getState().saveState).toBe('pending');
    await useDataStore.getState().flush();
    expect(useDataStore.getState().saveState).toBe('saved');

    fresh();
    await useDataStore.getState().init(adapter);
    const reloaded = useDataStore.getState().data!.clients.find((c) => c.id === client.id);
    expect(reloaded?.name).toBe('Example Health System');
    expect(reloaded?.monogram).toBe('EH');
    expect(reloaded?.config.portfolioCategories.length).toBeGreaterThan(0);
    expect(useDataStore.getState().data!.activity[0].summary).toContain('Example Health System');
  });

  it('surfaces load errors instead of overwriting unreadable data', async () => {
    localStorage.setItem('k3', '{not json');
    await useDataStore.getState().init(new LocalStorageAdapter(localStorage, 'k3'));
    expect(useDataStore.getState().loadState).toBe('error');
    expect(localStorage.getItem('k3')).toBe('{not json');
  });

  it('derives monograms', () => {
    expect(deriveMonogram('Memorial Health')).toBe('MH');
    expect(deriveMonogram('Mayo')).toBe('MA');
  });
});
