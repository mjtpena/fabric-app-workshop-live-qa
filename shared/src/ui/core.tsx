import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode, type AnchorHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ------------------------------------------------------------------ tones */

export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'neutral' | 'brand';

/** Solid dot / bar colour per tone. */
export const toneSolid: Record<Tone, string> = {
  ok: 'bg-ok-solid',
  warn: 'bg-warn-solid',
  bad: 'bg-bad-solid',
  info: 'bg-info-solid',
  neutral: 'bg-gray-8',
  brand: 'bg-accent-9',
};
/** Soft background + readable text per tone. */
export const toneSoft: Record<Tone, string> = {
  ok: 'bg-ok-soft text-ok-text',
  warn: 'bg-warn-soft text-warn-text',
  bad: 'bg-bad-soft text-bad-text',
  info: 'bg-info-soft text-info-text',
  neutral: 'bg-gray-3 text-gray-11',
  brand: 'bg-accent-3 text-accent-11',
};
/** Text colour per tone (AA on page and panel backgrounds). */
export const toneText: Record<Tone, string> = {
  ok: 'text-ok-text',
  warn: 'text-warn-text',
  bad: 'text-bad-text',
  info: 'text-info-text',
  neutral: 'text-muted',
  brand: 'text-accent-11',
};
/** CSS colour value per tone, for inline styles and SVG. */
export const toneVar: Record<Tone, string> = {
  ok: 'var(--ok-solid)',
  warn: 'var(--warn-solid)',
  bad: 'var(--bad-solid)',
  info: 'var(--info-solid)',
  neutral: 'var(--gray-8)',
  brand: 'var(--accent-9)',
};

/* ------------------------------------------------------------------ buttons */

export type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle' | 'soft';
export type Size = 'sm' | 'md' | 'lg';

const variantCls: Record<Variant, string> = {
  primary:
    'bg-accent-9 text-accent-contrast hover:bg-accent-10 shadow-[inset_0_1px_0_rgb(255_255_255/0.16),0_1px_2px_rgb(0_0_0/0.14),0_0_0_1px_color-mix(in_oklab,var(--accent-10)_70%,black)]',
  secondary:
    'bg-surface text-fg shadow-xs ring-1 ring-inset ring-gray-6 hover:bg-[var(--row-hover)] hover:ring-gray-7 data-[state=open]:bg-[var(--row-hover)]',
  ghost: 'bg-transparent text-fg hover:bg-gray-3 data-[state=open]:bg-gray-3',
  subtle: 'bg-gray-3 text-fg hover:bg-gray-4 data-[state=open]:bg-gray-4',
  soft: 'bg-accent-3 text-accent-11 hover:bg-accent-4 data-[state=open]:bg-accent-4',
  danger:
    'bg-red-9 text-red-contrast hover:bg-red-10 shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(0_0_0/0.14)]',
};
const sizeCls: Record<Size, string> = {
  sm: 'min-h-7 px-2.5 py-1 text-ui rounded-md gap-1.5 [&_svg]:size-3.5',
  md: 'min-h-8 px-3 py-1 text-sm rounded-lg gap-1.5 [&_svg]:size-4',
  lg: 'min-h-10 px-4 py-2 text-sm rounded-lg gap-2 [&_svg]:size-4',
};
const squareCls: Record<Size, string> = {
  sm: 'w-7 px-0',
  md: 'w-8 px-0',
  lg: 'w-10 px-0',
};

/** Class string for anything that should look like a button (links, labels, custom triggers). */
export function buttonClass({
  variant = 'secondary',
  size = 'md',
  square,
  className,
}: { variant?: Variant; size?: Size; square?: boolean; className?: string } = {}) {
  return cx(
    'x-tap relative inline-flex shrink-0 select-none items-center justify-center text-center font-medium leading-[1.15] no-underline',
    'cursor-pointer transition-[background-color,box-shadow,color,transform] duration-[120ms] ease-standard active:translate-y-px',
    'disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
    '[&_svg]:shrink-0 [&_svg]:[stroke-width:1.75]',
    variantCls[variant],
    sizeCls[size],
    square && squareCls[size],
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner and disables the button; the label stays in place so the width does not jump. */
  busy?: boolean;
  icon?: ReactNode;
  /** Icon after the label (chevrons, arrows). */
  iconRight?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', busy, icon, iconRight, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  const square = !!icon && (children === undefined || children === null || children === false) && !iconRight;
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={buttonClass({ variant, size, square, className })}
      {...rest}
    >
      <span className={cx('inline-flex items-center justify-center gap-[inherit]', busy && 'opacity-0')}>
        {icon}
        {children}
        {iconRight}
      </span>
      {busy && (
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
          <SpinnerGlyph size={size === 'sm' ? 14 : 16} />
        </span>
      )}
    </button>
  );
});

export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'icon' | 'iconRight'> {
  /** Accessible name; also shown as the tooltip when `tooltip` is on. */
  label: string;
  icon: ReactNode;
}

/** Square icon-only button. Always pass `label` (it becomes the aria-label and the title). */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, variant = 'ghost', title, ...rest },
  ref,
) {
  return <Button ref={ref} variant={variant} icon={icon} aria-label={label} title={title ?? label} {...rest} />;
});

type LinkButtonProps = {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconRight?: ReactNode;
  className?: string;
  children?: ReactNode;
} & (
  | ({ to: string; href?: never } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { replace?: boolean; state?: unknown })
  | ({ href: string; to?: never } & AnchorHTMLAttributes<HTMLAnchorElement>)
);

/** A link that looks like a Button. `to` uses react-router (hash routes); `href` renders a plain anchor. */
export function LinkButton({ variant = 'secondary', size = 'md', icon, iconRight, className, children, ...rest }: LinkButtonProps) {
  const square = !!icon && !children && !iconRight;
  const cls = buttonClass({ variant, size, square, className });
  const inner = (
    <>
      {icon}
      {children}
      {iconRight}
    </>
  );
  if ('to' in rest && rest.to !== undefined) {
    const { to, ...a } = rest;
    return (
      <Link to={to} className={cls} {...a}>
        {inner}
      </Link>
    );
  }
  return (
    <a className={cls} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
      {inner}
    </a>
  );
}

/* ------------------------------------------------------------------ spinner */

function SpinnerGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className="animate-[x-spin_0.7s_linear_infinite]" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1.75" />
      <path d="M14.25 8A6.25 6.25 0 0 0 8 1.75" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function Spinner({ small, label = 'Loading', size }: { small?: boolean; label?: string; size?: number }) {
  return (
    <span role="status" aria-label={label} className="inline-flex text-current">
      <SpinnerGlyph size={size ?? (small ? 14 : 20)} />
    </span>
  );
}

/* ------------------------------------------------------------------ status: dot, chip, badge, tag */

export function StatusDot({
  tone = 'neutral',
  pulse,
  size = 6,
  label,
  className,
}: {
  tone?: Tone;
  /** A soft ring pulse for "live" states. */
  pulse?: boolean;
  size?: number;
  /** Screen-reader text when the dot stands alone. */
  label?: string;
  className?: string;
}) {
  return (
    <span className={cx('relative inline-flex shrink-0', className)} style={{ width: size, height: size }}>
      <span
        aria-hidden="true"
        className={cx('inline-block h-full w-full rounded-full', toneSolid[tone], pulse && 'animate-[x-pulse_1.8s_var(--ease)_infinite]')}
        style={pulse ? { color: toneVar[tone] } : undefined}
      />
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}

/**
 * Status chip: a coloured dot plus the label in a hairline tag. With `icon={false}` it renders a soft tinted tag
 * without the dot. Always carries text, so colour is never the only signal.
 */
export function Chip({
  tone = 'neutral',
  children,
  icon = true,
  title,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  /** Show the status dot (default). `false` renders a soft tinted tag instead. */
  icon?: boolean;
  title?: string;
  className?: string;
}) {
  if (!icon)
    return (
      <span
        title={title}
        className={cx('inline-flex h-[22px] items-center gap-1 whitespace-nowrap rounded-md px-1.5 text-xs font-medium [&_svg]:size-3', toneSoft[tone], className)}
      >
        {children}
      </span>
    );
  return (
    <span
      title={title}
      className={cx(
        'inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-md bg-surface px-1.5 text-xs font-medium text-fg ring-1 ring-inset ring-line',
        className,
      )}
    >
      <StatusDot tone={tone} />
      {children}
    </span>
  );
}

export type BadgeVariant = 'dot' | 'outline' | 'soft' | 'solid';

const solidCls: Record<Tone, string> = {
  ok: 'bg-ok-solid text-ok-contrast',
  warn: 'bg-warn-solid text-warn-contrast',
  bad: 'bg-bad-solid text-bad-contrast',
  info: 'bg-info-solid text-info-contrast',
  neutral: 'bg-gray-12 text-gray-1',
  brand: 'bg-accent-9 text-accent-contrast',
};

/**
 * Small status label. `dot` (default): coloured dot + plain text, for tables and meta lines. `outline`: the Chip look.
 * `soft`: tinted tag, no glyph. `solid`: filled, for counts and emphatic states.
 */
export function Badge({
  tone = 'neutral',
  variant = 'dot',
  size = 'md',
  children,
  icon,
  title,
  className,
  pulse,
}: {
  tone?: Tone;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  children: ReactNode;
  icon?: ReactNode;
  title?: string;
  className?: string;
  pulse?: boolean;
}) {
  const sz = size === 'sm' ? 'h-[18px] px-1.5 text-[11px]' : 'h-[22px] px-1.5 text-xs';
  if (variant === 'dot')
    return (
      <span title={title} className={cx('inline-flex items-center gap-1.5 whitespace-nowrap text-ui font-medium text-fg', className)}>
        <StatusDot tone={tone} pulse={pulse} />
        {children}
      </span>
    );
  if (variant === 'outline')
    return (
      <Chip tone={tone} title={title} className={className}>
        {children}
      </Chip>
    );
  return (
    <span
      title={title}
      className={cx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-md font-medium [&_svg]:size-3',
        sz,
        variant === 'solid' ? solidCls[tone] : toneSoft[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/** Neutral label for categories, domains and keywords. Optional tone tint and remove button. */
export function Tag({
  children,
  tone = 'neutral',
  icon,
  mono,
  size = 'md',
  onRemove,
  removeLabel,
  className,
  title,
}: {
  children: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  mono?: boolean;
  size?: 'sm' | 'md';
  onRemove?: () => void;
  removeLabel?: string;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cx(
        'inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-md font-medium [&_svg]:size-3',
        size === 'sm' ? 'h-5 px-1.5 text-[11px]' : 'h-6 px-2 text-xs',
        mono && 'font-mono',
        toneSoft[tone],
        className,
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel ?? `Remove ${typeof children === 'string' ? children : 'tag'}`}
          className="-mr-1 inline-flex size-4 cursor-pointer items-center justify-center rounded-[4px] opacity-70 hover:bg-black/5 hover:opacity-100"
        >
          <X aria-hidden="true" />
        </button>
      )}
    </span>
  );
}

/** Keyboard key. */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cx(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] bg-surface px-1 font-mono text-[11px] font-medium leading-none text-muted',
        'shadow-[inset_0_0_0_1px_var(--line),inset_0_-1px_0_var(--line)]',
        className,
      )}
    >
      {children}
    </kbd>
  );
}

/* ------------------------------------------------------------------ avatars */

const AVATAR_HUES = ['indigo', 'ember', 'blue', 'plum', 'amber', 'violet', 'coral', 'teal', 'gold', 'cyan', 'green'];

function hashName(name: string) {
  // FNV-1a: spreads short names across the hues better than a multiply-add hash.
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?'
  );
}

const AVATAR_SIZES = { xs: 20, sm: 24, md: 28, lg: 32, xl: 40 } as const;
export type AvatarSize = keyof typeof AVATAR_SIZES;

/** Initials avatar with a stable colour per name. */
export function Avatar({ name, size = 'md', className, ring }: { name: string; size?: AvatarSize | number; className?: string; ring?: boolean }) {
  const px = typeof size === 'number' ? size : AVATAR_SIZES[size];
  const hue = AVATAR_HUES[hashName(name) % AVATAR_HUES.length];
  const style: CSSProperties = {
    width: px,
    height: px,
    fontSize: Math.max(9, Math.round(px * 0.38)),
    background: `var(--${hue}-4)`,
    color: `var(--${hue}-11)`,
  };
  return (
    <span
      aria-hidden="true"
      style={style}
      className={cx(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold leading-none tracking-[-0.01em]',
        ring && 'ring-2 ring-[var(--surface)]',
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

/** Overlapping avatars with a "+N" overflow. The names are listed for screen readers. */
export function AvatarStack({ names, max = 4, size = 'sm', label }: { names: string[]; max?: number; size?: AvatarSize; label?: string }) {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  const px = AVATAR_SIZES[size];
  return (
    <span className="inline-flex items-center" role="img" aria-label={label ?? names.join(', ')}>
      {shown.map((n, i) => (
        <span key={`${n}-${i}`} className={i ? '-ml-1.5' : undefined}>
          <Avatar name={n} size={size} ring />
        </span>
      ))}
      {extra > 0 && (
        <span
          aria-hidden="true"
          className="-ml-1.5 inline-flex items-center justify-center rounded-full bg-gray-4 font-medium text-gray-11 ring-2 ring-[var(--surface)] num"
          style={{ height: px, minWidth: px, padding: '0 5px', fontSize: Math.max(10, Math.round(px * 0.4)) }}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ logomark */

/** The default glyph: the title's initial, set tight. */
export function MonogramGlyph({ title }: { title: string }) {
  const ch = (title.trim()[0] ?? '·').toUpperCase();
  return (
    <span aria-hidden="true" className="font-semibold leading-none tracking-[-0.04em]" style={{ fontSize: '0.62em' }}>
      {ch}
    </span>
  );
}

/**
 * The app's logomark: an inline SVG glyph (AppConfig.logo) on an accent tile. Glyphs should draw with
 * `currentColor` on a 24×24 viewBox, 1.75–2 stroke, so they pick up the tile's contrast colour.
 */
export function LogoTile({ logo, title, size = 24, className }: { logo?: ReactNode; title: string; size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx('relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-accent-9 text-accent-contrast', className)}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        fontSize: size,
        boxShadow: 'inset 0 0 0 1px color-mix(in oklab, var(--accent-10) 60%, black 12%), inset 0 1px 0 rgb(255 255 255 / 0.22)',
        backgroundImage: 'linear-gradient(180deg, rgb(255 255 255 / 0.16), rgb(255 255 255 / 0) 60%)',
      }}
    >
      <span className="inline-flex items-center justify-center [&>svg]:h-[62%] [&>svg]:w-[62%]" style={{ width: '100%', height: '100%' }}>
        {logo ?? <MonogramGlyph title={title} />}
      </span>
    </span>
  );
}
