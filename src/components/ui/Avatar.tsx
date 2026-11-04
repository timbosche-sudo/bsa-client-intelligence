import { User } from 'lucide-react';
import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';

const sizes = { sm: 'size-8 text-[11px]', md: 'size-10 text-xs', lg: 'size-14 text-sm', xl: 'size-24 text-xl' };

/** Circular avatar with initials or a placeholder when no headshot is available. */
export function Avatar({ name, src, size = 'md', className }: { name: string | null; src?: string | null; size?: keyof typeof sizes; className?: string }) {
  const base = cn('inline-flex aspect-square shrink-0 items-center justify-center overflow-hidden rounded-full font-bold', sizes[size], className);
  if (src) return <img src={src} alt={name ?? ''} className={cn(base, 'object-cover')} />;
  if (!name)
    return (
      <span className={cn(base, 'border border-dashed border-line-strong text-subtle')} role="img" aria-label="Unassigned">
        <User size={size === 'sm' ? 14 : 18} aria-hidden />
      </span>
    );
  return (
    <span className={cn(base, 'bg-surface-3 text-ink ring-1 ring-line')} aria-hidden>
      {initials(name)}
    </span>
  );
}
