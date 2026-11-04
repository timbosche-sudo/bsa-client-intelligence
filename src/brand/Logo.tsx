import { cn } from '@/lib/cn';
import { usePreferences } from '@/state/preferences';

/**
 * Official BSA logo slot. Files are resolved at build time from src/brand/assets/.
 * See src/brand/assets/README.md — files must come from Open Asset, never be recreated.
 */
const files = import.meta.glob('./assets/bsa-logo-*.{svg,png}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const find = (variant: 'white' | 'red') => Object.entries(files).find(([k]) => k.includes(`bsa-logo-${variant}.`))?.[1] ?? null;

export const officialLogo = { white: find('white'), red: find('red') };
export const hasOfficialLogo = !!(officialLogo.white || officialLogo.red);

/** Renders the official logo for the current theme: white on dark, red on light (Brand Guide p.11). */
export function Logo({ height = 22, className, variant }: { height?: number; className?: string; /** Force a version, e.g. red on a white document regardless of theme. */ variant?: 'red' | 'white' }) {
  const theme = usePreferences((s) => s.theme);
  const want = variant ?? (theme === 'dark' ? 'white' : 'red');
  const src = officialLogo[want];
  if (!src) return null;
  return <img src={src} alt="BSA" style={{ height }} className={cn('block w-auto select-none', className)} draggable={false} />;
}
