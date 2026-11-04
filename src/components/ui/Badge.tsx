import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type Tone = 'neutral' | 'accent' | 'positive' | 'caution' | 'negative' | 'outline' | 'overlay';

const tones: Record<Tone, string> = {
  neutral: 'bg-surface-3 text-muted',
  // Brand rule: text on brand-colored fills is black or white only (p.20).
  accent: 'bg-bsa-teal text-black',
  positive: 'bg-bsa-green text-black',
  caution: 'bg-bsa-yellow text-black',
  negative: 'bg-brand text-white',
  outline: 'border border-line text-muted',
  // For labels laid over images: fixed dark chip in both themes.
  overlay: 'bg-black/80 text-white',
};

export function Badge({ tone = 'neutral', children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold leading-5', tones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}
