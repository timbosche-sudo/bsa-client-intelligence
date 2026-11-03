import { cn } from '@/lib/cn';

/**
 * TEMPORARY typographic placeholder — NOT the official BSA LifeStructures logo.
 * Replace this component's contents with the approved logo asset when brand files are supplied.
 */
export function Wordmark({ compact, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5 select-none', className)} title="Temporary wordmark — official BSA logo pending">
      <span className="flex h-8 min-w-8 items-center justify-center rounded-md border border-line-strong px-1.5 text-[13px] font-bold tracking-[0.08em] text-ink">
        BSA
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-[13px] font-semibold tracking-tight text-ink">Client Intelligence</span>
          <span className="block text-[10px] uppercase tracking-[0.16em] text-subtle">BSA LifeStructures</span>
        </span>
      )}
    </div>
  );
}
