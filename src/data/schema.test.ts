import { describe, expect, it } from 'vitest';
import { migrate, SCHEMA_VERSION, SchemaError } from './schema';
import { createDemoSeed } from './seed/demoSeed';
import { LocalStorageAdapter } from './persistence/LocalStorageAdapter';

describe('schema migration & validation', () => {
  it('accepts the current seed', () => {
    expect(migrate(createDemoSeed()).schemaVersion).toBe(SCHEMA_VERSION);
  });
  it('rejects data from a newer app version', () => {
    expect(() => migrate({ ...createDemoSeed(), schemaVersion: SCHEMA_VERSION + 1 })).toThrow(SchemaError);
  });
  it('rejects records without a clientId in scoped collections', () => {
    const d = createDemoSeed() as unknown as Record<string, unknown[]>;
    d.projects = [{ id: 'x' }];
    expect(() => migrate(d)).toThrow(/projects/);
  });
  it('rejects non-objects', () => {
    expect(() => migrate(null)).toThrow(SchemaError);
    expect(() => migrate('text')).toThrow(SchemaError);
  });
});

describe('LocalStorageAdapter', () => {
  it('round-trips the dataset', async () => {
    localStorage.clear();
    const adapter = new LocalStorageAdapter(localStorage, 'test-key');
    expect(await adapter.load()).toBeNull();
    const seed = createDemoSeed();
    await adapter.save(seed);
    expect(migrate(await adapter.load())).toEqual(seed);
    expect(await adapter.usage()).toBeGreaterThan(0);
    await adapter.clear();
    expect(await adapter.load()).toBeNull();
  });
});
