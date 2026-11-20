/**
 * Building blocks for immersive centrepieces (DESIGN.md §0): a full-bleed stage with floating glass panels for the
 * title, search / fly-to, lenses, legend and the Today panel, collapsing to a stacked layout with a bottom sheet on
 * phones. The centrepiece itself (three.js, canvas, SVG) is the app's; these give every app the same frame.
 */
import { useState, type CSSProperties, type ElementType, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, ChevronRight, List as ListIcon, Map as MapIcon, PanelRightClose, PanelRightOpen } from 'lucide-react';

import { Avatar, Button, cx, IconButton, StatusDot, toneText, type Tone } from './core';
import { SegmentedControl } from './forms';
import { useHotkeys, useIsDesktop } from './hooks';
import { Sheet } from './overlays';

/* ------------------------------------------------------------------ floating panel */

/**
 * Translucent panel that floats over a centrepiece: 16px radius, backdrop blur, hairline border, soft shadow.
 * `title` renders a small mono caption; `actions` sit on its right.
 */
export function FloatingPanel({
  children,
  title,
  actions,
  padding = 'md',
  as: As = 'div',
  className,
  style,
  ...rest
}: {
  children?: ReactNode;
  title?: ReactNode;
  actions?: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
} & Partial<Record<`aria-${string}` | `data-${string}` | 'id' | 'role', string>>) {
  const pad = padding === 'none' ? '' : padding === 'sm' ? 'p-2.5' : padding === 'lg' ? 'p-5' : 'p-4';
  return (
    <As className={cx('x-glass min-w-0', pad, className)} style={style} {...rest}>
      {(title || actions) && (
        <div className="mb-2.5 flex min-h-6 items-center justify-between gap-2">
          {title && <div className="x-legend-label text-muted">{title}</div>}
          {actions && <div className="ml-auto flex items-center gap-1">{actions}</div>}
        </div>
      )}
      {children}
    </As>
  );
}

/* ------------------------------------------------------------------ breadcrumb */

export interface BreadcrumbItem {
  label: ReactNode;
  to?: string;
  href?: string;
  onClick?: () => void;
}

/** Where you are in the metaphor ("Tenant / Finance town / Sales house"). The last item is the current place. */
export function Breadcrumb({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="m-0 flex list-none flex-wrap items-center gap-1 p-0 text-ui text-muted">
        {items.map((it, i) => {
          const last = i === items.length - 1;
          const cls = 'rounded-md px-1 py-0.5 -mx-1 text-muted no-underline transition-colors hover:bg-gray-3 hover:text-fg';
          return (
            <li key={i} className="inline-flex min-w-0 items-center gap-1">
              {last ? (
                <span aria-current="page" className="truncate font-medium text-fg">
                  {it.label}
                </span>
              ) : it.to ? (
                <Link to={it.to} className={cls}>
                  {it.label}
                </Link>
              ) : it.href ? (
                <a href={it.href} className={cls}>
                  {it.label}
                </a>
              ) : it.onClick ? (
                <button type="button" onClick={it.onClick} className={cx(cls, 'cursor-pointer')}>
                  {it.label}
                </button>
              ) : (
                <span className="truncate">{it.label}</span>
              )}
              {!last && <ChevronRight aria-hidden="true" className="size-3 shrink-0 text-faint" strokeWidth={2} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ------------------------------------------------------------------ pills (lens bar, view as) */

function Pill({
  on,
  onClick,
  children,
  title,
  hint,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
  title?: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      title={title}
      onClick={onClick}
      className={cx(
        'x-tap inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-ui font-medium transition-[background-color,color,box-shadow] duration-[160ms] ease-standard',
        '[&_svg]:size-3.5 [&_svg]:[stroke-width:1.75]',
        on ? 'bg-gray-12 text-gray-1 shadow-[0_1px_2px_rgb(0_0_0/0.2)]' : 'text-muted hover:bg-[color-mix(in_oklab,var(--gray-12)_7%,transparent)] hover:text-fg',
      )}
    >
      {children}
      {hint && <span className={cx('hidden font-mono text-[10px] md:inline', on ? 'text-gray-8' : 'text-faint')}>{hint}</span>}
    </button>
  );
}

export interface LensOption<T extends string = string> {
  value: T;
  label: string;
  /** CSS colour for the small swatch (a token like var(--ember-9), or a gradient). */
  swatch?: string;
  icon?: ReactNode;
  description?: string;
}

/**
 * Lens switcher: re-encodes the same centrepiece. Pills with a swatch or icon; number keys 1–9 switch lenses
 * (`hotkeys={false}` to turn off). Put it in StagePage `lenses`.
 */
export function LensBar<T extends string>({
  lenses,
  value,
  onChange,
  label = 'Lens',
  hotkeys = true,
  showLabel = true,
  glass = true,
  className,
}: {
  lenses: LensOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
  hotkeys?: boolean;
  /** Show the mono "LENS" caption before the pills. */
  showLabel?: boolean;
  glass?: boolean;
  className?: string;
}) {
  useHotkeys(
    Object.fromEntries(lenses.slice(0, 9).map((l, i) => [String(i + 1), () => onChange(l.value)])),
    { enabled: hotkeys },
  );
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx(
        'no-scrollbar inline-flex w-fit max-w-full items-center gap-0.5 overflow-x-auto p-1',
        glass ? 'x-glass rounded-full!' : 'rounded-full bg-gray-3',
        className,
      )}
    >
      {showLabel && <span className="x-legend-label shrink-0 pl-2.5 pr-1.5 text-faint">{label}</span>}
      {lenses.map((l, i) => (
        <Pill
          key={l.value}
          on={l.value === value}
          onClick={() => onChange(l.value)}
          title={l.description ? `${l.description}${hotkeys && i < 9 ? ` (${i + 1})` : ''}` : hotkeys && i < 9 ? `Press ${i + 1}` : undefined}
          hint={hotkeys && i < 9 ? String(i + 1) : undefined}
        >
          {l.icon ? (
            <span aria-hidden="true" className="inline-flex">
              {l.icon}
            </span>
          ) : (
            l.swatch && (
              <span
                aria-hidden="true"
                className="inline-block size-2.5 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
                style={{ background: l.swatch }}
              />
            )
          )}
          {l.label}
        </Pill>
      ))}
    </div>
  );
}

export interface ViewAsOption<T extends string = string> {
  value: T;
  label: string;
  /** Person name for an avatar (omit for roles). */
  name?: string;
  icon?: ReactNode;
}

/** "View as" persona/role switch. `cycleKey` (default "v") steps through the options. */
export function ViewAsSwitch<T extends string>({
  options,
  value,
  onChange,
  label = 'View as',
  cycleKey = 'v',
  glass = true,
  className,
}: {
  options: ViewAsOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
  cycleKey?: string | false;
  glass?: boolean;
  className?: string;
}) {
  useHotkeys(
    cycleKey
      ? {
          [cycleKey]: () => {
            const i = options.findIndex((o) => o.value === value);
            onChange(options[(i + 1) % options.length].value);
          },
        }
      : {},
  );
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx('no-scrollbar inline-flex w-fit max-w-full items-center gap-0.5 overflow-x-auto p-1', glass ? 'x-glass rounded-full!' : 'rounded-full bg-gray-3', className)}
    >
      <span className="x-legend-label shrink-0 pl-2.5 pr-1.5 text-faint" title={cycleKey ? `Press ${cycleKey.toUpperCase()} to switch` : undefined}>
        {label}
      </span>
      {options.map((o) => (
        <Pill key={o.value} on={o.value === value} onClick={() => onChange(o.value)}>
          {o.name ? <Avatar name={o.name} size={18} /> : o.icon && <span aria-hidden="true" className="inline-flex">{o.icon}</span>}
          {o.label}
        </Pill>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ view toggle */

export type StageView = 'stage' | 'list';

/** Centrepiece ↔ list switch (the accessible list is always one click away). `hotkey` toggles. */
export function ViewToggle({
  value,
  onChange,
  stageLabel = 'Map',
  listLabel = 'List',
  stageIcon = <MapIcon />,
  listIcon = <ListIcon />,
  hotkey = 'l',
  glass,
  className,
}: {
  /** Translucent pill for use over a centrepiece. */
  glass?: boolean;
  value: StageView;
  onChange: (v: StageView) => void;
  stageLabel?: string;
  listLabel?: string;
  stageIcon?: ReactNode;
  listIcon?: ReactNode;
  hotkey?: string | false;
  className?: string;
}) {
  useHotkeys(hotkey ? { [hotkey]: () => onChange(value === 'stage' ? 'list' : 'stage') } : {});
  return (
    <SegmentedControl
      size="sm"
      label="View"
      glass={glass}
      className={className}
      value={value}
      onChange={onChange}
      options={[
        { value: 'stage', label: stageLabel, icon: stageIcon },
        { value: 'list', label: listLabel, icon: listIcon },
      ]}
    />
  );
}

/* ------------------------------------------------------------------ legend */

export interface LegendItem {
  label: ReactNode;
  color?: string;
  shape?: 'dot' | 'square' | 'line' | 'dash' | 'ring' | 'diamond';
  icon?: ReactNode;
  value?: ReactNode;
}

function Swatch({ color = 'var(--gray-8)', shape = 'dot' }: { color?: string; shape?: LegendItem['shape'] }) {
  const base = 'inline-block shrink-0';
  if (shape === 'line') return <span aria-hidden="true" className={cx(base, 'h-0.5 w-3.5 rounded-full')} style={{ background: color }} />;
  if (shape === 'dash')
    return <span aria-hidden="true" className={cx(base, 'h-0 w-3.5 border-t-2 border-dashed')} style={{ borderColor: color }} />;
  if (shape === 'ring') return <span aria-hidden="true" className={cx(base, 'size-2.5 rounded-full border-2')} style={{ borderColor: color }} />;
  if (shape === 'diamond') return <span aria-hidden="true" className={cx(base, 'size-2 rotate-45 rounded-[1px]')} style={{ background: color }} />;
  return <span aria-hidden="true" className={cx(base, 'size-2.5', shape === 'square' ? 'rounded-[3px]' : 'rounded-full')} style={{ background: color }} />;
}

/** Compact key for a centrepiece: swatch + small mono label rows. `collapsible` folds it to its title on phones. */
export function Legend({
  items,
  title = 'Legend',
  bare,
  collapsible,
  defaultOpen = true,
  columns = 1,
  className,
}: {
  items: LegendItem[];
  title?: ReactNode;
  bare?: boolean;
  collapsible?: boolean;
  defaultOpen?: boolean;
  columns?: 1 | 2;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const body = (
    <ul className={cx('m-0 grid list-none gap-x-4 gap-y-1.5 p-0', columns === 2 && 'grid-cols-2')}>
      {items.map((it, i) => (
        <li key={i} className="flex min-w-0 items-center gap-2">
          <span className="inline-flex w-3.5 justify-center [&_svg]:size-3.5">{it.icon ?? <Swatch color={it.color} shape={it.shape} />}</span>
          <span className="x-legend-label min-w-0 flex-1 truncate text-fg/80">{it.label}</span>
          {it.value !== undefined && <span className="font-mono text-[11px] text-muted num">{it.value}</span>}
        </li>
      ))}
    </ul>
  );
  const head = collapsible ? (
    <button
      type="button"
      aria-expanded={open}
      onClick={() => setOpen((o) => !o)}
      className="x-legend-label flex w-full cursor-pointer items-center justify-between gap-3 text-muted hover:text-fg"
    >
      {title}
      <ChevronDown aria-hidden="true" className={cx('size-3.5 transition-transform', !open && '-rotate-90')} />
    </button>
  ) : (
    title && <div className="x-legend-label text-muted">{title}</div>
  );
  const content = (
    <>
      {head}
      {(!collapsible || open) && <div className={head ? 'mt-2.5' : undefined}>{body}</div>}
    </>
  );
  if (bare) return <div className={className}>{content}</div>;
  return (
    <FloatingPanel padding="sm" className={cx('px-3 py-2.5', className)}>
      {content}
    </FloatingPanel>
  );
}

/* ------------------------------------------------------------------ today */

export interface TodayItem {
  id: string;
  title: ReactNode;
  severity: Tone;
  /** The big number (count, days, score). */
  value?: ReactNode;
  unit?: ReactNode;
  /** The lens this item belongs to; shown as a small mono tag. */
  lens?: string;
  meta?: ReactNode;
  onClick?: () => void;
}

/**
 * The three to five things that need attention now, ranked. Each item is a button that should focus the
 * centrepiece on the thing behind it (fly to, select, switch lens).
 */
export function TodayPanel({
  items,
  title = 'Today',
  date,
  onSelect,
  activeId,
  empty = 'Nothing needs you today.',
  bare,
  className,
}: {
  items: TodayItem[];
  title?: ReactNode;
  date?: ReactNode;
  onSelect?: (item: TodayItem) => void;
  activeId?: string | null;
  empty?: ReactNode;
  /** No glass of its own (inside StagePage's side panel, which already is one). */
  bare?: boolean;
  className?: string;
}) {
  const list =
    items.length === 0 ? (
      <div className="flex items-center gap-2.5 rounded-xl px-3 py-4 text-sm text-muted">
        <span className="grid size-6 place-items-center rounded-full bg-ok-soft text-ok-text">
          <Check className="size-3.5" aria-hidden="true" strokeWidth={2.25} />
        </span>
        {empty}
      </div>
    ) : (
      <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
        {items.map((it) => {
          const active = it.id === activeId;
          return (
            <li key={it.id}>
              <button
                type="button"
                onClick={() => (it.onClick ? it.onClick() : onSelect?.(it))}
                aria-current={active || undefined}
                className={cx(
                  'group grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-[120ms]',
                  active
                    ? 'bg-[color-mix(in_oklab,var(--accent-9)_10%,transparent)] ring-1 ring-inset ring-[color-mix(in_oklab,var(--accent-9)_35%,transparent)]'
                    : 'hover:bg-[color-mix(in_oklab,var(--gray-12)_5%,transparent)]',
                )}
              >
                <span className="pt-1.5">
                  <StatusDot tone={it.severity} size={8} pulse={it.severity === 'bad'} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium leading-5 text-fg">{it.title}</span>
                  {(it.lens || it.meta) && (
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                      {it.lens && <span className="x-legend-label rounded-[5px] bg-gray-3 px-1.5 py-px text-[10px] text-muted">{it.lens}</span>}
                      {it.meta}
                    </span>
                  )}
                </span>
                {it.value !== undefined && (
                  <span className="flex flex-col items-end">
                    <span className={cx('text-2xl font-semibold leading-none tracking-[-0.03em] num', it.severity === 'bad' || it.severity === 'warn' ? toneText[it.severity] : 'text-fg')}>
                      {it.value}
                    </span>
                    {it.unit && <span className="mt-1 text-[11px] text-muted">{it.unit}</span>}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    );
  const head = (
    <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
      <span className="x-today-title text-base font-semibold">{title}</span>
      <span className="font-mono text-[11px] text-muted num">
        {date}
        {date && items.length ? ' · ' : ''}
        {items.length ? `${items.length} to look at` : ''}
      </span>
    </div>
  );
  if (bare)
    return (
      <div className={className}>
        {head}
        {list}
      </div>
    );
  return (
    <FloatingPanel padding="sm" className={cx('p-3', className)}>
      {head}
      {list}
    </FloatingPanel>
  );
}

/* ------------------------------------------------------------------ stage message */

/** A centred message on the stage: loading, empty world, no WebGL (with a way to the list). */
export function StageMessage({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('pointer-events-none absolute inset-0 flex items-center justify-center p-6', className)}>
      <FloatingPanel padding="lg" className="pointer-events-auto max-w-sm text-center">
        {icon && <div className="mx-auto mb-3 grid size-10 place-items-center rounded-xl bg-gray-3 text-muted [&_svg]:size-[18px]">{icon}</div>}
        <div className="text-base font-semibold">{title}</div>
        {children && <div className="mt-1 text-sm text-muted">{children}</div>}
        {action && <div className="mt-4 flex justify-center gap-2">{action}</div>}
      </FloatingPanel>
    </div>
  );
}

/* ------------------------------------------------------------------ stage page */

export interface StagePageProps {
  /** The centrepiece. It fills the stage (absolute, inset 0); size your canvas/SVG to its parent. */
  stage: ReactNode;
  /** Accessible name of the stage region ("Report garden map"). */
  label: string;
  title?: ReactNode;
  breadcrumb?: BreadcrumbItem[] | ReactNode;
  /** One line under the title (counts, as-of date). */
  meta?: ReactNode;
  /** Top right: search / fly to, ViewAsSwitch, ViewToggle. */
  topRight?: ReactNode;
  /** Bottom centre: a LensBar. */
  lenses?: ReactNode;
  /** Bottom left: a Legend. */
  legend?: ReactNode;
  /** Bottom right: a ViewAsSwitch or zoom controls. */
  bottomRight?: ReactNode;
  /** Right side panel (desktop) / bottom sheet (phones): usually a TodayPanel with `bare`. */
  side?: ReactNode;
  sideTitle?: string;
  /** Badge on the phone button that opens the side sheet (e.g. the Today count). */
  sideCount?: number;
  sideOpen?: boolean;
  onSideOpenChange?: (open: boolean) => void;
  /** 'list' replaces the centrepiece with `list` (the accessible equivalent) in a normal scrolling page. */
  view?: StageView;
  list?: ReactNode;
  /** Stage background (defaults to the world sky gradient). */
  background?: string;
  /** Extra content below the stage on phones (and below the list view). */
  children?: ReactNode;
  className?: string;
}

function TitleBlock({ title, breadcrumb, meta }: Pick<StagePageProps, 'title' | 'breadcrumb' | 'meta'>) {
  return (
    <div className="min-w-0">
      {breadcrumb && (Array.isArray(breadcrumb) ? <Breadcrumb items={breadcrumb} className="mb-1" /> : <div className="mb-1">{breadcrumb}</div>)}
      {title && <h1 className="m-0 text-xl font-semibold leading-7">{title}</h1>}
      {meta && <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-ui text-muted">{meta}</div>}
    </div>
  );
}

const SKY = 'linear-gradient(180deg, var(--world-sky) 0%, var(--world-sky-2) 100%)';

/**
 * Full-bleed centrepiece page. Use inside `<AppShell immersive>` so it fills the space under the header.
 * Desktop: the stage fills the page; title (top left), `topRight`, `lenses` (bottom centre), `legend` (bottom left)
 * and `side` (right, collapsible) float over it in glass panels. Phones: title, stage (60% of the viewport), lenses,
 * and a button that opens `side` in a bottom sheet. `view="list"` swaps the stage for `list`.
 */
export function StagePage(props: StagePageProps) {
  const desktop = useIsDesktop();
  const { view = 'stage' } = props;
  if (view === 'list') return <ListView {...props} />;
  return desktop ? <DesktopStage {...props} /> : <MobileStage {...props} />;
}

/** Alias of StagePage. */
export const ImmersiveLayout = StagePage;

function ListView({ title, breadcrumb, meta, topRight, list, children, className }: StagePageProps) {
  return (
    <div className={cx('x-stage-root h-full overflow-y-auto', className)}>
      <div className="mx-auto max-w-[var(--content-max)] px-4 pt-6 pb-10 sm:px-6 md:pt-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <TitleBlock title={title} breadcrumb={breadcrumb} meta={meta} />
          {topRight && <div className="flex flex-wrap items-center gap-2">{topRight}</div>}
        </div>
        {list}
        {children}
      </div>
    </div>
  );
}

function DesktopStage({
  stage,
  label,
  title,
  breadcrumb,
  meta,
  topRight,
  lenses,
  legend,
  bottomRight,
  side,
  sideTitle = 'Today',
  sideOpen,
  onSideOpenChange,
  background,
  className,
}: StagePageProps) {
  const [inner, setInner] = useState(true);
  const open = side ? (sideOpen ?? inner) : false;
  const setOpen = (v: boolean) => {
    setInner(v);
    onSideOpenChange?.(v);
  };
  const sideW = open ? 'calc(340px + 16px)' : '0px';
  return (
    <div
      className={cx('x-stage-root relative h-full min-h-[520px] w-full overflow-hidden', className)}
      style={{ background: background ?? SKY, '--side-w': sideW } as CSSProperties}
    >
      <section aria-label={label} className="absolute inset-0">
        {stage}
      </section>

      {/* Overlay slots. The wrapper ignores the pointer so the stage stays draggable between panels. */}
      <div className="pointer-events-none absolute inset-0 p-4">
        {(title || breadcrumb || meta) && (
          <FloatingPanel padding="none" className="pointer-events-auto absolute left-4 top-4 max-w-[min(420px,40%)] px-4 py-3">
            <TitleBlock title={title} breadcrumb={breadcrumb} meta={meta} />
          </FloatingPanel>
        )}
        {(topRight || (side && !open)) && (
          <div className="pointer-events-none absolute top-4 flex items-center gap-2" style={{ right: `calc(16px + ${sideW})` }}>
            <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">{topRight}</div>
            {side && !open && (
              <Button className="x-glass pointer-events-auto rounded-full! ring-0" icon={<PanelRightOpen aria-hidden="true" />} onClick={() => setOpen(true)}>
                {sideTitle}
              </Button>
            )}
          </div>
        )}
        {(lenses || legend || bottomRight) && (
          <div className="absolute bottom-4 left-4 grid grid-cols-[1fr_auto_1fr] items-end gap-3" style={{ right: `calc(16px + ${sideW})` }}>
            <div className="pointer-events-auto min-w-0 justify-self-start">{legend}</div>
            <div className="pointer-events-auto min-w-0 max-w-full justify-self-center">{lenses}</div>
            <div className="pointer-events-auto min-w-0 justify-self-end">{bottomRight}</div>
          </div>
        )}
        {side && open && (
          <FloatingPanel
            as="aside"
            aria-label={sideTitle}
            padding="none"
            className="pointer-events-auto absolute right-4 top-4 bottom-4 flex w-[340px] animate-x-in flex-col overflow-hidden"
          >
            <span className="absolute right-2 top-2.5 z-[1]">
              <IconButton size="sm" label={`Hide ${sideTitle}`} icon={<PanelRightClose />} onClick={() => setOpen(false)} />
            </span>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pt-3 pb-3 [&>*>:first-child]:pr-9">{side}</div>
          </FloatingPanel>
        )}
      </div>
    </div>
  );
}

function MobileStage({
  stage,
  label,
  title,
  breadcrumb,
  meta,
  topRight,
  lenses,
  legend,
  bottomRight,
  side,
  sideTitle = 'Today',
  sideCount,
  background,
  children,
  className,
}: StagePageProps) {
  const [sheet, setSheet] = useState(false);
  return (
    <div className={cx('x-stage-root flex flex-col', className)}>
      <div className="flex flex-col gap-3 px-4 pt-4 pb-3">
        <TitleBlock title={title} breadcrumb={breadcrumb} meta={meta} />
        {topRight && <div className="flex flex-wrap items-center gap-2">{topRight}</div>}
      </div>
      <section
        aria-label={label}
        className="relative h-[58svh] min-h-[300px] overflow-hidden border-y border-line"
        style={{ background: background ?? SKY }}
      >
        {stage}
        {legend && <div className="pointer-events-none absolute bottom-3 left-3 max-w-[70%] [&>*]:pointer-events-auto">{legend}</div>}
        {/* The Today button sits in the stage's top-right corner on phones, so it never covers the lens bar or the
            tab bar the way a sticky bottom button did. */}
        {side && (
          <div className="absolute top-3 right-3 z-10">
            <Button
              className="x-glass h-11 rounded-full! pl-4 pr-3 ring-0"
              onClick={() => setSheet(true)}
              aria-haspopup="dialog"
              iconRight={
                sideCount ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-9 px-1.5 text-[11px] font-semibold text-accent-contrast num">
                    {sideCount}
                  </span>
                ) : undefined
              }
            >
              {sideTitle}
            </Button>
          </div>
        )}
      </section>
      {lenses && <div className="no-scrollbar overflow-x-auto px-4 pt-3">{lenses}</div>}
      {bottomRight && <div className="no-scrollbar overflow-x-auto px-4 pt-2">{bottomRight}</div>}
      <div className="h-3" />
      {children && <div className="px-4 pb-6">{children}</div>}
      {side && (
        <>
          <Sheet open={sheet} onClose={() => setSheet(false)} title={sideTitle}>
            {/* The sheet already shows the title; hide a TodayPanel's own. Choosing an item closes the sheet. */}
            <div
              className="[&_.x-today-title]:invisible"
              onClickCapture={(e) => (e.target as HTMLElement).closest('button') && setTimeout(() => setSheet(false), 0)}
            >
              {side}
            </div>
          </Sheet>
        </>
      )}
    </div>
  );
}
