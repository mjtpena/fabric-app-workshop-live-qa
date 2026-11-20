import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from 'react';
import { Check, X } from 'lucide-react';

import { Button, cx, Kbd } from './core';
import { Field, TextArea } from './forms';
import { InlineError } from './feedback';

/* ------------------------------------------------------------------ floating position */

export type Placement = 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';

/**
 * Positions a fixed element next to an anchor, flipping to stay in the viewport. Floating layers render with
 * popover="manual" so they sit in the top layer (above dialogs, never clipped by overflow).
 */
function useFloating(
  anchor: RefObject<HTMLElement | null>,
  floating: RefObject<HTMLElement | null>,
  open: boolean,
  placement: Placement,
  offset = 6,
) {
  const update = useCallback(() => {
    const a = anchor.current;
    const f = floating.current;
    if (!a || !f) return;
    const r = a.getBoundingClientRect();
    const w = f.offsetWidth;
    const h = f.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const [side, align] = placement.split('-') as ['top' | 'bottom' | 'left' | 'right', 'start' | 'end' | undefined];
    let s = side;
    if (s === 'bottom' && r.bottom + offset + h > vh - 8 && r.top - offset - h > 8) s = 'top';
    else if (s === 'top' && r.top - offset - h < 8 && r.bottom + offset + h < vh - 8) s = 'bottom';
    else if (s === 'right' && r.right + offset + w > vw - 8) s = 'left';
    else if (s === 'left' && r.left - offset - w < 8) s = 'right';
    let top = 0;
    let left = 0;
    if (s === 'top' || s === 'bottom') {
      top = s === 'bottom' ? r.bottom + offset : r.top - offset - h;
      left = align === 'start' ? r.left : align === 'end' ? r.right - w : r.left + r.width / 2 - w / 2;
    } else {
      left = s === 'right' ? r.right + offset : r.left - offset - w;
      top = r.top + r.height / 2 - h / 2;
    }
    left = Math.min(Math.max(8, left), Math.max(8, vw - w - 8));
    top = Math.min(Math.max(8, top), Math.max(8, vh - h - 8));
    f.style.left = `${Math.round(left)}px`;
    f.style.top = `${Math.round(top)}px`;
    f.dataset.side = s;
  }, [anchor, floating, placement, offset]);

  useLayoutEffect(() => {
    if (!open) return;
    const f = floating.current;
    if (f) {
      try {
        if (typeof f.showPopover === 'function' && !f.matches(':popover-open')) f.showPopover();
      } catch {
        /* popover unsupported: falls back to position: fixed + z-index */
      }
    }
    update();
    const on = () => update();
    window.addEventListener('resize', on);
    window.addEventListener('scroll', on, true);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('scroll', on, true);
    };
  }, [open, update, floating]);
  return update;
}

/* ------------------------------------------------------------------ tooltip */

/**
 * Hover/focus tooltip for short labels (icon buttons, truncated text, definitions). Not for essential content:
 * touch users cannot hover. Wraps its child in an inline-flex span.
 */
export function Tooltip({
  content,
  children,
  side = 'top',
  delay = 350,
  disabled,
  shortcut,
}: {
  content: ReactNode;
  children: ReactNode;
  side?: Placement;
  delay?: number;
  disabled?: boolean;
  /** Keyboard hint shown after the text. */
  shortcut?: string;
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  const floating = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();
  useFloating(anchor, floating, open, side, 6);
  const show = (now = false) => {
    if (disabled) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), now ? 0 : delay);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  };
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  const child =
    isValidElement(children) && open
      ? cloneElement(children as ReactElement<{ 'aria-describedby'?: string }>, { 'aria-describedby': id })
      : children;
  return (
    <span
      ref={anchor}
      className="inline-flex max-w-full"
      onPointerEnter={(e) => e.pointerType === 'mouse' && show()}
      onPointerLeave={hide}
      onFocus={() => show(true)}
      onBlur={hide}
    >
      {child}
      {open && (
        <span
          ref={floating}
          id={id}
          role="tooltip"
          popover="manual"
          className="x-float pointer-events-none z-[70] max-w-[260px] rounded-md bg-inverse px-2 py-1 text-xs font-medium leading-4 text-on-inverse shadow-1"
        >
          {content}
          {shortcut && <Kbd className="ml-1.5 h-4 min-w-4 bg-white/15 text-on-inverse shadow-none">{shortcut}</Kbd>}
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ popover */

type TriggerProps = {
  onClick?: (e: ReactMouseEvent) => void;
  'aria-expanded'?: boolean;
  'aria-haspopup'?: 'dialog' | 'menu' | boolean;
  'aria-controls'?: string;
  'data-state'?: string;
};

function useDismiss(
  open: boolean,
  close: (returnFocus: boolean) => void,
  refs: RefObject<HTMLElement | null>[],
) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (refs.some((r) => r.current?.contains(t))) return;
      close(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close(true);
      }
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, close, refs]);
}

/**
 * Click-triggered floating panel (filters, details, breakdowns). `trigger` is a single element (usually a Button);
 * it receives onClick, aria-expanded and aria-controls. Children may be a function of `close`.
 */
export function Popover({
  trigger,
  children,
  placement = 'bottom-start',
  open: openProp,
  onOpenChange,
  width,
  label,
  className,
}: {
  trigger: ReactElement<TriggerProps>;
  children: ReactNode | ((close: () => void) => ReactNode);
  placement?: Placement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  width?: number | string;
  /** Accessible name of the panel. */
  label?: string;
  className?: string;
}) {
  const [inner, setInner] = useState(false);
  const open = openProp ?? inner;
  const setOpen = useCallback(
    (v: boolean) => {
      setInner(v);
      onOpenChange?.(v);
    },
    [onOpenChange],
  );
  const anchor = useRef<HTMLSpanElement>(null);
  const floating = useRef<HTMLDivElement>(null);
  const id = useId();
  useFloating(anchor, floating, open, placement, 6);
  const close = useCallback(
    (returnFocus = true) => {
      setOpen(false);
      if (returnFocus) (anchor.current?.querySelector('button,a,[tabindex]') as HTMLElement | null)?.focus();
    },
    [setOpen],
  );
  const refs = useRef([anchor, floating] as RefObject<HTMLElement | null>[]).current;
  useDismiss(open, close, refs);
  const t = cloneElement(trigger, {
    onClick: (e: ReactMouseEvent) => {
      trigger.props.onClick?.(e);
      setOpen(!open);
    },
    'aria-expanded': open,
    'aria-haspopup': 'dialog',
    'aria-controls': open ? id : undefined,
    'data-state': open ? 'open' : 'closed',
  });
  return (
    <span ref={anchor} className="inline-flex">
      {t}
      {open && (
        <div
          ref={floating}
          id={id}
          role="dialog"
          aria-label={label}
          popover="manual"
          className={cx('x-float z-[60]', className)}
          style={{ width }}
        >
          <div className="x-panel p-3 text-sm">{typeof children === 'function' ? children(() => close(true)) : children}</div>
        </div>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ menu */

export type MenuEntry =
  | {
      type?: 'item';
      label: ReactNode;
      onSelect?: () => void;
      icon?: ReactNode;
      shortcut?: string;
      description?: ReactNode;
      danger?: boolean;
      disabled?: boolean;
      /** Renders a menuitemcheckbox/radio with a check mark. */
      checked?: boolean;
      role?: 'menuitem' | 'menuitemradio' | 'menuitemcheckbox';
      testId?: string;
    }
  | { type: 'separator' }
  | { type: 'label'; label: ReactNode };

/** One menu row. Use inside <Menu> children for custom menus; `items` covers most cases. */
export function MenuItem({
  children,
  onSelect,
  icon,
  shortcut,
  description,
  danger,
  disabled,
  checked,
  role,
  testId,
  close,
}: {
  children: ReactNode;
  onSelect?: () => void;
  icon?: ReactNode;
  shortcut?: string;
  description?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  checked?: boolean;
  role?: 'menuitem' | 'menuitemradio' | 'menuitemcheckbox';
  testId?: string;
  close?: () => void;
}) {
  const r = role ?? (checked !== undefined ? 'menuitemcheckbox' : 'menuitem');
  return (
    <button
      type="button"
      role={r}
      aria-checked={r === 'menuitem' ? undefined : !!checked}
      disabled={disabled}
      tabIndex={-1}
      data-testid={testId}
      onClick={() => {
        onSelect?.();
        close?.();
      }}
      className={cx(
        'flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm outline-none',
        'hover:bg-gray-3 focus-visible:bg-gray-3 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        '[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:[stroke-width:1.75]',
        danger ? 'text-bad' : 'text-fg',
      )}
    >
      {icon && <span className={cx('inline-flex', danger ? 'text-bad' : 'text-muted')}>{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{children}</span>
        {description && <span className="block truncate text-xs text-muted">{description}</span>}
      </span>
      {shortcut && <Kbd>{shortcut}</Kbd>}
      {checked !== undefined && <Check aria-hidden="true" className={cx('text-accent-11', !checked && 'invisible')} />}
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="-mx-1 my-1 h-px bg-line" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-2 pt-2 pb-1 text-xs font-medium text-muted">{children}</div>;
}

/**
 * Dropdown menu (role="menu") with arrow-key navigation, Home/End, Escape and focus return.
 * Pass `items`, or `children` (a function of `close`) built from MenuItem / MenuSeparator / MenuLabel.
 */
export function Menu({
  trigger,
  items,
  children,
  label,
  placement = 'bottom-end',
  width = 224,
  header,
}: {
  trigger: ReactElement<TriggerProps>;
  items?: MenuEntry[];
  children?: (close: () => void) => ReactNode;
  label: string;
  placement?: Placement;
  width?: number;
  /** Non-interactive block above the items (e.g. who is signed in). */
  header?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  const floating = useRef<HTMLDivElement>(null);
  const id = useId();
  useFloating(anchor, floating, open, placement, 6);
  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) (anchor.current?.querySelector('button,a,[tabindex]') as HTMLElement | null)?.focus();
  }, []);
  const refs = useRef([anchor, floating] as RefObject<HTMLElement | null>[]).current;
  useDismiss(open, close, refs);

  const menuItems = () =>
    Array.from(floating.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not(:disabled)') ?? []);
  useEffect(() => {
    if (open) requestAnimationFrame(() => menuItems()[0]?.focus());
  }, [open]);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const list = menuItems();
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') list[(i + 1) % list.length]?.focus();
    else if (e.key === 'ArrowUp') list[(i - 1 + list.length) % list.length]?.focus();
    else if (e.key === 'Home') list[0]?.focus();
    else if (e.key === 'End') list[list.length - 1]?.focus();
    else if (e.key === 'Tab') close(false);
    else return;
    if (e.key !== 'Tab') e.preventDefault();
  };
  const t = cloneElement(trigger, {
    onClick: (e: ReactMouseEvent) => {
      trigger.props.onClick?.(e);
      setOpen((o) => !o);
    },
    'aria-expanded': open,
    'aria-haspopup': 'menu',
    'aria-controls': open ? id : undefined,
    'data-state': open ? 'open' : 'closed',
  });
  return (
    <span ref={anchor} className="inline-flex">
      {t}
      {open && (
        <div ref={floating} popover="manual" className="x-float z-[60]" style={{ width }}>
          <div className="x-panel overflow-hidden">
            {header && <div className="border-b border-line px-3 py-2.5">{header}</div>}
            <div id={id} role="menu" aria-label={label} onKeyDown={onKey} className="max-h-[min(420px,70vh)] overflow-y-auto p-1">
              {children
                ? children(() => close(true))
                : items?.map((it, i) =>
                    it.type === 'separator' ? (
                      <MenuSeparator key={i} />
                    ) : it.type === 'label' ? (
                      <MenuLabel key={i}>{it.label}</MenuLabel>
                    ) : (
                      <MenuItem key={i} {...it} close={() => close(true)}>
                        {it.label}
                      </MenuItem>
                    ),
                  )}
            </div>
          </div>
        </div>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ dialog and sheet */

function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  bodyClassName,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className: string;
  bodyClassName?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const downOnBackdrop = useRef(false);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={className}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onPointerDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        // Click on the backdrop (the dialog element itself, outside the content) closes.
        if (e.target === e.currentTarget && downOnBackdrop.current) {
          const r = e.currentTarget.getBoundingClientRect();
          const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
          if (!inside) onClose();
        }
      }}
    >
      {open && (
        <div className="flex max-h-[inherit] flex-col">
          <div aria-hidden="true" className="x-handle mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-gray-6" />
          <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-4 pb-3">
            <div className="min-w-0">
              <h2 id={titleId} className="m-0 text-base font-semibold leading-6">
                {title}
              </h2>
              {description && <p className="m-0 mt-0.5 text-ui text-muted">{description}</p>}
            </div>
            <Button variant="ghost" size="sm" className="-mr-1.5 text-muted hover:text-fg" onClick={onClose} aria-label="Close" icon={<X aria-hidden="true" />} />
          </div>
          <div className={cx('min-h-0 flex-1 overflow-y-auto px-5 pb-5', bodyClassName)}>{children}</div>
          {footer && (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-sunken/60 px-5 py-3 max-sm:[&>*]:flex-1">
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}

/**
 * Modal dialog on the native <dialog> element: focus trap, Escape and backdrop click to close.
 * Phones get a bottom sheet automatically. `drawer` slides in from the right on desktop.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  drawer,
  description,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  drawer?: boolean;
  description?: ReactNode;
  size?: 'md' | 'wide';
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={footer}
      className={cx('x-dialog', drawer && 'x-drawer', size === 'wide' && 'is-wide')}
    >
      {children}
    </Modal>
  );
}

/** A drawer for mobile flows and side panels: bottom (default), right or left. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  description,
  side = 'bottom',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  description?: ReactNode;
  side?: 'bottom' | 'right' | 'left';
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={footer}
      className={cx('x-dialog x-sheet', side === 'right' && 'is-right', side === 'left' && 'is-left')}
    >
      {children}
    </Modal>
  );
}

/** Confirm dialog with an optional required note. Resolves through onConfirm. */
export function ConfirmDialog({
  open,
  onClose,
  title,
  body,
  confirmLabel = 'Confirm',
  danger,
  noteLabel,
  noteRequired,
  noteMax = 300,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  noteLabel?: string;
  noteRequired?: boolean;
  noteMax?: number;
  onConfirm: (note: string) => Promise<void> | void;
}) {
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = useId();
  useEffect(() => {
    if (open) {
      setNote('');
      setErr(null);
    }
  }, [open]);
  const submit = async () => {
    const v = note.trim();
    if (noteLabel && noteRequired && !v) return setErr(`${noteLabel} is required.`);
    if (v.length > noteMax) return setErr(`${noteLabel ?? 'Note'} must be ${noteMax} characters or fewer.`);
    setBusy(true);
    try {
      await onConfirm(v);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} busy={busy} onClick={submit}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {body && <div className="mb-3 text-sm text-muted">{body}</div>}
      {noteLabel && (
        <Field label={noteLabel} htmlFor={id} required={noteRequired} error={err} counter={{ value: note.length, max: noteMax }} className="mb-0">
          <TextArea id={id} value={note} onChange={(e) => setNote(e.target.value)} rows={3} invalid={!!err} />
        </Field>
      )}
      {!noteLabel && err && <InlineError error={err} />}
    </Dialog>
  );
}

/* ------------------------------------------------------------------ tabs */

/** Underline tabs (role="tablist") with arrow-key navigation. Scrolls sideways on narrow screens. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  className,
}: {
  tabs: { value: T; label: ReactNode; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex((t) => t.value === value);
    let n = -1;
    if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = tabs.length - 1;
    if (n < 0) return;
    e.preventDefault();
    onChange(tabs[n].value);
    refs.current[n]?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKey}
      className={cx('no-scrollbar mb-5 flex gap-5 overflow-x-auto border-b border-line', className)}
    >
      {tabs.map((t, i) => {
        const on = value === t.value;
        return (
          <button
            key={t.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.value)}
            className={cx(
              'relative inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap text-sm font-medium transition-colors duration-[120ms]',
              'after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:transition-colors',
              on ? 'text-fg after:bg-fg' : 'text-muted after:bg-transparent hover:text-fg',
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cx('rounded-[5px] px-1.5 text-xs leading-[18px] num', on ? 'bg-gray-4 text-fg' : 'bg-gray-3 text-muted')}>
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
