import { useContext, useEffect, useId, useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  Archive,
  BookOpen,
  ChartColumn,
  ChevronsUpDown,
  CircleDot,
  CirclePlus,
  Download,
  Ellipsis,
  FileText,
  FlaskConical,
  History,
  House,
  Inbox,
  Info,
  ListChecks,
  ListTodo,
  Lock,
  Map as MapIcon,
  LogOut,
  Monitor,
  Moon,
  Network,
  PenLine,
  Radio,
  RefreshCw,
  RotateCcw,
  Settings,
  Sigma,
  Sparkles,
  SquareKanban,
  Sun,
  Table2,
  Upload,
  Users,
  X,
} from 'lucide-react';

import { renamePerson, DISPLAY_NAME_LIMITS, type Person } from '../identity';
import { describeError, type AppErrorInfo } from '../lib/errors';
import { checkText } from '../lib/validate';
import {
  Avatar,
  Badge,
  Button,
  cx,
  Dialog,
  ErrorPanel,
  Field,
  Input,
  LogoTile,
  Menu,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  Sheet,
  Skeleton,
  StatusDot,
  Tag,
} from '../ui';
import { AppCtx, useApp, type NavItem } from './context';
import { useThemePref, type ThemePref } from './theme';

/* ------------------------------------------------------------------ logo */

function PathsGlyph({ paths }: { paths: string[] }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** The app's logomark from its config (logo, logoPaths or the monogram default) on the accent tile. */
export function AppLogo({
  size = 24,
  config,
  className,
}: {
  size?: number;
  config?: { title: string; logo?: ReactNode; logoPaths?: string[] };
  className?: string;
}) {
  // Outside mountApp (playground, tests) pass `config`; inside, it comes from context.
  const ctx = useContext(AppCtx);
  const c = config ?? ctx?.config ?? { title: '' };
  return <LogoTile title={c.title} size={size} className={className} logo={c.logo ?? (c.logoPaths ? <PathsGlyph paths={c.logoPaths} /> : undefined)} />;
}

/* ------------------------------------------------------------------ nav icons */

const ICON_RULES: [RegExp, ReactNode][] = [
  [/^(home|overview)$/i, <House key="i" />],
  [/map|world|atlas|garden|radar|city/i, <MapIcon key="i" />],
  [/board|kanban/i, <SquareKanban key="i" />],
  [/review|queue/i, <ListChecks key="i" />],
  [/insight|trend|dashboard|stat|report/i, <ChartColumn key="i" />],
  [/graveyard|archive|retired/i, <Archive key="i" />],
  [/history|^log$/i, <History key="i" />],
  [/import|upload/i, <Upload key="i" />],
  [/export|download/i, <Download key="i" />],
  [/submit|^new/i, <CirclePlus key="i" />],
  [/inbox|request/i, <Inbox key="i" />],
  [/team|people|member/i, <Users key="i" />],
  [/regist|browse|dictionary|catalog/i, <BookOpen key="i" />],
  [/suite|test/i, <FlaskConical key="i" />],
  [/table/i, <Table2 key="i" />],
  [/measure|metric/i, <Sigma key="i" />],
  [/relationship|diagram|graph/i, <Network key="i" />],
  [/try|ask|play/i, <Sparkles key="i" />],
  [/pager|doc|spec/i, <FileText key="i" />],
  [/action|todo|task/i, <ListTodo key="i" />],
  [/renew/i, <RefreshCw key="i" />],
  [/session|live/i, <Radio key="i" />],
  [/setting/i, <Settings key="i" />],
  [/health/i, <ChartColumn key="i" />],
  [/about|help/i, <Info key="i" />],
];

function navIcon(item: NavItem): ReactNode {
  if (item.icon) return item.icon;
  return ICON_RULES.find(([re]) => re.test(item.label))?.[1] ?? <CircleDot />;
}

/* ------------------------------------------------------------------ identity menu */

const THEMES: { value: ThemePref; label: string; icon: ReactNode }[] = [
  { value: 'system', label: 'System theme', icon: <Monitor /> },
  { value: 'light', label: 'Light theme', icon: <Sun /> },
  { value: 'dark', label: 'Dark theme', icon: <Moon /> },
];

function IdentityMenu() {
  const app = useApp<{ Person: Person }>();
  const [renaming, setRenaming] = useState(false);
  const [theme, setTheme] = useThemePref();
  const persona = app.config.personas.find((p) => p.sub === app.viewer.sub);
  const role = app.isAdmin ? 'Admin' : app.mode === 'demo' ? persona?.role : undefined;
  return (
    <>
      <Menu
        label="Account"
        width={280}
        placement="bottom-end"
        trigger={
          <button
            type="button"
            className="x-tap flex h-8 cursor-pointer items-center gap-2 rounded-lg pl-1 pr-1.5 text-ui transition-colors hover:bg-gray-3 data-[state=open]:bg-gray-3 sm:pr-2"
            data-testid="identity-button"
          >
            <Avatar name={app.me.displayName} size="sm" />
            <span className="hidden max-w-[150px] truncate font-medium sm:inline">{app.me.displayName}</span>
            {role && (
              <span className="hidden lg:inline-flex">
                <Tag size="sm" tone={app.isAdmin ? 'brand' : 'neutral'}>
                  {role}
                </Tag>
              </span>
            )}
            <ChevronsUpDown aria-hidden="true" className="hidden size-3.5 text-faint sm:block" strokeWidth={1.75} />
            <span className="sr-only">Account menu</span>
          </button>
        }
        header={
          <div className="flex items-center gap-2.5">
            <Avatar name={app.me.displayName} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold">{app.me.displayName}</span>
                {role && (
                  <Tag size="sm" tone={app.isAdmin ? 'brand' : 'neutral'}>
                    {role}
                  </Tag>
                )}
              </div>
              <div className="truncate text-xs text-muted">{app.viewer.email ?? 'Signed in'}</div>
            </div>
          </div>
        }
      >
        {(close) => (
          <>
            <MenuItem icon={<PenLine />} onSelect={() => setRenaming(true)} close={close}>
              Edit display name
            </MenuItem>
            <div className="flex items-center justify-between gap-2 px-2 py-1">
              <span className="text-sm text-fg">Theme</span>
              <span className="inline-flex gap-0.5 rounded-lg bg-gray-3 p-0.5">
                {THEMES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={theme === t.value}
                    aria-label={t.label}
                    title={t.label}
                    tabIndex={-1}
                    onClick={() => setTheme(t.value)}
                    className={cx(
                      'inline-flex size-6 cursor-pointer items-center justify-center rounded-md outline-none [&_svg]:size-3.5 [&_svg]:[stroke-width:1.75] focus-visible:ring-2 focus-visible:ring-[var(--focus)]',
                      theme === t.value ? 'bg-[var(--seg-on,var(--surface))] text-fg shadow-[0_0_0_1px_var(--line)]' : 'text-muted hover:text-fg',
                    )}
                  >
                    {t.icon}
                  </button>
                ))}
              </span>
            </div>
            {app.mode === 'demo' && app.switchPersona && (
              <>
                <MenuSeparator />
                <MenuLabel>Demo: view as</MenuLabel>
                {app.config.personas.map((p) => (
                  <MenuItem
                    key={p.sub}
                    role="menuitemradio"
                    checked={p.sub === app.viewer.sub}
                    testId={`persona-${p.sub}`}
                    icon={<Avatar name={p.name} size="xs" />}
                    description={p.role}
                    onSelect={() => app.switchPersona!(p.sub)}
                  >
                    {p.name}
                  </MenuItem>
                ))}
                <MenuSeparator />
                <MenuItem icon={<RotateCcw />} danger onSelect={() => app.resetDemo?.()}>
                  Reset demo data
                </MenuItem>
              </>
            )}
            {app.signOut && (
              <>
                <MenuSeparator />
                <MenuItem icon={<LogOut />} onSelect={() => void app.signOut!()}>
                  Sign out
                </MenuItem>
              </>
            )}
          </>
        )}
      </Menu>
      <RenameDialog open={renaming} onClose={() => setRenaming(false)} />
    </>
  );
}

function RenameDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const app = useApp<{ Person: Person }>();
  const [name, setName] = useState(app.me.displayName);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = useId();
  useEffect(() => {
    if (open) {
      setName(app.me.displayName);
      setErr(null);
    }
  }, [open, app.me.displayName]);
  const save = async () => {
    const msg = checkText(name, { ...DISPLAY_NAME_LIMITS, label: 'Display name' });
    if (msg) return setErr(msg);
    setBusy(true);
    try {
      await renamePerson(app.store, app.me, name);
      await app.refreshMe();
      onClose();
    } catch (e) {
      setErr(describeError(e).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Display name"
      description="Shown next to your votes, comments and requests."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" busy={busy} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <Field label="Name shown to others" htmlFor={id} error={err} counter={{ value: name.length, max: DISPLAY_NAME_LIMITS.max }} className="mb-0">
        <Input id={id} value={name} onChange={(e) => setName(e.target.value)} invalid={!!err} autoComplete="name" />
      </Field>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ demo banner */

function useDismissed(key: string): [boolean, () => void] {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  });
  return [
    dismissed,
    () => {
      setDismissed(true);
      try {
        sessionStorage.setItem(key, '1');
      } catch {
        /* ignore */
      }
    },
  ];
}

function DemoBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      className="x-noprint relative flex min-h-8 items-center justify-center gap-2 border-b border-line bg-surface-sunken py-1.5 pl-4 pr-10 text-xs text-muted"
      data-testid="demo-banner"
    >
      <StatusDot tone="warn" />
      <span className="min-w-0">
        <span className="font-medium text-fg">Demo mode</span>
        <span className="hidden sm:inline"> · Sample data stored in this browser only. Deployed apps use Fabric sign-in and a Fabric SQL database.</span>
        <span className="sm:hidden"> · Sample data, this browser only.</span>
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss demo notice"
        className="x-tap absolute right-2 top-1/2 inline-flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-faint hover:bg-gray-3 hover:text-fg"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ shell */

/** The 3–4 destinations in the phone tab bar; the rest go under More. */
function splitNav(items: NavItem[]) {
  if (items.length <= 4) return { primary: items, more: [] as NavItem[] };
  return { primary: items.slice(0, 3), more: items.slice(3) };
}

function TabBar({ items }: { items: NavItem[] }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const { primary, more } = splitNav(items);
  const tab = (active: boolean) =>
    cx(
      'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium leading-none no-underline transition-colors',
      active ? 'text-fg' : 'text-muted',
    );
  const pill = (active: boolean) =>
    cx(
      'inline-flex h-7 w-11 items-center justify-center rounded-full transition-colors [&_svg]:size-[18px] [&_svg]:[stroke-width:1.75]',
      active ? 'bg-accent-3 text-accent-11' : '',
    );
  return (
    <>
      <nav
        aria-label="Main"
        className="x-tabbar x-noprint fixed inset-x-0 bottom-0 z-30 border-t border-line bg-[color-mix(in_oklab,var(--surface)_92%,transparent)] pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <div className="mx-auto flex h-14 max-w-md items-stretch px-2">
          {primary.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => tab(isActive)}>
              {({ isActive }) => (
                <>
                  <span className={pill(isActive)} aria-hidden="true">
                    {navIcon(n)}
                  </span>
                  <span className="max-w-full truncate px-1">{n.label}</span>
                </>
              )}
            </NavLink>
          ))}
          {more.length > 0 && (
            <button type="button" className={cx(tab(moreOpen), 'cursor-pointer')} onClick={() => setMoreOpen(true)} aria-haspopup="dialog">
              <span className={pill(false)} aria-hidden="true">
                <Ellipsis />
              </span>
              <span>More</span>
            </button>
          )}
        </div>
      </nav>
      {more.length > 0 && (
        <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
          <nav aria-label="More" className="-mx-2 flex flex-col">
            {more.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  cx(
                    'flex h-12 items-center gap-3 rounded-lg px-2 text-base no-underline [&_svg]:size-5 [&_svg]:[stroke-width:1.75]',
                    isActive ? 'bg-gray-3 font-medium text-fg' : 'text-fg hover:bg-gray-3',
                  )
                }
              >
                <span className="text-muted">{navIcon(n)}</span>
                {n.label}
              </NavLink>
            ))}
          </nav>
        </Sheet>
      )}
    </>
  );
}

/**
 * Standard page chrome: 52px header (logomark, nav, identity), slim demo strip, main, one-line footer, phone tab bar.
 * `immersive`: main is full-bleed and fills the viewport under the header (desktop), no footer; for StagePage.
 */
export function AppShell({ children, wide, immersive }: { children: ReactNode; wide?: boolean; immersive?: boolean }) {
  const app = useApp();
  const items = app.config.nav.filter((n) => !n.adminOnly || app.isAdmin);
  const [bannerDismissed, dismissBanner] = useDismissed(`x10:${app.config.appId}:demo-banner`);
  const max = wide ? 'max-w-[var(--content-wide)]' : 'max-w-[var(--content-max)]';
  return (
    <div className={cx('flex min-h-screen flex-col pb-[var(--x-bottom-inset)]', immersive && 'md:h-dvh md:min-h-0 md:overflow-hidden')}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:shadow-1"
      >
        Skip to content
      </a>
      {app.mode === 'demo' && !bannerDismissed && <DemoBanner onDismiss={dismissBanner} />}
      <header className="x-noprint sticky top-0 z-30 h-[var(--header-h)] border-b border-line bg-[color-mix(in_oklab,var(--bg)_86%,transparent)] backdrop-blur-md">
        <div className={cx('mx-auto flex h-full items-center gap-4 px-4 sm:px-6 lg:gap-8', max)}>
          <Link to="/" className="group flex min-w-0 shrink-0 items-center gap-2.5 text-fg no-underline">
            <AppLogo size={24} />
            <span className="truncate text-sm font-semibold tracking-[-0.01em]">{app.config.title}</span>
            {app.mode === 'demo' && bannerDismissed && (
              <Badge variant="soft" size="sm" tone="warn">
                Demo
              </Badge>
            )}
          </Link>
          <nav aria-label="Main" className="hidden h-full min-w-0 items-stretch gap-0.5 md:flex">
            {items.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cx(
                    'group/nav relative flex shrink-0 items-center text-ui font-medium no-underline transition-colors',
                    'after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:transition-colors',
                    isActive ? 'text-fg after:bg-fg' : 'text-muted after:bg-transparent hover:text-fg',
                  )
                }
              >
                <span className="rounded-md px-2 py-1.5 transition-colors group-hover/nav:bg-gray-3">{n.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <IdentityMenu />
          </div>
        </div>
      </header>
      <main
        id="main"
        className={immersive ? 'relative flex w-full flex-1 flex-col md:min-h-0' : cx('mx-auto w-full flex-1 px-4 pt-6 pb-10 sm:px-6 md:pt-8', max)}
      >
        {children}
      </main>
      {!immersive && <Footer />}
      <TabBar items={items} />
    </div>
  );
}

export function Footer() {
  const title = useContext(AppCtx)?.config.title ?? null;
  return (
    <footer className="x-noprint border-t border-line">
      <div className="mx-auto flex max-w-[var(--content-max)] flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-4 text-xs text-faint sm:px-6">
        <span>
          {title ? `${title} · ` : ''}Built by Datachain Consulting for AI @Work
        </span>
        <Link to="/about" className="text-faint hover:text-fg">
          About this app
        </Link>
      </div>
    </footer>
  );
}

/** Wraps admin-only pages. */
export function AdminOnly({ children }: { children: ReactNode }) {
  const app = useApp();
  if (app.isAdmin) return <>{children}</>;
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <div className="mb-4 grid size-10 place-items-center rounded-[10px] bg-surface text-muted shadow-[0_0_0_1px_var(--line)]">
        <Lock className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
      </div>
      <h1 className="m-0 text-lg font-semibold">Admins only</h1>
      <p className="m-0 mt-1 max-w-[46ch] text-sm text-muted">
        This page is for admins. An admin is a Person row with isAdmin set, which the deployer sets with one SQL statement
        (see the README).
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ boot, start error, sign-in */

/** Shown while the app boots: the shell's outline, so the first paint matches the final layout. */
export function BootScreen({ config }: { config: { title: string; logo?: ReactNode; logoPaths?: string[] } }) {
  return (
    <div className="flex min-h-screen flex-col" aria-busy="true">
      <div className="h-[var(--header-h)] border-b border-line">
        <div className="mx-auto flex h-full max-w-[var(--content-max)] items-center gap-2.5 px-4 sm:px-6">
          <AppLogo size={24} config={config} />
          <span className="text-sm font-semibold tracking-[-0.01em]">{config.title}</span>
          <span className="ml-auto">
            <Skeleton circle width={24} height={24} />
          </span>
        </div>
      </div>
      <div className="mx-auto w-full max-w-[var(--content-max)] px-4 pt-8 sm:px-6" role="status" aria-label={`Loading ${config.title}`}>
        <Skeleton height={22} width={220} />
        <Skeleton height={12} width={320} className="mt-3 max-w-full" />
        <div className="mt-8 overflow-hidden rounded-xl border border-line">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 border-b border-line px-4 py-4 last:border-b-0">
              <Skeleton circle width={20} height={20} />
              <Skeleton height={10} width={`${40 + i * 9}%`} />
            </div>
          ))}
        </div>
        <span className="sr-only">Loading {config.title}…</span>
      </div>
    </div>
  );
}

export function StartError({
  config,
  error,
  onRetry,
}: {
  config: { title: string; logo?: ReactNode; logoPaths?: string[] };
  error: AppErrorInfo;
  onRetry: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-center gap-2.5">
        <AppLogo size={28} config={config} />
        <h1 className="m-0 text-lg font-semibold">{config.title}</h1>
      </div>
      <ErrorPanel error={error} title="The app could not start" onRetry={onRetry} />
    </main>
  );
}

function MicrosoftMark() {
  return (
    <svg viewBox="0 0 21 21" width="16" height="16" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

/**
 * Fabric sign-in. Every sign-in error is caught and its message shown: errors from `onSignIn` arrive through
 * `error`, and anything thrown here is caught too.
 */
export function SignInPage({
  title,
  tagline,
  error,
  onSignIn,
  logo,
  logoPaths,
}: {
  title: string;
  tagline: string;
  error: string | null;
  onSignIn: () => Promise<void>;
  logo?: ReactNode;
  logoPaths?: string[];
}) {
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const shown = error ?? localError;
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(70% 45% at 50% 0%, color-mix(in oklab, var(--accent-9) 13%, transparent), transparent 70%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage: 'radial-gradient(var(--gray-6) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          maskImage: 'radial-gradient(60% 50% at 50% 30%, black, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(60% 50% at 50% 30%, black, transparent 75%)',
        }}
      />
      <div className="relative w-full max-w-[360px] text-center">
        <AppLogo size={48} config={{ title, logo, logoPaths }} className="mx-auto" />
        <h1 className="m-0 mt-6 text-2xl font-semibold">{title}</h1>
        <p className="m-0 mt-2 text-sm text-muted">{tagline}</p>
        <Button
          size="lg"
          className="mt-8 w-full"
          busy={busy}
          icon={<MicrosoftMark />}
          onClick={async () => {
            setBusy(true);
            setLocalError(null);
            try {
              await onSignIn();
            } catch (err) {
              setLocalError(describeError(err).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Sign in with Microsoft
        </Button>
        {shown && (
          <div role="alert" className="mt-4 rounded-lg border border-bad-line/70 bg-bad-soft/60 px-3 py-2.5 text-left text-ui text-fg">
            <span className="font-medium text-bad">Sign-in failed. </span>
            {shown}
          </div>
        )}
        <p className="m-0 mt-8 text-xs text-faint">Uses your Fabric (Microsoft Entra ID) sign-in. You need access to this app item.</p>
      </div>
    </main>
  );
}

