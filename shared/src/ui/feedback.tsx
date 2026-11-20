import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Check, CircleAlert, CircleCheck, Copy, Inbox, Info, RotateCw, TriangleAlert } from 'lucide-react';

import { copyText } from '../lib/csv';
import type { AppErrorInfo } from '../lib/errors';
import { Button, cx, Tag, toneSolid, toneText, toneVar, type Size, type Tone } from './core';

/* ------------------------------------------------------------------ data states */

export function ErrorPanel({
  error,
  onRetry,
  title = 'Could not load this',
  className,
}: {
  error: AppErrorInfo;
  onRetry?: () => void;
  title?: string;
  className?: string;
}) {
  return (
    <div role="alert" className={cx('flex gap-3 rounded-xl border border-bad-line/70 bg-bad-soft/60 px-4 py-3.5', className)}>
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden="true" strokeWidth={2} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="text-sm font-semibold text-fg">{title}</strong>
          <Tag size="sm" mono className="bg-surface/70 text-muted">
            {error.category}
          </Tag>
        </div>
        <p className="m-0 mt-1 break-words text-sm text-muted">{error.message}</p>
        {onRetry && (
          <Button size="sm" className="mt-3" icon={<RotateCw aria-hidden="true" />} onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}

/** Empty state: an icon, a title, one line that teaches the next step, and the action. */
export function EmptyState({
  title,
  children,
  action,
  icon,
  compact,
  bordered,
  className,
}: {
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  /** A lucide icon element; defaults to an inbox. */
  icon?: ReactNode;
  compact?: boolean;
  /** Dashed outline, for empty areas inside a page section. */
  bordered?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'flex flex-col items-center text-center',
        compact ? 'px-4 py-8' : 'px-6 py-14',
        bordered && 'rounded-xl border border-dashed border-line-strong/70',
        className,
      )}
    >
      <div className="mb-4 grid size-10 place-items-center rounded-[10px] bg-surface text-muted shadow-[0_0_0_1px_var(--line),0_1px_2px_rgb(0_0_0/0.05)] [&_svg]:size-[18px] [&_svg]:[stroke-width:1.75]">
        {icon ?? <Inbox aria-hidden="true" />}
      </div>
      <p className="m-0 text-base font-semibold text-fg">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-[48ch] text-sm text-muted">{children}</div>}
      {action && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}

/** Skeleton block. Size it to the content it stands in for. */
export function Skeleton({
  className,
  width,
  height,
  circle,
  style,
}: {
  className?: string;
  width?: number | string;
  height?: number | string;
  circle?: boolean;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      className={cx('x-skeleton block', circle && 'rounded-full!', className)}
      style={{ width, height: height ?? (className?.includes('h-') ? undefined : 12), ...style }}
    />
  );
}

/** Skeleton text lines (last one shorter). */
export function SkeletonText({ lines = 2, className }: { lines?: number; className?: string }) {
  return (
    <span className={cx('flex flex-col gap-2', className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} height={10} width={i === lines - 1 && lines > 1 ? '55%' : '100%'} />
      ))}
    </span>
  );
}

/** Generic list skeleton (used by DataState). Pages with a distinct layout should pass their own skeleton. */
export function LoadingBlock({ rows = 3, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="overflow-hidden rounded-xl border border-line bg-surface">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-line px-4 py-3.5 last:border-b-0">
          <Skeleton circle width={20} height={20} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton height={10} width={`${48 + ((i * 17) % 30)}%`} />
            <Skeleton height={8} width={`${22 + ((i * 11) % 18)}%`} />
          </div>
          <span className="hidden sm:block">
            <Skeleton height={10} width={48} />
          </span>
        </div>
      ))}
      <span className="sr-only">{label}…</span>
    </div>
  );
}

/**
 * Render loading, error, empty or content for one async data view.
 * `isEmpty` decides the empty state once data has arrived. `skeleton` replaces the default list skeleton.
 */
export function DataState<T>({
  state,
  isEmpty,
  empty,
  children,
  loadingRows,
  skeleton,
}: {
  state: { data: T | undefined; loading: boolean; error: AppErrorInfo | null; reload: () => void | Promise<void> };
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  children: (data: T) => ReactNode;
  loadingRows?: number;
  skeleton?: ReactNode;
}) {
  if (state.error && state.data === undefined)
    return <ErrorPanel error={state.error} onRetry={() => void state.reload()} />;
  if (state.loading || state.data === undefined)
    return skeleton ? (
      <div role="status" aria-label="Loading">
        {skeleton}
      </div>
    ) : (
      <LoadingBlock rows={loadingRows} />
    );
  if (isEmpty?.(state.data)) return <>{empty}</>;
  return (
    <>
      {state.error && (
        <div className="mb-3">
          <ErrorPanel error={state.error} onRetry={() => void state.reload()} title="Refresh failed" />
        </div>
      )}
      {children(state.data)}
    </>
  );
}

export function InlineError({ error, className }: { error: AppErrorInfo | string | null | undefined; className?: string }) {
  if (!error) return null;
  const e = typeof error === 'string' ? { category: 'validation', message: error } : error;
  return (
    <p role="alert" className={cx('m-0 mt-2 flex items-start gap-1.5 text-ui font-medium text-bad', className)}>
      <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      <span>{e.message}</span>
    </p>
  );
}

/** Inline notice for guidance or warnings that belong to a section (not a page-level instruction paragraph). */
export function Callout({
  tone = 'info',
  title,
  children,
  action,
  icon,
  className,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  const Icon = tone === 'bad' ? CircleAlert : tone === 'warn' ? TriangleAlert : tone === 'ok' ? CircleCheck : Info;
  return (
    <div className={cx('flex gap-3 rounded-lg border border-line bg-surface-sunken px-3.5 py-3 text-sm', className)}>
      <span className={cx('mt-0.5 shrink-0 [&_svg]:size-4', toneText[tone])}>{icon ?? <Icon aria-hidden="true" strokeWidth={2} />}</span>
      <div className="min-w-0 flex-1">
        {title && <div className="font-medium text-fg">{title}</div>}
        {children && <div className={cx('text-muted', !!title && 'mt-0.5')}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ toast */

/**
 * Bottom-centre toast. `action` adds a button (for example Undo). Sits above the mobile tab bar.
 * Keep one Toast per page and drive it with state: `<Toast message={msg} onDone={() => setMsg(null)} />`.
 */
export function Toast({
  message,
  onDone,
  action,
  tone,
  duration,
}: {
  message: string | null;
  onDone: () => void;
  action?: { label: string; onClick: () => void };
  tone?: 'ok' | 'bad' | 'neutral';
  duration?: number;
}) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, duration ?? (action ? 6000 : 3500));
    return () => clearTimeout(t);
  }, [message, onDone, action, duration]);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4"
      style={{ bottom: 'calc(16px + var(--x-bottom-inset) + env(safe-area-inset-bottom))' }}
    >
      {message && (
        <div
          key={message}
          className="pointer-events-auto flex max-w-[min(560px,100%)] animate-x-in items-center gap-3 rounded-xl bg-inverse py-2.5 pl-3.5 pr-2.5 text-sm text-on-inverse shadow-2"
        >
          {tone === 'ok' && <CircleCheck className="size-4 shrink-0 text-[var(--green-8)]" aria-hidden="true" />}
          {tone === 'bad' && <CircleAlert className="size-4 shrink-0 text-[var(--red-8)]" aria-hidden="true" />}
          <span className="min-w-0 flex-1">{message}</span>
          {action ? (
            <button
              type="button"
              onClick={() => {
                action.onClick();
                onDone();
              }}
              className="-my-1 shrink-0 cursor-pointer rounded-md px-2 py-1 font-semibold text-on-inverse underline decoration-[color-mix(in_oklab,currentColor_40%,transparent)] underline-offset-2 hover:bg-white/10"
            >
              {action.label}
            </button>
          ) : (
            <span className="w-1" />
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ meters */

/** A value against a maximum (capacity, score, share). `markers` draws thresholds such as 60%. */
export function Meter({
  value,
  max = 100,
  tone = 'brand',
  label,
  showValue,
  format,
  size = 'md',
  markers,
  className,
}: {
  value: number;
  max?: number;
  tone?: Tone;
  label?: string;
  showValue?: boolean;
  format?: (value: number, max: number) => string;
  size?: 'sm' | 'md' | 'lg';
  /** Threshold marks, in the same units as value. */
  markers?: { value: number; label?: string }[];
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const text = format ? format(value, max) : `${Math.round(pct)}%`;
  const h = size === 'sm' ? 'h-1' : size === 'lg' ? 'h-2.5' : 'h-1.5';
  return (
    <div className={cx('min-w-0', className)}>
      {(label || showValue) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-ui">
          {label && <span className="truncate text-muted">{label}</span>}
          {showValue && <span className="font-medium text-fg num">{text}</span>}
        </div>
      )}
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={text}
        className={cx('relative w-full rounded-full bg-gray-4', h)}
      >
        <div
          className={cx('h-full rounded-full transition-[width] duration-[200ms] ease-standard', toneSolid[tone])}
          style={{ width: `${pct}%` }}
        />
        {markers?.map((m) => (
          <span
            key={m.value}
            title={m.label}
            aria-hidden="true"
            className="absolute -top-1 -bottom-1 w-px bg-fg/70"
            style={{ left: `${max > 0 ? (m.value / max) * 100 : 0}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/** Task progress. Omit `value` for an indeterminate bar. */
export function Progress({
  value,
  max = 100,
  tone = 'brand',
  label = 'Progress',
  size = 'md',
  className,
}: {
  value?: number;
  max?: number;
  tone?: Tone;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const pct = value === undefined ? undefined : max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cx('relative w-full overflow-hidden rounded-full bg-gray-4', size === 'sm' ? 'h-1' : 'h-1.5', className)}
    >
      {pct === undefined ? (
        <div className={cx('absolute inset-y-0 w-2/5 animate-[x-indeterminate_1.2s_var(--ease)_infinite] rounded-full', toneSolid[tone])} />
      ) : (
        <div className={cx('h-full rounded-full transition-[width] duration-[200ms] ease-standard', toneSolid[tone])} style={{ width: `${pct}%` }} />
      )}
    </div>
  );
}

/** Circular progress (scores, countdowns). Children render in the centre. */
export function ProgressRing({
  value,
  max = 100,
  size = 40,
  thickness = 4,
  tone = 'brand',
  color,
  label,
  children,
  className,
}: {
  value: number;
  max?: number;
  size?: number;
  thickness?: number;
  tone?: Tone;
  /** Any CSS colour; overrides tone. */
  color?: string;
  label?: string;
  children?: ReactNode;
  className?: string;
}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const frac = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <span
      role="img"
      aria-label={label ?? `${Math.round(frac * 100)}%`}
      className={cx('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--gray-4)" strokeWidth={thickness} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color ?? toneVar[tone]}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          style={{ transition: 'stroke-dashoffset 200ms var(--ease)' }}
        />
      </svg>
      {children && <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold num">{children}</span>}
    </span>
  );
}

/** Horizontal share bar with an accessible text equivalent. */
export function ShareBar({
  parts,
  label,
  size = 'md',
}: {
  parts: { value: number; color: string; label: string }[];
  label: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const text = parts.map((p) => `${p.label} ${total ? Math.round((p.value / total) * 100) : 0}%`).join(', ');
  const visible = parts.filter((p) => p.value > 0);
  return (
    <div
      role="img"
      aria-label={`${label}: ${text}`}
      className={cx(
        'flex w-full gap-[2px] overflow-hidden rounded-full',
        size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2',
        total > 0 ? 'bg-transparent' : 'bg-gray-4',
      )}
    >
      {total > 0 &&
        visible.map((p) => <div key={p.label} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />)}
    </div>
  );
}

/* ------------------------------------------------------------------ timeline */

export interface TimelineItem {
  id?: string;
  title: ReactNode;
  time?: ReactNode;
  description?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  /** Shown on the connector after this item ("+42 min"). */
  gap?: ReactNode;
}

/** Vertical timeline with dots, connectors and optional durations between steps. */
export function Timeline({ items, label, className }: { items: TimelineItem[]; label?: string; className?: string }) {
  return (
    <ol aria-label={label} className={cx('m-0 list-none p-0', className)}>
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <li key={it.id ?? i} className="relative flex gap-3">
            <div className="relative flex w-5 shrink-0 flex-col items-center">
              <span
                className={cx(
                  'relative z-[1] mt-0.5 flex size-5 items-center justify-center rounded-full [&_svg]:size-3',
                  it.icon ? cx(toneSolid[it.tone ?? 'neutral'], 'text-white') : 'bg-surface',
                )}
              >
                {it.icon ?? (
                  <span className={cx('size-2 rounded-full ring-4 ring-[var(--surface)]', toneSolid[it.tone ?? 'neutral'])} />
                )}
              </span>
              {!last && <span aria-hidden="true" className="w-px flex-1 bg-line-strong/70" />}
            </div>
            <div className={cx('min-w-0 flex-1', last ? 'pb-0' : it.gap ? 'pb-2' : 'pb-5')}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <div className="text-sm font-medium text-fg">{it.title}</div>
                {it.time && <div className="text-xs text-muted num">{it.time}</div>}
              </div>
              {it.description && <div className="mt-0.5 text-ui text-muted">{it.description}</div>}
              {it.gap && !last && (
                <div className="mt-3 mb-1 inline-flex items-center rounded-md bg-gray-3 px-1.5 py-0.5 font-mono text-[11px] text-muted num">
                  {it.gap}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ countdown */

function splitMs(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

export function formatCountdown(ms: number, format: 'auto' | 'clock' | 'short' = 'auto'): string {
  const { d, h, m, s } = splitMs(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (format === 'clock') return d ? `${d}d ${pad(h)}:${pad(m)}:${pad(s)}` : h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (format === 'short') return `${m}m`;
  return m ? `${m}m ${pad(s)}s` : `${s}s`;
}

/**
 * Live countdown to a time. Ticks every second under an hour, every 30 s above. With `from` it also draws a ring
 * of the time left. Pass `now` in tests for a fixed clock.
 */
export function Countdown({
  to,
  from,
  now,
  format = 'auto',
  doneLabel = 'Ended',
  onDone,
  tone,
  ring,
  size = 44,
  className,
}: {
  to: Date | string | number;
  from?: Date | string | number;
  now?: Date;
  format?: 'auto' | 'clock' | 'short';
  doneLabel?: ReactNode;
  onDone?: () => void;
  tone?: Tone;
  ring?: boolean;
  size?: number;
  className?: string;
}) {
  const end = new Date(to).getTime();
  const [tick, setTick] = useState(() => Date.now());
  const current = now ? now.getTime() : tick;
  const left = end - current;
  useEffect(() => {
    if (now) return;
    const every = left < 3_600_000 ? 1000 : 30_000;
    const t = setInterval(() => setTick(Date.now()), every);
    return () => clearInterval(t);
  }, [now, left < 3_600_000]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = left <= 0;
  useEffect(() => {
    if (done) onDone?.();
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps
  const text = done ? doneLabel : formatCountdown(left, format);
  const urgent: Tone = tone ?? (done ? 'neutral' : left < 3_600_000 ? 'bad' : left < 86_400_000 ? 'warn' : 'neutral');
  const iso = new Date(end).toISOString();
  if (ring && from !== undefined) {
    const total = end - new Date(from).getTime();
    return (
      <span className={cx('inline-flex items-center gap-2', className)}>
        <ProgressRing value={Math.max(0, left)} max={Math.max(1, total)} size={size} thickness={3} tone={urgent === 'neutral' ? 'brand' : urgent} label={`Time left: ${typeof text === 'string' ? text : ''}`} />
        <time dateTime={iso} className={cx('text-sm font-medium num', toneText[urgent])}>
          {text}
        </time>
      </span>
    );
  }
  return (
    <time dateTime={iso} className={cx('font-medium num', urgent !== 'neutral' && toneText[urgent], className)}>
      {text}
    </time>
  );
}

/* ------------------------------------------------------------------ copy */

export function CopyButton({
  text,
  label = 'Copy',
  size = 'sm',
  variant = 'secondary',
}: {
  text: string | (() => string);
  label?: string;
  size?: Size;
  variant?: 'secondary' | 'ghost' | 'subtle';
}) {
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle');
  return (
    <Button
      size={size}
      variant={variant}
      icon={state === 'done' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      onClick={async () => {
        try {
          await copyText(typeof text === 'function' ? text() : text);
          setState('done');
        } catch {
          // Clipboard access can be refused (permissions, insecure context, embedded iframe).
          setState('failed');
        }
        setTimeout(() => setState('idle'), 2000);
      }}
    >
      {state === 'done' ? 'Copied' : state === 'failed' ? 'Copy blocked' : label}
      <span className="sr-only" aria-live="polite">
        {state === 'done' ? 'Copied to clipboard' : state === 'failed' ? 'The browser blocked clipboard access' : ''}
      </span>
    </Button>
  );
}
