import { useEffect, useState } from 'react';
import { mediaStore } from './MediaStore';

const cache = new Map<string, string>();

/** Resolves a media id to an object URL (cached for the session). */
export function useMediaUrl(id: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(id ? cache.get(id) ?? null : null);
  useEffect(() => {
    let alive = true;
    if (!id) return setUrl(null);
    const hit = cache.get(id);
    if (hit) return setUrl(hit);
    void mediaStore()
      .get(id)
      .then((blob) => {
        if (!blob || !alive) return;
        const u = URL.createObjectURL(blob);
        cache.set(id, u);
        setUrl(u);
      })
      .catch(() => alive && setUrl(null));
    return () => {
      alive = false;
    };
  }, [id]);
  return url;
}

export function forgetMediaUrl(id: string) {
  const u = cache.get(id);
  if (u) URL.revokeObjectURL(u);
  cache.delete(id);
}
