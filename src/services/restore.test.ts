// @vitest-environment node
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createDemoSeed } from '@/data/seed/demoSeed';
import { IndexedDbMediaStore } from '@/data/media/MediaStore';
import { addMedia } from '@/data/mutations';
import { SCHEMA_VERSION } from '@/data/schema';
import { buildBackup } from './backup';
import { parseBackup, restoreMedia, restorePreview } from './restore';
import { csvCell, toCsv } from './csv';

const headshot = (id: string) => ({ id, createdAt: '', updatedAt: '', archivedAt: null, clientId: null, ownerType: 'person' as const, ownerId: 'person_craig_puccetti', kind: 'headshot' as const, caption: '', credit: '', fileName: 'h.png', mime: 'image/png', width: 1, height: 1, bytes: 3 });

describe('backup restore', () => {
  it('round-trips data and images through a backup file', async () => {
    const source = new IndexedDbMediaStore('restore-src');
    const target = new IndexedDbMediaStore('restore-dst');
    const d = createDemoSeed();
    addMedia(d, headshot('img1'));
    await source.put('img1', new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }));
    await target.put('stale', new Blob([new Uint8Array([9])], { type: 'image/png' }));
    const text = JSON.stringify(await buildBackup(d, source));

    const r = parseBackup(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.backup.data.origin).toBe('restored');
    expect(r.backup.data.projects).toEqual(d.projects);
    const res = await restoreMedia(target, r.backup);
    expect(res).toEqual({ written: 1, removed: 1 });
    expect(new Uint8Array(await (await target.get('img1'))!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(await target.get('stale')).toBeNull();
  });

  it('rejects invalid, foreign, newer and broken files', () => {
    expect(parseBackup('{oops')).toEqual({ ok: false, errors: ['The file is not valid JSON.'] });
    expect(parseBackup(JSON.stringify({ client: {}, projects: [] })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ hello: 1 })).ok).toBe(false);
    const newer = { format: 'bsa-client-intelligence-backup', data: { ...createDemoSeed(), schemaVersion: SCHEMA_VERSION + 1 } };
    const r1 = parseBackup(JSON.stringify(newer));
    expect(!r1.ok && r1.errors[0]).toMatch(/newer version/);
    const orphan = createDemoSeed();
    orphan.actions[0].clientId = 'client_missing';
    const r2 = parseBackup(JSON.stringify({ format: 'bsa-client-intelligence-backup', data: orphan, mediaFiles: [] }));
    expect(!r2.ok && r2.errors.join(' ')).toMatch(/client that is not in the backup/);
    const dup = createDemoSeed();
    dup.actions[1].id = dup.actions[0].id;
    expect(parseBackup(JSON.stringify(dup)).ok).toBe(false);
  });

  it('upgrades an old (v1) dataset and warns about missing images', () => {
    const v1 = structuredClone(createDemoSeed()) as unknown as Record<string, unknown>;
    v1.schemaVersion = 1;
    for (const k of ['media', 'checklistTemplates', 'checklists']) delete v1[k];
    (v1.people as Record<string, unknown>[]).forEach((p) => delete p.homeClientId);
    const r = parseBackup(JSON.stringify(v1));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.backup.data.schemaVersion).toBe(SCHEMA_VERSION);
      expect(r.backup.warnings.join(' ')).toMatch(/raw dataset/);
      expect(r.backup.warnings.join(' ')).toMatch(/upgraded/);
    }
  });

  it('previews per-client changes', () => {
    const cur = createDemoSeed();
    const inc = createDemoSeed();
    inc.clients = inc.clients.filter((c) => c.id !== 'client_memorial_health');
    inc.actions.pop();
    const rows = restorePreview(cur, inc);
    expect(rows.find((r) => r.name === 'Memorial Health')!.change).toBe('removed');
    const hm = rows.find((r) => r.name === 'Houston Methodist')!;
    expect(hm.change).toBe('replaced');
    expect(hm.current!.actions - hm.incoming!.actions).toBe(1);
  });
});

describe('CSV export', () => {
  it('quotes and neutralizes formula injection', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell(-5)).toBe('-5');
    expect(csvCell(null)).toBe('');
    expect(toCsv([['a', 1], ['b', null]])).toBe('﻿a,1\r\nb,\r\n');
  });
});
