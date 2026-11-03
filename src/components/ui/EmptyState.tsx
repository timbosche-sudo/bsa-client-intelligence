import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function EmptyState({ icon, title, children, action, className, compact }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode; className?: string; compact?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'gap-1.5 py-4' : 'gap-3 py-10', className)}>
      {icon && <div className="flex size-10 items-center justify-center rounded-full bg-surface-3 text-subtle">{icon}</div>}
      <p className={cn('font-medium', compact ? 'text-sm text-muted' : 'text-ink')}>{title}</p>
      {children && <div className="max-w-md text-sm text-subtle">{children}</div>}
      {action}
    </div>
  );
}
