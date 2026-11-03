import { cn } from '@/lib/cn';
import { Logo, hasOfficialLogo } from './Logo';

/**
 * Application identity: official BSA logo (when supplied) + product name, separated by clear space.
 * Without the official file, a plain-text product name is shown. It deliberately does NOT imitate the logo.
 */
export function Wordmark({ compact, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center select-none', className)}>
      {hasOfficialLogo && <Logo height={compact ? 18 : 22} className={compact ? '' : 'mr-3 border-r border-line pr-3'} />}
      {(!compact || !hasOfficialLogo) && (
        <span className="leading-tight">
          {!hasOfficialLogo && <span className={cn('block font-black tracking-tight text-ink', compact ? 'text-xs' : 'text-[15px]')}>BSA</span>}
          {!compact && <span className="block text-[11px] uppercase tracking-[0.14em] text-muted">Client Intelligence</span>}
        </span>
      )}
    </div>
  );
}
