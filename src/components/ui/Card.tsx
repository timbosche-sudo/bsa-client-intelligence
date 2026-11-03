import type { HTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-xl border border-line bg-surface shadow-panel', className)} {...rest} />;
}

interface PanelProps {
  title: string;
  eyebrow?: string;
  icon?: ReactNode;
  /** When set, the header links into the corresponding detail section. */
  to?: string;
  linkLabel?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/** Dashboard panel with a header that navigates into the related module. */
export function Panel({ title, eyebrow, icon, to, linkLabel = 'View all', actions, children, className, bodyClassName }: PanelProps) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <header className="flex items-center gap-3 border-b border-line px-5 py-3.5">
        {icon && <span className="text-accent">{icon}</span>}
        <div className="min-w-0 flex-1">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2 className="truncate text-[15px] font-bold tracking-tight">{title}</h2>
        </div>
        {actions}
        {to && (
          <Link
            to={to}
            className="-mr-2 inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted hover:text-accent"
          >
            {linkLabel}
            <ChevronRight size={14} aria-hidden />
          </Link>
        )}
      </header>
      <div className={cn('flex-1 p-5', bodyClassName)}>{children}</div>
    </Card>
  );
}
