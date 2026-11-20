import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { CircleAlert, Search, X } from 'lucide-react';

import { cx, Kbd } from './core';

/* ------------------------------------------------------------------ field */

export function Field({
  label,
  hint,
  error,
  children,
  required,
  htmlFor,
  counter,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  required?: boolean;
  htmlFor: string;
  counter?: { value: number; max: number };
  className?: string;
}) {
  return (
    <div className={cx('mb-4', className)}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-ui font-medium text-fg">
          {label}
          {required && (
            <span className="ml-0.5 text-bad" aria-hidden="true">
              *
            </span>
          )}
        </label>
        {counter && (
          <span
            className={cx('text-xs num', counter.value > counter.max ? 'font-medium text-bad' : 'text-faint')}
            aria-live="polite"
          >
            {counter.value}/{counter.max}
          </span>
        )}
      </div>
      {children}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="m-0 mt-1.5 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="m-0 mt-1.5 flex items-start gap-1.5 text-ui font-medium text-bad">
          <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ inputs */

type ControlSize = 'sm' | 'md' | 'lg';
const controlH: Record<ControlSize, string> = {
  sm: 'h-9 sm:h-7 rounded-md',
  md: 'h-10 sm:h-8 rounded-lg',
  lg: 'h-11 sm:h-10 rounded-lg',
};
/* 16px text on phones stops iOS zooming into the field. */
const controlText = 'text-base sm:text-sm';

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; controlSize?: ControlSize }
>(function Input({ className, invalid, controlSize = 'md', ...rest }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cx('x-control block w-full min-w-0 px-2.5', controlH[controlSize], controlText, className)}
      {...rest}
    />
  );
});

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function TextArea({ className, invalid, rows = 4, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cx('x-control block w-full min-w-0 resize-y px-2.5 py-[7px] leading-5', controlText, className)}
      {...rest}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean; controlSize?: ControlSize }
>(function Select({ className, invalid, children, controlSize = 'md', ...rest }, ref) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cx('x-control x-select block w-full min-w-0 pl-2.5', controlH[controlSize], controlText, className)}
      {...rest}
    >
      {children}
    </select>
  );
});

export function Checkbox({
  label,
  checked,
  onChange,
  disabled,
  id,
  description,
  className,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  id?: string;
  description?: ReactNode;
  className?: string;
}) {
  const auto = useId();
  const cid = id ?? auto;
  return (
    <label
      htmlFor={cid}
      className={cx('inline-flex cursor-pointer select-none items-start gap-2 text-sm', disabled && 'cursor-not-allowed opacity-60', className)}
    >
      <input
        id={cid}
        type="checkbox"
        className="x-checkbox mt-0.5"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="min-w-0">
        <span className="block">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </span>
    </label>
  );
}

/** Accessible on/off switch (a button with role="switch"). */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  size = 'md',
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  id?: string;
}) {
  const sm = size === 'sm';
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'x-tap relative inline-flex shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-[160ms] disabled:cursor-not-allowed disabled:opacity-50',
        sm ? 'h-4 w-7' : 'h-5 w-9',
        checked ? 'bg-accent-9' : 'bg-gray-7 hover:bg-gray-8',
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          'inline-block rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.25)] transition-transform duration-[160ms] ease-standard',
          sm ? 'size-3' : 'size-4',
          checked ? (sm ? 'translate-x-3' : 'translate-x-4') : 'translate-x-0',
        )}
      />
      <span className="sr-only">{checked ? 'On' : 'Off'}</span>
    </button>
  );
}

/** Search field with an icon and a clear button. `shortcut` (e.g. "/") focuses it from anywhere. */
export function SearchInput({
  value,
  onChange,
  label = 'Search',
  placeholder = 'Search…',
  shortcut,
  className,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  placeholder?: string;
  shortcut?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!shortcut) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === shortcut && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [shortcut]);
  return (
    <div className={cx('relative min-w-[200px] flex-1', className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" strokeWidth={1.75} />
      <Input
        ref={ref}
        id={id}
        type="search"
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.stopPropagation();
            onChange('');
          }
        }}
        className={cx('pl-8 [&::-webkit-search-cancel-button]:hidden', (value || shortcut) && 'pr-8')}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            onChange('');
            ref.current?.focus();
          }}
          className="absolute right-1.5 top-1/2 inline-flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-faint hover:bg-gray-3 hover:text-fg"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      ) : (
        shortcut && (
          <span className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 sm:inline-flex">
            <Kbd>{shortcut}</Kbd>
          </span>
        )
      )}
    </div>
  );
}

/** A compact labelled filter <select> for toolbars: the label sits inside the control ("Status  Open ⌄"). */
export function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cx('x-control relative inline-flex h-10 min-w-0 max-w-full items-center sm:h-8', className)}>
      <label htmlFor={id} className="shrink-0 cursor-pointer whitespace-nowrap pl-2.5 pr-1.5 text-sm text-muted">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="x-select h-full min-w-0 flex-1 cursor-pointer truncate rounded-r-lg border-0 bg-transparent pl-0 text-base font-medium text-fg outline-none focus-visible:outline-none sm:text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ------------------------------------------------------------------ segmented control */

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  /** Accessible name when the label is an icon only. */
  ariaLabel?: string;
  disabled?: boolean;
}

/** Mutually exclusive options in one control (view switchers, ranges). A radiogroup with arrow-key support. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
  fullWidth,
  glass,
  className,
}: {
  options: SegmentOption<T>[];
  /** Translucent pill for use over a centrepiece. */
  glass?: boolean;
  value: T;
  onChange: (v: T) => void;
  label: string;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
    const cur = enabled.indexOf(options.findIndex((o) => o.value === value));
    let next = cur;
    if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = enabled.length - 1;
    else next = (cur + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length;
    const idx = enabled[next];
    onChange(options[idx].value);
    refs.current[idx]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKey}
      className={cx(
        'inline-flex items-center gap-0.5 p-0.5',
        glass ? 'x-glass rounded-full! p-1' : 'rounded-lg bg-gray-3',
        fullWidth && 'flex w-full',
        className,
      )}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.ariaLabel}
            tabIndex={on ? 0 : -1}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cx(
              'x-tap inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-[background-color,color,box-shadow] duration-[120ms] disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:[stroke-width:1.75]',
              size === 'sm' ? 'h-6 px-2 text-xs' : 'h-7 px-2.5 text-ui',
              glass && 'h-7 rounded-full px-3',
              fullWidth && 'flex-1',
              on
                ? 'bg-[var(--seg-on,var(--surface))] text-fg shadow-[0_1px_2px_rgb(0_0_0/0.08),0_0_0_1px_var(--line)]'
                : 'text-muted hover:text-fg',
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
