import { useCallback, useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { renderImage, type CropRect } from '@/services/images';

const VIEW = 288; // on-screen crop viewport (px)
const OUTPUT = 600; // stored headshot size (px)

interface Props {
  image: HTMLImageElement | null;
  onCancel(): void;
  onConfirm(result: { blob: Blob; width: number; height: number }): void;
}

/**
 * Square crop with a circular guide. Brand Guide p.33: headshots need headroom to sit in a circle frame.
 * Drag (mouse/touch/pen) to position, slider / wheel / pinch to zoom.
 */
export function HeadshotCropper({ image, onCancel, onConfirm }: Props) {
  const [scale, setScale] = useState(1);
  const [minScale, setMinScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; scale: number } | null>(null);

  // Initialize: cover the viewport, centered horizontally, biased to the upper third (faces).
  useEffect(() => {
    if (!image) return;
    const s = VIEW / Math.min(image.naturalWidth, image.naturalHeight);
    setMinScale(s);
    setScale(s);
    setPos({ x: (VIEW - image.naturalWidth * s) / 2, y: Math.min(0, (VIEW - image.naturalHeight * s) / 3) });
  }, [image]);

  const clamp = useCallback(
    (p: { x: number; y: number }, s: number) => {
      if (!image) return p;
      const w = image.naturalWidth * s;
      const h = image.naturalHeight * s;
      return { x: Math.min(0, Math.max(VIEW - w, p.x)), y: Math.min(0, Math.max(VIEW - h, p.y)) };
    },
    [image],
  );

  const zoomTo = useCallback(
    (next: number) => {
      const s = Math.max(minScale, Math.min(minScale * 5, next));
      // Zoom around the viewport centre.
      setPos((p) => clamp({ x: VIEW / 2 - ((VIEW / 2 - p.x) * s) / scale, y: VIEW / 2 - ((VIEW / 2 - p.y) * s) / scale }, s));
      setScale(s);
    },
    [minScale, scale, clamp],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      zoomTo((pinch.current.scale * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.current.dist);
      return;
    }
    setPos((p) => clamp({ x: p.x + e.clientX - prev.x, y: p.y + e.clientY - prev.y }, scale));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = 10;
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[e.key]) {
      e.preventDefault();
      setPos((p) => clamp({ x: p.x + moves[e.key][0], y: p.y + moves[e.key][1] }, scale));
    }
    if (e.key === '+' || e.key === '=') zoomTo(scale * 1.1);
    if (e.key === '-') zoomTo(scale / 1.1);
  };

  const confirm = async () => {
    if (!image) return;
    setBusy(true);
    try {
      const crop: CropRect = { x: -pos.x / scale, y: -pos.y / scale, width: VIEW / scale, height: VIEW / scale };
      onConfirm(await renderImage(image, crop, OUTPUT, 0.86));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={!!image}
      onClose={onCancel}
      title="Position headshot"
      description="Drag to position. Leave space above the head so the photo sits well in a circle."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={confirm} disabled={busy}>{busy ? 'Saving…' : 'Use photo'}</Button>
        </>
      }
    >
      {image && (
        <div className="flex flex-col items-center gap-4">
          <div
            role="application"
            aria-label="Headshot crop area. Use arrow keys to move, plus and minus to zoom."
            tabIndex={0}
            onKeyDown={onKeyDown}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={(e) => zoomTo(scale * (e.deltaY < 0 ? 1.06 : 1 / 1.06))}
            className="relative cursor-grab touch-none overflow-hidden bg-surface-3 active:cursor-grabbing"
            style={{ width: VIEW, height: VIEW }}
          >
            <img
              src={image.src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute left-0 top-0 max-w-none origin-top-left select-none"
              style={{ width: image.naturalWidth * scale, height: image.naturalHeight * scale, transform: `translate(${pos.x}px, ${pos.y}px)` }}
            />
            {/* Circular guide: darken outside the circle */}
            <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_999px_rgb(0_0_0/0.55)] ring-2 ring-white/80" aria-hidden />
          </div>
          <div className="flex w-full max-w-[288px] items-center gap-3">
            <button type="button" onClick={() => zoomTo(scale / 1.15)} className="inline-flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface-3" aria-label="Zoom out">
              <ZoomOut size={18} />
            </button>
            <input type="range" min={minScale} max={minScale * 5} step={minScale / 100} value={scale} onChange={(e) => zoomTo(Number(e.target.value))} aria-label="Zoom" className="h-11 flex-1 accent-[var(--accent)]" />
            <button type="button" onClick={() => zoomTo(scale * 1.15)} className="inline-flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface-3" aria-label="Zoom in">
              <ZoomIn size={18} />
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
