import { Hammer } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Honest notice for capability that is scheduled for a later build stage. */
export function StageNotice({ stage, children, className }: { stage: number; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start gap-3 rounded-lg border border-dashed border-line-strong bg-surface-2/60 px-4 py-3 text-sm text-muted', className)} role="note">
      <Hammer size={16} className="mt-0.5 shrink-0 text-subtle" aria-hidden />
      <div>
        <span className="font-medium text-ink">Planned for Stage {stage}. </span>
        {children}
      </div>
    </div>
  );
}

export function StageTag({ stage }: { stage: number }) {
  return <span className="rounded border border-line px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-subtle">Stage {stage}</span>;
}
