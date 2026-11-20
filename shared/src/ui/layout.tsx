import {
  Children,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
  type TableHTMLAttributes,
} from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';

import { cx, toneText, type Tone } from './core';

/* ------------------------------------------------------------------ panels */

/**
 * A panel: 12px radius, hairline border, raised surface. Use for the one primary object on a page or for a group
 * that needs a boundary — not for every item in a list (use a divided list or a Table), and never inside another Card.
 */
export function Card({
  children,
  className,
  as: As = 'section',
  interactive,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article' | 'li';
  /** Hover lift for clickable cards. */
  interactive?: boolean;
} & Record<string, unknown>) {
  return (
    <As
      className={cx(
        'rounded-xl border border-line bg-surface p-4',
        interactive && 'transition-[border-color,box-shadow] duration-[160ms] hover:border-line-strong hover:shadow-1',
        className,
      )}
      {...rest}
    >
      {children}
    </As>
  );
}

/** Page title row: 22–28px title, an optional one-line subtitle or meta, actions on the right. */
export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
  meta,
  className,
}: {
  title: ReactNode;
  /** One line. Don't explain the page; say what the reader needs. */
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Small line above the title: a breadcrumb or back link. */
  eyebrow?: ReactNode;
  /** Inline facts under the title (badges, owner, dates). */
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3', className)}>
      <div className="min-w-0 flex-1 basis-[18rem]">
        {eyebrow && <div className="mb-2 flex items-center gap-1.5 text-ui font-medium text-muted [&_a]:text-muted [&_a]:no-underline [&_a:hover]:text-fg">{eyebrow}</div>}
        <h1 className="m-0 text-xl font-semibold break-words md:text-2xl">{title}</h1>
        {subtitle && <p className="m-0 mt-1.5 max-w-[72ch] text-sm text-muted">{subtitle}</p>}
        {meta && <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-ui text-muted">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Section({
  title,
  actions,
  children,
  description,
  className,
  id,
}: {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section className={cx('mt-10 first:mt-0', className)} id={id}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="m-0 text-base font-semibold">{title}</h2>
          {description && <p className="m-0 mt-0.5 text-ui text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/** Compact filter bar (32px controls). `sticky` pins it under the app header on long lists. */
export function Toolbar({ children, sticky, className }: { children: ReactNode; sticky?: boolean; className?: string }) {
  return (
    <div
      className={cx(
        'mb-4 flex flex-wrap items-center gap-2',
        sticky &&
          'sticky top-[var(--header-h)] z-20 -mx-4 border-b border-line bg-[color-mix(in_oklab,var(--bg)_88%,transparent)] px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6',
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ stats */

export interface StatDelta {
  value: ReactNode;
  direction?: 'up' | 'down' | 'flat';
  /** Which direction is good. Default 'up'. */
  good?: 'up' | 'down';
}

/** One number with its label. Sits in a StatStrip (hairline dividers) or alone (its own panel). */
export function Stat({
  label,
  value,
  hint,
  tone,
  delta,
  icon,
  size = 'md',
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  /** Colours the value (bad / warn / ok); leave unset for neutral numbers. */
  tone?: Tone;
  delta?: StatDelta;
  icon?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const valueCls = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-lg' : 'text-2xl';
  return (
    <div className={cx('x-stat', className)}>
      <div className="flex min-w-0 items-center gap-1.5 text-ui font-medium text-muted [&_svg]:size-3.5">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1.5 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={cx('min-w-0 font-semibold leading-none tracking-[-0.025em] num', valueCls, tone && tone !== 'neutral' && toneText[tone])}>{value}</span>
        {delta && <Delta {...delta} />}
      </div>
      {hint && <div className="mt-2 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Delta({ value, direction = 'flat', good = 'up' }: StatDelta) {
  const tone: Tone = direction === 'flat' ? 'neutral' : direction === good ? 'ok' : 'bad';
  const Icon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : ArrowRight;
  return (
    <span className={cx('inline-flex items-center gap-0.5 text-xs font-medium num', toneText[tone])}>
      <Icon className="size-3" aria-hidden="true" strokeWidth={2} />
      {value}
    </span>
  );
}

/** A row of Stats in one panel with hairline dividers (2 columns on phones). Replaces rows of KPI cards. */
export function StatStrip({
  children,
  columns,
  bare,
  className,
}: {
  children: ReactNode;
  /** Columns from md up. Defaults to the number of children (max 6). */
  columns?: number;
  /** No panel: dividers only, for use inside a Card or a header. */
  bare?: boolean;
  className?: string;
}) {
  const n = columns ?? Math.min(6, Math.max(1, Children.toArray(children).length));
  return (
    <div className={cx('x-statstrip', bare && 'is-bare', className)} style={{ '--x-cols': n } as CSSProperties}>
      {children}
    </div>
  );
}

/** v1 API: renders a Stat. Prefer Stat inside StatStrip in new code. */
export function KpiCard({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone }) {
  return <Stat label={label} value={value} hint={hint} tone={tone} />;
}

/** v1 API: renders a StatStrip. */
export function KpiRow({ children }: { children: ReactNode }) {
  return <StatStrip>{children}</StatStrip>;
}

/* ------------------------------------------------------------------ tables */

/** Scrollable wrapper so wide tables never cause page-level horizontal scroll on phones. */
export function TableWrap({
  children,
  label,
  maxHeight,
  className,
}: {
  children: ReactNode;
  label?: string;
  /** Limit the height to scroll inside (the header sticks with Table stickyHeader). */
  maxHeight?: number | string;
  className?: string;
}) {
  return (
    <div
      className={cx('relative overflow-auto rounded-xl border border-line bg-surface', className)}
      style={maxHeight !== undefined ? { maxHeight } : undefined}
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      {children}
    </div>
  );
}

/** `<table class="x-table">` with density and sticky-header options. Put it in a TableWrap. */
export function Table({
  density = 'normal',
  stickyHeader,
  className,
  children,
  ...rest
}: TableHTMLAttributes<HTMLTableElement> & { density?: 'normal' | 'compact'; stickyHeader?: boolean }) {
  return (
    <table className={cx('x-table', density === 'compact' && 'is-compact', stickyHeader && 'is-sticky', className)} {...rest}>
      {children}
    </table>
  );
}

/** Header cell. `numeric` right-aligns (use for number columns). */
export function Th({ numeric, className, scope = 'col', ...rest }: ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return <th scope={scope} className={cx(numeric && 'num', className)} {...rest} />;
}

/** Body cell. `numeric` right-aligns in mono with tabular figures; `muted` for secondary columns. */
export function Td({
  numeric,
  muted,
  className,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean; muted?: boolean }) {
  return <td className={cx(numeric && 'num', muted && 'text-muted', className)} {...rest} />;
}

/** Row. `selected` tints it; `onClick` makes the whole row clickable (keep a real link in a cell too). */
export function Tr({ selected, className, onClick, ...rest }: HTMLAttributes<HTMLTableRowElement> & { selected?: boolean }) {
  return (
    <tr
      data-selected={selected || undefined}
      className={cx(onClick && 'is-clickable', className)}
      onClick={onClick}
      {...rest}
    />
  );
}

/** A divided list: the default for collections. Each child is a row separated by hairlines. */
export function List({ children, className, label, as: As = 'ul' }: { children: ReactNode; className?: string; label?: string; as?: 'ul' | 'ol' | 'div' }) {
  return (
    <As
      aria-label={label}
      className={cx('m-0 list-none divide-y divide-[var(--line)] overflow-hidden rounded-xl border border-line bg-surface p-0', className)}
    >
      {children}
    </As>
  );
}
