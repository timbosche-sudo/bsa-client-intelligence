import { useId, useRef, useState, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

const control =
  'w-full rounded-lg border border-line bg-surface px-3 text-base text-ink outline-none transition-colors placeholder:text-subtle hover:border-line-strong focus:border-accent aria-[invalid=true]:border-brand disabled:opacity-50 sm:text-sm';

interface FieldShellProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string; required?: boolean }) => ReactNode;
}

/** Label + control + hint/error. Errors use a red marker with readable text (red text fails contrast on black). */
export function Field({ label, hint, error, required, className, children }: FieldShellProps) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-bold">
        {label}
        {required && (
          <span className="ml-0.5 text-brand" aria-hidden>
            *
          </span>
        )}
      </label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': describedBy, required })}
      {error ? <FieldError id={`${id}-err`}>{error}</FieldError> : hint ? <p id={`${id}-hint`} className="text-xs text-subtle">{hint}</p> : null}
    </div>
  );
}

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="flex items-start gap-1.5 text-xs text-ink">
      <AlertCircle size={14} className="mt-px shrink-0 fill-brand text-white" aria-hidden />
      {children}
    </p>
  );
}

type Base = { label: string; hint?: ReactNode; error?: string; required?: boolean; className?: string };

export function TextField({ label, hint, error, required, className, value, onChange, ...rest }: Base & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: string | null | undefined; onChange(v: string): void }) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {(p) => <input {...p} {...rest} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={cn(control, 'h-12')} />}
    </Field>
  );
}

export function TextArea({ label, hint, error, required, className, value, onChange, rows = 3, ...rest }: Base & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & { value: string | null | undefined; onChange(v: string): void }) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {(p) => <textarea {...p} {...rest} rows={rows} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={cn(control, 'py-2.5 leading-relaxed')} />}
    </Field>
  );
}

export interface Option {
  value: string;
  label: string;
  disabled?: boolean;
}

export function SelectField({ label, hint, error, required, className, value, onChange, options, placeholder, ...rest }: Base & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'> & { value: string | null | undefined; onChange(v: string): void; options: Option[]; placeholder?: string }) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {(p) => (
        <select {...p} {...rest} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={cn(control, 'h-12 appearance-none bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-9', "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23939598' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]")}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

/**
 * Numeric input that keeps `null` for empty (never coerces blank to 0).
 * `scale` converts between stored and displayed values (e.g. fraction 0.5 ↔ 50 %).
 */
export function NumberField({ label, hint, error, required, className, value, onChange, prefix, suffix, scale = 1, step, min, max, placeholder }: Base & { value: number | null | undefined; onChange(v: number | null): void; prefix?: string; suffix?: string; scale?: number; step?: number; min?: number; max?: number; placeholder?: string }) {
  const display = value === null || value === undefined ? '' : String(+(value * scale).toFixed(6));
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {(p) => (
        <div className="relative">
          {prefix && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-subtle">{prefix}</span>}
          <input
            {...p}
            type="number"
            inputMode="decimal"
            step={step ?? 'any'}
            min={min}
            max={max}
            placeholder={placeholder}
            value={display}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '') return onChange(null);
              const n = Number(raw);
              if (!Number.isNaN(n)) onChange(n / scale);
            }}
            className={cn(control, 'tabular h-12', prefix && 'pl-7', suffix && 'pr-9')}
          />
          {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-subtle">{suffix}</span>}
        </div>
      )}
    </Field>
  );
}

export function DateField({ label, hint, error, required, className, value, onChange }: Base & { value: string | null | undefined; onChange(v: string | null): void }) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {(p) => <input {...p} type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} className={cn(control, 'h-12')} />}
    </Field>
  );
}

export function Toggle({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange(v: boolean): void }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface p-3 hover:border-line-strong">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className="relative mt-0.5 inline-flex h-6 w-10 shrink-0 rounded-full bg-surface-3 ring-1 ring-line-strong transition-colors peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-accent after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" aria-hidden />
      <span>
        <span className="block text-sm font-bold">{label}</span>
        {description && <span className="block text-xs text-subtle">{description}</span>}
      </span>
    </label>
  );
}

/** Edits a string[] as one item per line. */
/** Parses one-item-per-line text: trailing spaces trimmed, blank lines dropped. */
export const parseListText = (text: string): string[] => text.split('\n').map((s) => s.replace(/\s+$/, '')).filter((s) => s.trim() !== '');

/**
 * One item per line. The textarea keeps exactly what the user types (spaces, blank lines) so the cursor never
 * jumps; the parent receives the cleaned list. Text is only replaced when the value changes from outside.
 */
export function ListField({ label, hint, error, className, value, onChange, rows = 4, placeholder }: Base & { value: string[]; onChange(v: string[]): void; rows?: number; placeholder?: string }) {
  const [text, setText] = useState(() => value.join('\n'));
  const lastSent = useRef<string[]>(value);
  if (JSON.stringify(value) !== JSON.stringify(lastSent.current) && JSON.stringify(value) !== JSON.stringify(parseListText(text))) {
    lastSent.current = value;
    setText(value.join('\n'));
  }
  return (
    <TextArea
      label={label}
      hint={hint ?? 'One item per line'}
      error={error}
      className={className}
      rows={rows}
      placeholder={placeholder}
      value={text}
      onChange={(v) => {
        setText(v);
        const list = parseListText(v);
        lastSent.current = list;
        onChange(list);
      }}
    />
  );
}

export function FormSection({ title, description, children, className }: { title: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <fieldset className={cn('border-t border-line-strong pt-5', className)}>
      <legend className="sr-only">{title}</legend>
      <p className="eyebrow mb-1 text-ink">{title}</p>
      {description && <p className="mb-4 text-xs text-subtle">{description}</p>}
      <div className={cn('grid gap-4 sm:grid-cols-2', !description && 'mt-3')}>{children}</div>
    </fieldset>
  );
}
