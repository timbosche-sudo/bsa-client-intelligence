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

describe('v1 → v2 migration', () => {
  it('adds media, person homeClientId and project documentLinks without losing data', () => {
    const v1 = structuredClone(createDemoSeed()) as unknown as Record<string, unknown>;
    v1.schemaVersion = 1;
    delete v1.media;
    (v1.people as Record<string, unknown>[]).forEach((p) => delete p.homeClientId);
    (v1.projects as Record<string, unknown>[]).forEach((p) => delete p.documentLinks);
    const migrated = migrate(v1);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.media).toEqual([]);
    expect(migrated.people.every((p) => p.homeClientId === null)).toBe(true);
    expect(migrated.projects.every((p) => Array.isArray(p.documentLinks))).toBe(true);
    expect(migrated.projects).toHaveLength(createDemoSeed().projects.length);
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
