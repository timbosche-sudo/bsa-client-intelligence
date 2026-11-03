/** Image validation, cropping and compression (browser canvas). */

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const ACCEPT_ATTR = ACCEPTED_IMAGE_TYPES.join(',');
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export class ImageValidationError extends Error {}

export function validateImageFile(file: { type: string; size: number; name: string }): void {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    throw new ImageValidationError(`"${file.name}" is not a supported image. Use JPEG, PNG or WebP.`);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ImageValidationError(`"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB. The maximum is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
  }
  if (file.size === 0) throw new ImageValidationError(`"${file.name}" is empty.`);
}

/**
 * Decodes an image file. The returned element keeps its blob URL alive (it may be displayed);
 * call releaseImage() when finished.
 */
export async function loadImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } catch {
    URL.revokeObjectURL(url);
    throw new ImageValidationError('The image could not be read. It may be corrupted.');
  }
}

export function releaseImage(img: HTMLImageElement | null | undefined): void {
  if (img?.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Fits (w,h) inside a box of maxEdge on the long side, never upscaling. */
export function fitWithin(w: number, h: number, maxEdge: number): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

async function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const tryType = (type: string) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, quality));
  const webp = await tryType('image/webp');
  if (webp && webp.type === 'image/webp') return webp;
  const jpeg = await tryType('image/jpeg');
  if (!jpeg) throw new Error('This browser could not encode the image.');
  return jpeg;
}

/** Draws the crop region of `img` into an output of at most maxEdge px and compresses it (WebP, JPEG fallback). */
export async function renderImage(img: HTMLImageElement, crop: CropRect | null, maxEdge: number, quality = 0.85) {
  const src = crop ?? { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight };
  const out = fitWithin(src.width, src.height, maxEdge);
  const canvas = document.createElement('canvas');
  canvas.width = out.width;
  canvas.height = out.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, src.x, src.y, src.width, src.height, 0, 0, out.width, out.height);
  const blob = await canvasToBlob(canvas, quality);
  return { blob, width: out.width, height: out.height };
}
