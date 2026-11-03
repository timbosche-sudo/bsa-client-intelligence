import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconOnly?: boolean;
}

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-brand-contrast hover:bg-brand-strong font-bold',
  secondary: 'bg-surface-2 text-ink border border-line hover:border-line-strong hover:bg-surface-3',
  ghost: 'text-muted hover:text-ink hover:bg-surface-3',
  danger: 'bg-transparent text-ink border border-brand hover:bg-negative-soft font-bold',
};

// Every size keeps a ≥44px touch target on coarse pointers.
const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5 pointer-coarse:h-11',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-base gap-2.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, iconOnly, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg transition-colors select-none',
        'disabled:cursor-not-allowed disabled:opacity-45',
        variants[variant],
        sizes[size],
        iconOnly && 'aspect-square px-0',
        className,
      )}
      {...rest}
    >
      {icon}
      {!iconOnly && children}
    </button>
  );
});
