import { ImageOff } from 'lucide-react';
import { useMediaUrl } from '@/data/media/useMediaUrl';
import { cn } from '@/lib/cn';

/** Project cover image or a neutral placeholder. Never substitutes unrelated imagery. */
export function ProjectCover({ mediaId, className, alt, compact }: { mediaId: string | null; className?: string; alt: string; compact?: boolean }) {
  const url = useMediaUrl(mediaId);
  if (url) return <img src={url} alt={alt} className={cn('h-full w-full object-cover', className)} loading="lazy" />;
  return (
    <div className={cn('flex h-full w-full items-center justify-center bg-[repeating-linear-gradient(135deg,var(--surface-2)_0_12px,var(--surface-3)_12px_13px)] text-subtle', className)}>
      {compact ? (
        <ImageOff size={16} aria-label="No image" />
      ) : (
        <span className="flex flex-col items-center gap-1.5 text-xs">
          <ImageOff size={20} aria-hidden />
          No project image
        </span>
      )}
    </div>
  );
}
