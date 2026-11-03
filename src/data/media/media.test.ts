// @vitest-environment node
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { IndexedDbMediaStore } from './MediaStore';
import { base64ToBlob, buildBackup } from '@/services/backup';
import { createDemoSeed } from '../seed/demoSeed';
import { addMedia } from '../mutations';

describe('IndexedDbMediaStore', () => {
  it('stores, lists and deletes blobs', async () => {
    const store = new IndexedDbMediaStore('test-media-1');
    await store.put('a', new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' }));
    const got = await store.get('a');
    expect(got?.type).toBe('image/webp');
    expect(new Uint8Array(await got!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(await store.keys()).toEqual(['a']);
    await store.delete('a');
    expect(await store.get('a')).toBeNull();
  });
});

describe('backup with media', () => {
  it('embeds referenced images and reports missing ones', async () => {
    const store = new IndexedDbMediaStore('test-media-2');
    const d = createDemoSeed();
    const rec = (id: string) => ({ id, createdAt: '', updatedAt: '', archivedAt: null, clientId: null, ownerType: 'person' as const, ownerId: 'person_craig_puccetti', kind: 'headshot' as const, caption: '', credit: '', fileName: 'h', mime: 'image/png', width: 1, height: 1, bytes: 3 });
    addMedia(d, rec('present'));
    d.media.push(rec('missing'));
    await store.put('present', new Blob([new Uint8Array([9, 8, 7])], { type: 'image/png' }));
    const backup = await buildBackup(d, store);
    expect(backup.mediaFiles).toHaveLength(1);
    expect(backup.media.missing).toEqual(['missing']);
    const restored = base64ToBlob(backup.mediaFiles[0].data, backup.mediaFiles[0].mime);
    expect(new Uint8Array(await restored.arrayBuffer())).toEqual(new Uint8Array([9, 8, 7]));
    expect(JSON.parse(JSON.stringify(backup)).data.media).toHaveLength(2);
  });
});
