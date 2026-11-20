/**
 * UI kit playground. Every component and state, every accent, light and dark.
 *   npm run playground -w shared   →  http://localhost:5200
 * URL params: ?accent=<name>&theme=light|dark   Routes: #/ (catalog), #/shell, #/signin, #/boot
 */
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import './playground.css';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Link, Route, Routes } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  ChartColumn,
  Download,
  Filter,
  FlaskConical,
  LayoutGrid,
  List as ListIcon,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings,
  Share2,
  SquareKanban,
  Trash2,
  Users,
} from 'lucide-react';

import {
  ACCENTS,
  Avatar,
  AvatarStack,
  Badge,
  Button,
  Callout,
  Card,
  Checkbox,
  Chip,
  ConfirmDialog,
  CopyButton,
  Countdown,
  DataState,
  Dialog,
  EmptyState,
  ErrorPanel,
  Field,
  FilterSelect,
  IconButton,
  InlineError,
  Input,
  Kbd,
  KpiCard,
  KpiRow,
  LinkButton,
  List,
  LoadingBlock,
  LogoTile,
  Menu,
  Meter,
  PageHeader,
  Popover,
  Progress,
  ProgressRing,
  SearchInput,
  SegmentedControl,
  Select,
  ShareBar,
  Sheet,
  Skeleton,
  SkeletonText,
  Spinner,
  Stat,
  StatStrip,
  StatusDot,
  Switch,
  Table,
  TableWrap,
  Tabs,
  Tag,
  Td,
  TextArea,
  Th,
  Timeline,
  Toast,
  Toolbar,
  Tooltip,
  Tr,
  cx,
  type AccentName,
  type Tone,
} from '../src/ui';
import { Heatmap, SimpleBarChart, SimpleLineChart, SimpleScatterChart } from '../src/ui/charts';
import { AppCtx, type AppContextValue } from '../src/runtime/context';
import { AppShell, BootScreen, SignInPage } from '../src/runtime/shell';
import { applyAccent, applyTheme, type ThemePref } from '../src/runtime/theme';
import {
  Breadcrumb,
  FloatingPanel,
  Legend,
  LensBar,
  TodayPanel,
  ViewAsSwitch,
  ViewToggle,
  WORLD_TOKENS,
  supportsWebGL,
  useReducedMotion,
  type StageView,
} from '../src/ui';
import { StageDemo } from './stage-demo';

/* ------------------------------------------------------------------ settings from the URL */

const params = new URLSearchParams(window.location.search);
const initialAccent = (ACCENTS as readonly string[]).includes(params.get('accent') ?? '') ? (params.get('accent') as AccentName) : 'indigo';
const initialTheme = (['light', 'dark'].includes(params.get('theme') ?? '') ? params.get('theme') : 'system') as ThemePref;
applyAccent(initialAccent);
applyTheme(initialTheme);

function setParam(k: string, v: string | null) {
  const p = new URLSearchParams(window.location.search);
  if (v === null) p.delete(k);
  else p.set(k, v);
  const q = p.toString();
  history.replaceState(null, '', `${window.location.pathname}${q ? `?${q}` : ''}${window.location.hash}`);
}

function useSettings() {
  const [accent, setAccentState] = useState<AccentName>(initialAccent);
  const [theme, setThemeState] = useState<ThemePref>(initialTheme);
  const setAccent = (a: AccentName) => {
    setAccentState(a);
    applyAccent(a);
    setParam('accent', a);
  };
  const setTheme = (t: ThemePref) => {
    setThemeState(t);
    applyTheme(t);
    setParam('theme', t === 'system' ? null : t);
  };
  return { accent, setAccent, theme, setTheme };
}

/* ------------------------------------------------------------------ sample data */

const LOGOS: Partial<Record<AccentName, ReactNode>> = {
  indigo: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4 4L19 7" />
    </svg>
  ),
  ember: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      <path d="M7 7l10 10M17 7L7 17" />
    </svg>
  ),
  teal: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      <path d="M5 7h14M5 12h10M5 17h6" />
    </svg>
  ),
};

const REQUESTS = [
  { id: 'R-1042', title: 'Overdue purchase orders by buyer', team: 'Procurement', score: 14, age: 3, status: 'new', owner: 'Priya Nair', supporters: ['Priya Nair', 'Tom Becker', 'Chen Wei', 'Noor Haddad', 'Liam Murphy'] },
  { id: 'R-1039', title: 'Weekly sales pipeline by region', team: 'Sales', score: 11, age: 9, status: 'triaged', owner: 'Jordan Lee', supporters: ['Jordan Lee', 'Maria Santos'] },
  { id: 'R-1031', title: 'Invoice processing backlog by approver', team: 'Finance', score: 9, age: 16, status: 'planned', owner: 'Fatima Okafor', supporters: ['Fatima Okafor', 'Alex Rivera', 'Chen Wei'] },
  { id: 'R-1027', title: 'Warehouse bin utilisation, daily', team: 'Ops', score: 6, age: 24, status: 'declined', owner: 'Dana Whitfield', supporters: ['Dana Whitfield'] },
  { id: 'R-1020', title: 'Churn risk cohort for renewals', team: 'Customer', score: 4, age: 41, status: 'delivered', owner: 'Maria Santos', supporters: ['Maria Santos', 'Tom Becker'] },
];
const STATUS_TONE: Record<string, Tone> = { new: 'info', triaged: 'brand', planned: 'warn', declined: 'bad', delivered: 'ok' };
const STATUS_LABEL: Record<string, string> = { new: 'New', triaged: 'Triaged', planned: 'Planned', declined: 'Declined', delivered: 'Delivered' };

const WEEKS = ['W36', 'W37', 'W38', 'W39', 'W40', 'W41', 'W42', 'W43', 'W44', 'W45', 'W46', 'W47'];
const LINE = WEEKS.map((w, i) => ({
  week: w,
  pass: Math.round(78 + 12 * Math.sin(i / 2.2) + i * 0.9),
  fail: Math.round(14 - 6 * Math.sin(i / 2.5) - i * 0.3),
  error: Math.max(1, Math.round(5 - i * 0.25 + (i % 3))),
}));
const BARS = [
  { team: 'Finance', open: 12, triaged: 7, done: 18 },
  { team: 'Sales', open: 9, triaged: 11, done: 13 },
  { team: 'Ops', open: 15, triaged: 4, done: 9 },
  { team: 'People', open: 4, triaged: 6, done: 10 },
  { team: 'Customer', open: 7, triaged: 3, done: 6 },
];
const SCATTER = Array.from({ length: 22 }, (_, i) => ({ name: `Report ${i + 1}`, days: (i * 37) % 400, views: Math.round(80 * Math.exp(-((i * 37) % 400) / 120) + (i % 5)) }));
const HEAT_ROWS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const HEAT_COLS = ['08', '09', '10', '11', '12', '13', '14', '15', '16', '17'];
const HEAT = HEAT_ROWS.map((_, r) => HEAT_COLS.map((__, c) => Math.max(0, Math.round(6 * Math.sin((c + r) / 2) + (c === 2 ? 5 : 0) + (r === 2 ? 2 : 0)))));

const noop = () => undefined;
const TONES: Tone[] = ['ok', 'warn', 'bad', 'info', 'neutral', 'brand'];

/* ------------------------------------------------------------------ layout helpers */

const SECTIONS = [
  ['foundations', 'Foundations'],
  ['buttons', 'Buttons'],
  ['status', 'Status & labels'],
  ['forms', 'Forms'],
  ['data', 'Data display'],
  ['tables', 'Tables & lists'],
  ['overlays', 'Overlays'],
  ['states', 'States'],
  ['charts', 'Charts'],
  ['stage', 'Stage kit'],
  ['accents', 'Accents'],
] as const;

function Block({ id, title, desc, children }: { id: string; title: string; desc?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-line pt-10 first:border-t-0 first:pt-0" data-block={id}>
      <h2 className="m-0 text-xl font-semibold">{title}</h2>
      {desc && <p className="m-0 mt-1 max-w-[70ch] text-sm text-muted">{desc}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Row({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className="grid gap-x-6 gap-y-2 border-t border-line py-4 first:border-t-0 first:pt-0 md:grid-cols-[150px_minmax(0,1fr)]">
      <div className="pt-1.5 font-mono text-xs text-muted">{label}</div>
      <div className={cx('flex min-w-0 flex-wrap items-center gap-3', className)}>{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ top bar */

function TopBar({ s }: { s: ReturnType<typeof useSettings> }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-[color-mix(in_oklab,var(--bg)_86%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex min-h-[52px] max-w-[1280px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 text-fg no-underline">
          <LogoTile title="x10" size={24} logo={LOGOS.indigo} />
          <span className="text-sm font-semibold">x10 UI kit</span>
          <Tag size="sm">v2</Tag>
        </Link>
        <nav className="flex items-center gap-1 text-ui font-medium">
          {[
            ['/', 'Catalog'],
            ['/shell', 'Shell'],
            ['/signin', 'Sign-in'],
            ['/boot', 'Boot'],
            ['/stage', 'Stage'],
          ].map(([to, label]) => (
            <Link key={to} to={to} className="rounded-md px-2 py-1 text-muted no-underline hover:bg-gray-3 hover:text-fg">
              {label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1" role="radiogroup" aria-label="Accent">
            {ACCENTS.map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={s.accent === a}
                aria-label={a}
                title={a}
                data-accent={a}
                onClick={() => s.setAccent(a)}
                className={cx(
                  'size-5 cursor-pointer rounded-full bg-accent-9 transition-transform hover:scale-110',
                  s.accent === a && 'ring-2 ring-fg ring-offset-2 ring-offset-[var(--bg)]',
                )}
              />
            ))}
          </div>
          <SegmentedControl
            size="sm"
            label="Theme"
            value={s.theme}
            onChange={s.setTheme}
            options={[
              { value: 'system', label: 'Auto' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ catalog */

function Catalog() {
  return (
    <div className="mx-auto flex max-w-[1280px] gap-10 px-4 py-10 sm:px-6">
      <aside className="sticky top-24 hidden h-fit w-40 shrink-0 lg:block">
        <nav className="flex flex-col gap-0.5 text-ui">
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={`#${id}`} onClick={(e) => (e.preventDefault(), document.getElementById(id)?.scrollIntoView())} className="rounded-md px-2 py-1 text-muted no-underline hover:bg-gray-3 hover:text-fg">
              {label}
            </a>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col gap-12">
        <Foundations />
        <Buttons />
        <StatusBlock />
        <Forms />
        <DataDisplay />
        <Tables />
        <Overlays />
        <States />
        <Charts />
        <StageKit />
        <Accents />
      </div>
    </div>
  );
}

function Swatches({ name }: { name: string }) {
  return (
    <div className="grid min-w-0 flex-1 grid-cols-12 gap-1">
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} className="min-w-0">
          <div className="h-8 rounded-md ring-1 ring-inset ring-black/5" style={{ background: `var(--${name}-${i + 1})` }} />
          <div className="mt-1 text-center font-mono text-[10px] text-faint">{i + 1}</div>
        </div>
      ))}
    </div>
  );
}

function Foundations() {
  return (
    <Block id="foundations" title="Foundations" desc="Geist for UI, Geist Mono for numbers and codes, Instrument Serif for editorial headlines. 14/20 base, 4px grid.">
      <Row label="type scale" className="flex-col items-start gap-2">
        <div className="text-5xl font-semibold">Keep or kill</div>
        <div className="text-4xl font-semibold">Report board</div>
        <div className="text-3xl font-semibold">Objection window</div>
        <div className="text-2xl font-semibold">Page title, 28</div>
        <div className="text-xl font-semibold">Page title, 22</div>
        <div className="text-lg font-semibold">Section title, 18</div>
        <div className="text-base">Body large, 16. The job is the hero.</div>
        <div className="text-sm">Body, 14/20. Hierarchy through type and space, not boxes.</div>
        <div className="text-ui text-muted">UI and meta, 13. Seven people voted · updated 2m ago</div>
        <div className="text-xs text-muted">Caption, 12</div>
      </Row>
      <Row label="mono · serif" className="flex-col items-start gap-2">
        <code className="text-sm">Revenue YTD = TOTALYTD([Revenue], 'Date'[Date])</code>
        <div className="font-mono text-2xl font-medium num">1,284.50 · R-1042 · 7XK-4Q</div>
        <div className="x-serif text-4xl">Gross margin <span className="italic text-muted">noun</span></div>
      </Row>
      <Row label="gray 1–12">
        <Swatches name="gray" />
      </Row>
      <Row label="accent 1–12">
        <Swatches name="accent" />
      </Row>
      <Row label="status">
        {(['ok', 'warn', 'bad', 'info'] as const).map((t) => (
          <div key={t} className="flex items-center gap-2">
            <span className="size-6 rounded-md" style={{ background: `var(--${t}-solid)` }} />
            <span className="rounded-md px-2 py-1 text-xs font-medium" style={{ background: `var(--${t}-soft)`, color: `var(--${t}-text)` }}>
              {t}
            </span>
          </div>
        ))}
      </Row>
      <Row label="surfaces">
        {[
          ['bg', 'var(--bg)'],
          ['surface', 'var(--surface)'],
          ['surface-2', 'var(--surface-2)'],
          ['sunken', 'var(--surface-sunken)'],
          ['raised', 'var(--surface-raised)'],
        ].map(([n, v]) => (
          <div key={n} className="flex flex-col items-center gap-1">
            <div className="h-12 w-20 rounded-lg border border-line" style={{ background: v }} />
            <span className="font-mono text-[11px] text-muted">{n}</span>
          </div>
        ))}
        <div className="flex flex-col items-center gap-1">
          <div className="x-panel h-12 w-20" />
          <span className="font-mono text-[11px] text-muted">shadow-1</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="h-12 w-20 rounded-xl bg-surface-raised shadow-2" />
          <span className="font-mono text-[11px] text-muted">shadow-2</span>
        </div>
      </Row>
    </Block>
  );
}

function Buttons() {
  const [busy, setBusy] = useState(false);
  return (
    <Block id="buttons" title="Buttons" desc="sm 28 · md 32 · lg 40. Loading keeps the width. Icons are lucide at 1.75 stroke.">
      <Row label="variants">
        <Button variant="primary" icon={<Plus />}>New request</Button>
        <Button>Secondary</Button>
        <Button variant="soft">Soft</Button>
        <Button variant="subtle">Subtle</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger" icon={<Trash2 />}>Delete</Button>
      </Row>
      <Row label="sizes">
        <Button variant="primary" size="sm">Small</Button>
        <Button variant="primary">Medium</Button>
        <Button variant="primary" size="lg">Large</Button>
        <Button size="sm" iconRight={<ArrowRight />}>Next</Button>
        <Button size="lg" icon={<Download />}>Export CSV</Button>
      </Row>
      <Row label="icon-only">
        <Tooltip content="Filter">
          <IconButton label="Filter" icon={<Filter />} variant="secondary" />
        </Tooltip>
        <IconButton label="Share" icon={<Share2 />} />
        <IconButton label="Settings" icon={<Settings />} size="sm" />
        <IconButton label="More" icon={<MoreHorizontal />} variant="subtle" />
        <IconButton label="Add" icon={<Plus />} variant="primary" size="lg" />
      </Row>
      <Row label="busy · disabled">
        <Button variant="primary" busy={busy} onClick={() => (setBusy(true), setTimeout(() => setBusy(false), 1500))}>
          Run suite
        </Button>
        <Button busy>Saving</Button>
        <Button variant="primary" disabled>Disabled</Button>
        <Button disabled>Disabled</Button>
        <Spinner />
      </Row>
      <Row label="links">
        <LinkButton to="/shell" variant="primary" iconRight={<ArrowRight />}>Open shell</LinkButton>
        <LinkButton to="/signin">Sign-in page</LinkButton>
        <LinkButton href="#buttons" variant="ghost">Anchor</LinkButton>
        <a href="#buttons">Inline link</a>
      </Row>
    </Block>
  );
}

function StatusBlock() {
  const [tags, setTags] = useState(['Finance', 'Revenue', 'Monthly']);
  return (
    <Block id="status" title="Status & labels" desc="Status is a coloured dot plus a label, or a soft tag. No glyph prefixes.">
      <Row label="Chip">
        {TONES.map((t) => (
          <Chip key={t} tone={t}>
            {t === 'ok' ? 'Kept' : t === 'warn' ? 'Proposed' : t === 'bad' ? 'Retired' : t === 'info' ? 'Open' : t === 'brand' ? 'Certified' : 'Draft'}
          </Chip>
        ))}
      </Row>
      <Row label="Chip icon=false">
        {TONES.map((t) => (
          <Chip key={t} tone={t} icon={false}>
            {t}
          </Chip>
        ))}
      </Row>
      <Row label="Badge dot">
        {TONES.map((t) => (
          <Badge key={t} tone={t}>
            {t}
          </Badge>
        ))}
        <Badge tone="ok" pulse>
          Live
        </Badge>
      </Row>
      <Row label="Badge soft/solid">
        <Badge variant="soft" tone="info">In review</Badge>
        <Badge variant="soft" tone="warn">2 days left</Badge>
        <Badge variant="solid" tone="brand">Certified</Badge>
        <Badge variant="solid" tone="bad">Overdue</Badge>
        <Badge variant="solid" tone="neutral" size="sm">12</Badge>
        <Badge variant="solid" tone="ok" size="sm">PASS</Badge>
      </Row>
      <Row label="StatusDot">
        {TONES.map((t) => (
          <StatusDot key={t} tone={t} size={8} label={t} />
        ))}
        <StatusDot tone="bad" pulse size={8} label="live" />
      </Row>
      <Row label="Tag">
        {tags.map((t) => (
          <Tag key={t} onRemove={() => setTags((x) => x.filter((y) => y !== t))}>
            {t}
          </Tag>
        ))}
        <Tag mono>SUM(Sales[Amount])</Tag>
        <Tag tone="brand">Finance</Tag>
        <Tag size="sm">sm</Tag>
      </Row>
      <Row label="Kbd">
        <span className="inline-flex items-center gap-1 text-ui text-muted">
          Vote <Kbd>K</Kbd> keep, <Kbd>X</Kbd> kill · <Kbd>⌘</Kbd>
          <Kbd>K</Kbd> search · <Kbd>/</Kbd>
        </span>
      </Row>
      <Row label="Avatar">
        {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((s, i) => (
          <Avatar key={s} size={s} name={REQUESTS[i].owner} />
        ))}
        <AvatarStack names={REQUESTS[0].supporters} max={3} />
        <AvatarStack names={REQUESTS[2].supporters} size="md" />
      </Row>
    </Block>
  );
}

function Forms() {
  const [name, setName] = useState('Revenue YTD');
  const [q, setQ] = useState('');
  const [team, setTeam] = useState('all');
  const [status, setStatus] = useState('active');
  const [view, setView] = useState<'list' | 'board' | 'chart'>('list');
  const [range, setRange] = useState('30d');
  const [mine, setMine] = useState(true);
  const [notify, setNotify] = useState(true);
  return (
    <Block id="forms" title="Forms" desc="32px controls (40px on phones), hairline border, inset accent focus ring. Labels above; errors say what to fix.">
      <Row label="Toolbar" className="block">
        <Toolbar className="mb-0">
          <SearchInput value={q} onChange={setQ} placeholder="Search requests…" shortcut="/" />
          <FilterSelect label="Team" value={team} onChange={setTeam} options={[{ value: 'all', label: 'All teams' }, { value: 'fin', label: 'Finance' }, { value: 'ops', label: 'Ops' }]} />
          <FilterSelect label="Status" value={status} onChange={setStatus} options={[{ value: 'active', label: 'Open and proposed' }, { value: 'all', label: 'All' }]} />
          <Checkbox label="Mine" checked={mine} onChange={setMine} />
          <span className="ml-auto" />
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'list', label: 'List', icon: <ListIcon /> },
              { value: 'board', label: 'Board', icon: <SquareKanban /> },
              { value: 'chart', label: 'Chart', icon: <ChartColumn /> },
            ]}
          />
        </Toolbar>
      </Row>
      <Row label="fields" className="block">
        <div className="grid max-w-3xl gap-x-6 md:grid-cols-2">
          <Field label="Measure name" htmlFor="pg-name" hint="As it appears in the model." counter={{ value: name.length, max: 60 }} required>
            <Input id="pg-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Expected value" htmlFor="pg-exp" error="Enter a number, such as 1250.5.">
            <Input id="pg-exp" defaultValue="12k" invalid className="font-mono" />
          </Field>
          <Field label="Domain" htmlFor="pg-dom">
            <Select id="pg-dom" defaultValue="fin">
              <option value="fin">Finance</option>
              <option value="sales">Sales</option>
            </Select>
          </Field>
          <Field label="Disabled" htmlFor="pg-dis" hint="Locked after publishing.">
            <Input id="pg-dis" value="v1.2" disabled readOnly />
          </Field>
          <div className="md:col-span-2">
            <Field label="Root cause" htmlFor="pg-rc" hint="What happened, not who.">
              <TextArea id="pg-rc" rows={3} placeholder="The nightly load read a widened column…" />
            </Field>
          </div>
        </div>
      </Row>
      <Row label="choices">
        <Checkbox label="Notify the owner" checked={notify} onChange={setNotify} description="They get an email when the window opens." />
        <Checkbox label="Disabled" checked={false} onChange={noop} disabled />
        <div className="flex items-center gap-2">
          <Switch label="Enabled" checked={notify} onChange={setNotify} />
          <span className="text-sm">Enabled</span>
        </div>
        <Switch label="Small" size="sm" checked={!notify} onChange={(v) => setNotify(!v)} />
        <SegmentedControl size="sm" label="Range" value={range} onChange={setRange} options={[{ value: '7d', label: '7d' }, { value: '30d', label: '30d' }, { value: '90d', label: '90d' }, { value: 'all', label: 'All' }]} />
      </Row>
    </Block>
  );
}

function DataDisplay() {
  const soon = new Date(Date.now() + 26 * 60 * 1000 + 14_000);
  const days = new Date(Date.now() + 2 * 86400_000 + 5 * 3600_000);
  return (
    <Block id="data" title="Data display" desc="StatStrip replaces rows of KPI cards: one panel, hairline dividers, tabular numbers.">
      <Row label="StatStrip" className="block">
        <StatStrip>
          <Stat label="Open" value="21" hint="Taking votes" />
          <Stat label="Proposed" value="4" tone="warn" delta={{ value: '+2', direction: 'up', good: 'down' }} hint="In the 7-day window" />
          <Stat label="Retired this month" value="6" delta={{ value: '+3', direction: 'up' }} hint="11 in total" />
          <Stat label="Pass rate" value="94.2%" delta={{ value: '−1.1 pt', direction: 'down' }} />
        </StatStrip>
      </Row>
      <Row label="KpiRow (v1 API)" className="block">
        <KpiRow>
          <KpiCard label="Published" value={12} hint="Open notices" />
          <KpiCard label="At risk" value={3} tone="warn" hint="≤ 14 days, pending" />
          <KpiCard label="Overdue" value={1} tone="bad" hint="Past the date" />
          <KpiCard label="Blocked" value={0} hint="A team objected" />
        </KpiRow>
      </Row>
      <Row label="StatStrip bare" className="block">
        <Card>
          <StatStrip bare>
            <Stat size="sm" label="Cases" value="128" />
            <Stat size="sm" label="Passed" value="121" tone="ok" />
            <Stat size="sm" label="Failed" value="5" tone="bad" />
            <Stat size="sm" label="Duration" value={<span className="font-mono">4.2s</span>} />
          </StatStrip>
        </Card>
      </Row>
      <Row label="Meter · Progress" className="block">
        <div className="grid max-w-3xl gap-5 md:grid-cols-2">
          <Meter label="Kill share" value={72} showValue tone="bad" markers={[{ value: 60, label: '60% threshold' }]} />
          <Meter label="Acknowledged" value={5} max={8} showValue format={(v, m) => `${v} of ${m}`} />
          <Meter label="Budget" value={30} showValue tone="ok" size="lg" />
          <div className="flex flex-col gap-3">
            <Progress value={64} label="Run progress" />
            <Progress label="Loading" />
          </div>
        </div>
      </Row>
      <Row label="ProgressRing · ShareBar">
        <ProgressRing value={82} size={48} thickness={5}>82</ProgressRing>
        <ProgressRing value={45} size={40} tone="warn" />
        <ProgressRing value={18} size={32} tone="bad" thickness={3} />
        <div className="w-64">
          <ShareBar
            label="Votes"
            parts={[
              { label: 'Kill', value: 6, color: 'var(--chart-bad)' },
              { label: 'Keep', value: 2, color: 'var(--chart-ok)' },
            ]}
          />
          <div className="mt-1.5 flex justify-between text-xs text-muted num">
            <span>6 kill</span>
            <span>2 keep</span>
          </div>
        </div>
      </Row>
      <Row label="Countdown">
        <Countdown to={days} />
        <Countdown to={soon} />
        <Countdown to={soon} from={new Date(Date.now() - 60 * 60 * 1000)} ring />
        <Countdown to={new Date(Date.now() - 1000)} />
        <Countdown to={soon} format="clock" className="font-mono text-2xl" />
      </Row>
      <Row label="Timeline" className="block">
        <div className="max-w-md">
          <Timeline
            items={[
              { title: 'Load failed', time: '02:14', description: 'Nightly orders ingest', tone: 'bad', gap: '+38 min' },
              { title: 'Detected', time: '02:52', description: 'Alert to on-call', tone: 'warn', gap: '+1 h 06 min' },
              { title: 'Mitigated', time: '03:58', tone: 'info', gap: '+12 min' },
              { title: 'Resolved', time: '04:10', description: 'Backfill complete', tone: 'ok' },
            ]}
          />
        </div>
      </Row>
    </Block>
  );
}

function Tables() {
  const [sel, setSel] = useState('R-1039');
  return (
    <Block id="tables" title="Tables & lists" desc="Hairlines, 12px header, numbers right-aligned in mono. A list of 25 things is a list, not 25 cards.">
      <TableWrap label="Requests">
        <Table>
          <thead>
            <tr>
              <Th>Request</Th>
              <Th>Status</Th>
              <Th className="hidden md:table-cell">Supporters</Th>
              <Th numeric>Age</Th>
              <Th numeric>Score</Th>
            </tr>
          </thead>
          <tbody>
            {REQUESTS.map((r) => (
              <Tr key={r.id} selected={r.id === sel} onClick={() => setSel(r.id)}>
                <Td>
                  <div className="font-medium text-fg">{r.title}</div>
                  <div className="mt-0.5 text-xs text-muted">
                    <span className="font-mono">{r.id}</span> · {r.team}
                  </div>
                </Td>
                <Td>
                  <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                </Td>
                <Td className="hidden md:table-cell">
                  <AvatarStack names={r.supporters} max={3} size="xs" />
                </Td>
                <Td numeric muted>{r.age}d</Td>
                <Td numeric>
                  <span className="font-semibold text-fg">{r.score}</span>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <List label="Graveyard">
          {REQUESTS.slice(0, 4).map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={r.owner} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{r.title}</div>
                <div className="truncate text-xs text-muted">{r.owner} · {r.age} days ago</div>
              </div>
              <Chip tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Chip>
            </li>
          ))}
        </List>
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-muted">Primary object · Card</div>
              <h3 className="m-0 mt-1 text-lg font-semibold">Warehouse Bin Utilisation v1</h3>
              <div className="mt-1 text-ui text-muted">Ops · Dana Whitfield · last viewed 388 days ago</div>
            </div>
            <Chip tone="warn">Proposed</Chip>
          </div>
          <div className="mt-4">
            <Meter label="Kill share" value={100} showValue tone="bad" markers={[{ value: 60 }]} />
          </div>
          <div className="mt-4 flex gap-2">
            <Button className="flex-1">Keep</Button>
            <Button variant="danger" className="flex-1">Kill</Button>
          </div>
        </Card>
      </div>
    </Block>
  );
}

function Overlays() {
  const [dialog, setDialog] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useState('open');
  const clear = useCallback(() => setToast(null), []);
  return (
    <Block id="overlays" title="Overlays" desc="Floating layers live in the top layer (never clipped, above dialogs). Dialogs become bottom sheets on phones.">
      <Row label="Tabs" className="block">
        <Tabs
          label="Requests"
          value={tab}
          onChange={setTab}
          className="mb-0"
          tabs={[
            { value: 'open', label: 'Open', count: 12 },
            { value: 'answered', label: 'Answered', count: 4 },
            { value: 'hidden', label: 'Hidden' },
            { value: 'all', label: 'All' },
          ]}
        />
      </Row>
      <Row label="Tooltip · Popover · Menu">
        <Tooltip content="Score = value × 2 + urgency + supporters − effort" shortcut="S">
          <Button variant="ghost">Hover me</Button>
        </Tooltip>
        <Popover trigger={<Button iconRight={<ChartColumn />}>Score breakdown</Button>} label="Score breakdown" width={260}>
          <div className="text-xs font-medium text-muted">Score 14</div>
          <dl className="m-0 mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted">Value × 2</dt>
            <dd className="m-0 text-right font-mono">8</dd>
            <dt className="text-muted">Urgency</dt>
            <dd className="m-0 text-right font-mono">3</dd>
            <dt className="text-muted">Supporters</dt>
            <dd className="m-0 text-right font-mono">5</dd>
            <dt className="text-muted">Effort</dt>
            <dd className="m-0 text-right font-mono">−2</dd>
          </dl>
        </Popover>
        <Menu
          label="Request actions"
          trigger={<IconButton label="Actions" icon={<MoreHorizontal />} variant="secondary" />}
          items={[
            { label: 'Edit', icon: <Pencil />, shortcut: 'E', onSelect: () => setToast('Edit') },
            { label: 'Assign', icon: <Users />, onSelect: () => setToast('Assign') },
            { label: 'Notify supporters', icon: <Bell />, onSelect: () => setToast('Notified') },
            { type: 'separator' },
            { type: 'label', label: 'Move to' },
            { label: 'Triaged', checked: true, role: 'menuitemradio' },
            { label: 'Planned', checked: false, role: 'menuitemradio' },
            { type: 'separator' },
            { label: 'Delete', icon: <Trash2 />, danger: true, onSelect: () => setConfirm(true) },
          ]}
        />
      </Row>
      <Row label="Dialog · Sheet">
        <Button onClick={() => setDialog(true)}>Dialog</Button>
        <Button onClick={() => setDrawer(true)}>Drawer</Button>
        <Button onClick={() => setSheet(true)}>Sheet</Button>
        <Button variant="danger" onClick={() => setConfirm(true)}>Confirm…</Button>
      </Row>
      <Row label="Toast">
        <Button onClick={() => setToast('Your Kill vote is in.')}>Toast</Button>
        <Button onClick={() => setToast('Moved to Declined.')}>Toast with Undo</Button>
        <CopyButton text="7XK-4Q" label="Copy join code" />
      </Row>
      <Dialog
        open={dialog}
        onClose={() => setDialog(false)}
        title="Move to Triaged"
        description="Supporters are notified."
        footer={
          <>
            <Button onClick={() => setDialog(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => setDialog(false)}>
              Move
            </Button>
          </>
        }
      >
        <Field label="Note to the requester" htmlFor="pg-note" hint="Optional." className="mb-0">
          <TextArea id="pg-note" rows={3} />
        </Field>
      </Dialog>
      <Dialog open={drawer} onClose={() => setDrawer(false)} title="Case · Revenue YTD" drawer>
        <SkeletonText lines={6} />
      </Dialog>
      <Sheet open={sheet} onClose={() => setSheet(false)} title="Filters" footer={<Button variant="primary" onClick={() => setSheet(false)}>Show 12 results</Button>}>
        <Field label="Team" htmlFor="pg-team">
          <Select id="pg-team">
            <option>All teams</option>
          </Select>
        </Field>
        <Checkbox label="Only mine" checked onChange={noop} />
      </Sheet>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Decline request"
        body="The requester sees the reason."
        confirmLabel="Decline request"
        danger
        noteLabel="Reason"
        noteRequired
        onConfirm={async () => setToast('Declined.')}
      />
      <Toast message={toast} onDone={clear} tone={toast?.startsWith('Your') ? 'ok' : undefined} action={toast?.startsWith('Moved') ? { label: 'Undo', onClick: noop } : undefined} />
    </Block>
  );
}

function States() {
  const loading = { data: undefined, loading: true, error: null, reload: noop };
  const error = { data: undefined, loading: false, error: { category: 'network', message: 'The Fabric API did not answer within 60 seconds.' }, reload: noop };
  const empty = { data: [] as string[], loading: false, error: null, reload: noop };
  return (
    <Block id="states" title="States" desc="Loading skeletons match the layout; empty states teach the next action; errors say what happened and offer Retry.">
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <div className="mb-2 font-mono text-xs text-muted">DataState · loading</div>
          <DataState state={loading} loadingRows={3}>
            {() => null}
          </DataState>
        </div>
        <div>
          <div className="mb-2 font-mono text-xs text-muted">DataState · error</div>
          <DataState state={error}>{() => null}</DataState>
        </div>
        <div>
          <div className="mb-2 font-mono text-xs text-muted">DataState · empty</div>
          <Card className="p-0">
            <DataState
              state={empty}
              isEmpty={(d) => d.length === 0}
              empty={
                <EmptyState title="No test suites yet" icon={<FlaskConical />} action={<Button variant="primary" icon={<Plus />}>New suite</Button>}>
                  A suite checks measures against expected values. Start with the one your execs read.
                </EmptyState>
              }
            >
              {() => null}
            </DataState>
          </Card>
        </div>
        <div className="flex flex-col gap-4">
          <div className="font-mono text-xs text-muted">EmptyState · bordered, compact</div>
          <EmptyState bordered compact title="No reports match these filters" icon={<Search />} action={<Button size="sm">Clear filters</Button>}>
            Try another workspace or status.
          </EmptyState>
          <Callout tone="warn" title="Blameless tip">
            Describe the system, not the person: “the deploy skipped the check”.
          </Callout>
          <Callout tone="info" action={<Button size="sm">Review</Button>}>3 notices need your acknowledgement.</Callout>
          <InlineError error="Title must be 120 characters or fewer." />
          <ErrorPanel error={{ category: 'permission', message: 'Only the host can pin questions.' }} title="Could not pin" />
        </div>
        <div className="md:col-span-2">
          <div className="mb-2 font-mono text-xs text-muted">Skeleton · custom layout</div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl border border-line bg-surface p-4">
                <Skeleton width={64} height={18} className="rounded-md" />
                <Skeleton height={14} width="80%" className="mt-4" />
                <Skeleton height={10} width="45%" className="mt-2" />
                <Skeleton height={6} className="mt-6 rounded-full" />
              </div>
            ))}
          </div>
          <div className="mt-4">
            <LoadingBlock rows={2} />
          </div>
        </div>
      </div>
    </Block>
  );
}

function Charts() {
  return (
    <Block id="charts" title="Charts" desc="Hairline grid, no chart junk, accent-led palette, direct labels, tooltips that match the UI.">
      <div className="grid gap-6 lg:grid-cols-2">
        <SimpleLineChart
          title="Results per run"
          description="Last 12 weekly runs"
          summary="Pass rises from 78 to 96."
          data={LINE}
          xKey="week"
          series={[
            { key: 'pass', label: 'Pass' },
            { key: 'fail', label: 'Fail' },
            { key: 'error', label: 'Error' },
          ]}
        />
        <SimpleBarChart
          title="Requests by team"
          description="Stacked by status"
          summary="Finance has the most."
          data={BARS}
          xKey="team"
          stacked
          series={[
            { key: 'done', label: 'Done' },
            { key: 'triaged', label: 'Triaged' },
            { key: 'open', label: 'Open' },
          ]}
        />
        <SimpleBarChart title="Kill share by workspace" summary="Ops highest." data={BARS} xKey="team" horizontal series={[{ key: 'open', label: 'Kill votes' }]} height={220} />
        <SimpleScatterChart title="Views vs staleness" summary="Views fall with staleness." data={SCATTER} xKey="days" yKey="views" labelKey="name" xLabel="Days since viewed" yLabel="Views" height={220} />
        <div className="lg:col-span-2">
          <Heatmap title="Incidents by hour" description="Detected time, last 90 days" summary="Peaks Wednesday 10:00." rows={HEAT_ROWS} cols={HEAT_COLS} values={HEAT} />
        </div>
        <SimpleBarChart title="Empty" summary="No data." data={[]} xKey="team" series={[{ key: 'open', label: 'Open' }]} height={140} />
      </div>
    </Block>
  );
}

function StageKit() {
  const [lens, setLens] = useState('health');
  const [who, setWho] = useState('host');
  const [view, setView] = useState<StageView>('stage');
  const [active, setActive] = useState<string | null>('a');
  const reduced = useReducedMotion();
  return (
    <Block id="stage" title="Stage kit" desc="For the centrepieces: floating glass panels, lenses (keys 1–9), view-as (V), legend, Today, breadcrumb, map ↔ list (L). See #/stage for the full layout.">
      <div className="relative overflow-hidden rounded-2xl border border-line p-6" style={{ background: 'linear-gradient(180deg, var(--world-sky), var(--world-sky-2))' }}>
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: 'linear-gradient(180deg, transparent, var(--world-ground))' }} />
        <div className="relative grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="flex min-w-0 flex-col gap-4">
            <FloatingPanel padding="none" className="w-fit max-w-full px-4 py-3">
              <Breadcrumb items={[{ label: 'Tenant', href: '#stage' }, { label: 'Finance town', href: '#stage' }, { label: 'Ledger workspace' }]} />
              <h3 className="m-0 mt-1 text-xl font-semibold">Ledger workspace</h3>
              <div className="mt-1 text-ui text-muted">12 items · refreshed 2h ago</div>
            </FloatingPanel>
            <LensBar
              lenses={[
                { value: 'health', label: 'Health', swatch: 'var(--ok-solid)' },
                { value: 'age', label: 'Staleness', swatch: 'var(--amber-9)' },
                { value: 'owner', label: 'Owner', swatch: 'var(--indigo-9)' },
                { value: 'size', label: 'Size', swatch: 'var(--gray-9)' },
              ]}
              value={lens}
              onChange={setLens}
              hotkeys={false}
            />
            <div className="flex flex-wrap items-center gap-3">
              <ViewAsSwitch value={who} onChange={setWho} cycleKey={false} options={[{ value: 'host', label: 'Host', name: 'Alex Rivera' }, { value: 'attendee', label: 'Attendee', name: 'Jordan Lee' }]} />
              <ViewToggle value={view} onChange={setView} glass hotkey={false} />
            </div>
            <div className="flex flex-wrap items-start gap-4">
              <Legend
                title="Health"
                items={[
                  { label: 'Healthy', color: 'var(--ok-solid)', shape: 'square', value: 11 },
                  { label: 'Warning', color: 'var(--warn-solid)', shape: 'square', value: 3 },
                  { label: 'Failing', color: 'var(--bad-solid)', shape: 'square', value: 2 },
                  { label: 'Active rel.', color: 'var(--gray-11)', shape: 'line' },
                  { label: 'Inactive rel.', color: 'var(--gray-9)', shape: 'dash' },
                ]}
              />
              <Legend title="Collapsible" collapsible defaultOpen={false} items={[{ label: 'Lit window', color: 'var(--world-glow)' }]} />
              <FloatingPanel title="FloatingPanel" className="w-56">
                <p className="m-0 text-sm text-muted">16px radius, translucent, blurred, hairline, soft shadow.</p>
              </FloatingPanel>
            </div>
          </div>
          <TodayPanel
            date="Fri 20 Nov"
            activeId={active}
            onSelect={(it) => setActive(it.id)}
            items={[
              { id: 'a', title: 'Orders ingest failed overnight', severity: 'bad', value: 3, unit: 'runs', lens: 'Health', meta: 'Finance' },
              { id: 'b', title: 'Pipeline report is the stalest', severity: 'warn', value: 118, unit: 'days', lens: 'Staleness', meta: 'Sales' },
              { id: 'c', title: 'Two notices depart this week', severity: 'info', value: 2, lens: 'Departures' },
            ]}
          />
        </div>
      </div>
      <Row label="TodayPanel empty">
        <TodayPanel items={[]} className="w-80" />
      </Row>
      <Row label="world tokens" className="block">
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {WORLD_TOKENS.map((t) => (
            <div key={t} className="min-w-0">
              <div className="h-10 rounded-lg ring-1 ring-inset ring-black/5" style={{ background: `var(--world-${t})` }} />
              <div className="mt-1 truncate font-mono text-[10px] text-muted">{t}</div>
            </div>
          ))}
        </div>
      </Row>
      <Row label="helpers">
        <span className="font-mono text-xs text-muted">supportsWebGL() = {String(supportsWebGL())} · useReducedMotion() = {String(reduced)}</span>
        <span className="print-only">print-only</span>
        <span className="no-print font-mono text-xs text-muted">.no-print / .print-only</span>
      </Row>
    </Block>
  );
}

function Accents() {
  return (
    <Block id="accents" title="Accents" desc="Each app sets one accent; components follow it. Every text/solid pair passes AA in both themes.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {ACCENTS.map((a) => (
          <div key={a} data-accent={a} className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center gap-2.5">
              <LogoTile title={a} size={28} logo={LOGOS[a]} />
              <div className="min-w-0">
                <div className="text-sm font-semibold capitalize">{a}</div>
                <div className="font-mono text-[11px] text-muted">--accent-9</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="primary" size="sm">Primary</Button>
              <Button variant="soft" size="sm">Soft</Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant="soft" tone="brand">Tag</Badge>
              <a href="#accents" className="text-ui">Link</a>
              <Switch label={`${a} switch`} size="sm" checked onChange={noop} />
            </div>
            <Meter className="mt-4" value={62} size="sm" />
          </div>
        ))}
      </div>
    </Block>
  );
}

/* ------------------------------------------------------------------ shell preview */

const PERSONAS = [
  { sub: 'demo-admin', name: 'Alex Rivera', email: 'alex@example.com', isAdmin: true, role: 'Admin' },
  { sub: 'demo-owner', name: 'Priya Nair', email: 'priya@example.com', isAdmin: false, role: 'Report owner' },
  { sub: 'demo-voter', name: 'Jordan Lee', email: 'jordan@example.com', isAdmin: false, role: 'Voter' },
];

function fakeApp(accent: AccentName): AppContextValue<object> {
  return {
    config: {
      appId: 'playground',
      title: 'Request Triage',
      tagline: 'A ranked queue for report requests.',
      defs: {} as never,
      personas: PERSONAS,
      seed: async () => undefined,
      nav: [
        { to: '/stage', label: 'Map' },
        { to: '/shell', label: 'Queue', end: true },
        { to: '/shell/submit', label: 'Submit' },
        { to: '/shell/board', label: 'Board' },
        { to: '/shell/insights', label: 'Insights' },
        { to: '/about', label: 'About' },
      ],
      accent,
      logo: LOGOS.teal,
    },
    mode: 'demo',
    store: {} as never,
    viewer: PERSONAS[0],
    me: { id: '1', sub: 'demo-admin', displayName: 'Alex Rivera', email: 'alex@example.com', isAdmin: true, createdAt: '' },
    isAdmin: true,
    client: null,
    refreshMe: async () => undefined,
    switchPersona: noop,
    resetDemo: noop,
  };
}

function ShellPreview({ accent }: { accent: AccentName }) {
  const [q, setQ] = useState('');
  const [team, setTeam] = useState('all');
  return (
    <AppCtx.Provider value={fakeApp(accent)}>
      <AppShell>
        <PageHeader
          title="Queue"
          subtitle="Ranked by score. Aging shows on each row."
          actions={
            <>
              <IconButton label="Board view" icon={<LayoutGrid />} variant="secondary" />
              <LinkButton to="/shell/submit" variant="primary" icon={<Plus />}>
                New request
              </LinkButton>
            </>
          }
        />
        <StatStrip>
          <Stat label="New" value="7" hint="Waiting for triage" />
          <Stat label="Oldest untriaged" value="16d" tone="warn" />
          <Stat label="Planned" value="12" delta={{ value: '+3', direction: 'up' }} />
          <Stat label="Delivered this month" value="5" />
        </StatStrip>
        <Toolbar className="mt-8">
          <SearchInput value={q} onChange={setQ} placeholder="Search requests…" shortcut="/" />
          <FilterSelect label="Team" value={team} onChange={setTeam} options={[{ value: 'all', label: 'All teams' }, { value: 'fin', label: 'Finance' }]} />
        </Toolbar>
        <TableWrap label="Queue">
          <Table>
            <thead>
              <tr>
                <Th>Request</Th>
                <Th>Status</Th>
                <Th numeric>Age</Th>
                <Th numeric>Score</Th>
              </tr>
            </thead>
            <tbody>
              {REQUESTS.map((r) => (
                <Tr key={r.id}>
                  <Td>
                    <div className="font-medium">{r.title}</div>
                    <div className="mt-0.5 text-xs text-muted">{r.team} · {r.owner}</div>
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                  </Td>
                  <Td numeric muted>{r.age}d</Td>
                  <Td numeric className="font-semibold">{r.score}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      </AppShell>
    </AppCtx.Provider>
  );
}

function StagePreview({ accent, noWebGL }: { accent: AccentName; noWebGL?: boolean }) {
  return (
    <AppCtx.Provider value={fakeApp(accent)}>
      <AppShell immersive>
        <StageDemo forceNoWebGL={noWebGL} />
      </AppShell>
    </AppCtx.Provider>
  );
}

/* ------------------------------------------------------------------ app */

function Playground() {
  const s = useSettings();
  useEffect(() => {
    document.title = 'x10 UI kit';
  }, []);
  return (
    <Routes>
      <Route path="/shell/*" element={<ShellPreview accent={s.accent} />} />
      <Route path="/about" element={<ShellPreview accent={s.accent} />} />
      <Route
        path="/signin"
        element={
          <SignInPage
            title="Request Triage"
            tagline="A ranked queue for report requests, scored and visible to everyone."
            error={params.get('error') ? 'ACCESS_DENIED: you do not have access to this app item.' : null}
            onSignIn={() => new Promise((r) => setTimeout(r, 1200))}
            logo={LOGOS.teal}
          />
        }
      />
      <Route path="/boot" element={<BootScreen config={{ title: 'Request Triage', logo: LOGOS.teal }} />} />
      <Route path="/stage" element={<StagePreview accent={s.accent} />} />
      <Route path="/stage-nowebgl" element={<StagePreview accent={s.accent} noWebGL />} />
      <Route
        path="*"
        element={
          <>
            <TopBar s={s} />
            <Catalog />
            <footer className="border-t border-line py-6 text-center text-xs text-faint">
              @x10/shared/ui · see shared/src/ui/README.md
            </footer>
          </>
        }
      />
    </Routes>
  );
}

createRoot(document.getElementById('root')!).render(
  <HashRouter>
    <Playground />
  </HashRouter>,
);
