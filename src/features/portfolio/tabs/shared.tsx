import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { TBC } from '@/lib/format';

/** Definition list row that shows "To Be Confirmed" for unknown values. */
export function DL({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn('grid gap-x-6 gap-y-4 sm:grid-cols-2', className)}>{children}</dl>;
}

export function DI({ label, value, tabular, wide }: { label: string; value: ReactNode | null | undefined; tabular?: boolean; wide?: boolean }) {
  const empty = value === null || value === undefined || value === '';
  return (
    <div className={cn('min-w-0', wide && 'sm:col-span-2')}>
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className={cn('mt-0.5 text-sm', tabular && 'tabular', empty && 'text-subtle')}>{empty ? TBC : value}</dd>
    </div>
  );
}

export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="border-t border-line-strong pt-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="eyebrow text-ink">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}
