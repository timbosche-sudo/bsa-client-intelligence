import { FlaskConical, ShieldCheck } from 'lucide-react';
import { environment } from '@/config/environment';
import { cn } from '@/lib/cn';

/** Environment indicator. Prototype Mode = browser-local data, no authentication. */
export function PrototypeBadge({ variant = 'pill', className }: { variant?: 'pill' | 'panel'; className?: string }) {
  const prototype = environment.mode === 'prototype';
  if (variant === 'panel') {
    return (
      <div className={cn('rounded-lg border px-3 py-2.5 text-xs', prototype ? 'border-caution/30 bg-caution-soft' : 'border-positive/30 bg-positive-soft', className)}>
        <p className={cn('flex items-center gap-1.5 font-semibold', prototype ? 'text-caution' : 'text-positive')}>
          {prototype ? <FlaskConical size={13} aria-hidden /> : <ShieldCheck size={13} aria-hidden />}
          {prototype ? 'Prototype Mode' : 'Production'}
        </p>
        {prototype && <p className="mt-1 leading-snug text-muted">Data is saved in this browser only. No sign-in or access control.</p>}
      </div>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold uppercase tracking-wide',
        prototype ? 'border-caution/30 bg-caution-soft text-caution' : 'border-positive/30 bg-positive-soft text-positive',
        className,
      )}
      title={prototype ? 'Prototype Mode: browser-local data, no authentication' : 'Production'}
    >
      {prototype ? <FlaskConical size={12} aria-hidden /> : <ShieldCheck size={12} aria-hidden />}
      {prototype ? 'Prototype' : 'Production'}
    </span>
  );
}
