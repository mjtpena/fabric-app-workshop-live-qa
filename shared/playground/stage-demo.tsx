/**
 * Playground demo of the stage kit: an isometric SVG town (domains are towns, workspaces houses) re-painted by
 * lenses, with a Today panel that focuses houses, a view-as switch and the list fallback. Illustrative only: apps
 * build their own centrepiece from DESIGN.md §3.
 */
import { useMemo, useState } from 'react';
import { CloudOff, Search } from 'lucide-react';

import {
  Badge,
  Button,
  Input,
  Legend,
  LensBar,
  StageMessage,
  StagePage,
  Table,
  TableWrap,
  Td,
  Th,
  TodayPanel,
  Tr,
  ViewAsSwitch,
  ViewToggle,
  useReducedMotion,
  useThemeColors,
  type LegendItem,
  type StageView,
  type TodayItem,
  type Tone,
} from '../src/ui';

type Status = 'ok' | 'warn' | 'bad';
interface House {
  id: string;
  name: string;
  town: string;
  owner: string;
  status: Status;
  age: number; // days since refresh
  size: number; // 1..3
  i: number;
  j: number;
}

const TOWNS = [
  { name: 'Finance', i0: 1, j0: 1 },
  { name: 'Sales', i0: 7, j0: 1 },
  { name: 'Ops', i0: 1, j0: 7 },
  { name: 'People', i0: 7, j0: 7 },
];
const OWNERS = ['Priya Nair', 'Tom Becker', 'Chen Wei', 'Noor Haddad'];
const NAMES = ['Ledger', 'Close', 'Treasury', 'Forecast', 'Pipeline', 'Quota', 'Deals', 'Margin', 'Fleet', 'Stock', 'Bins', 'Routes', 'Headcount', 'Payroll', 'Hiring', 'Survey'];

const HOUSES: House[] = TOWNS.flatMap((t, ti) =>
  [0, 1, 2, 3].map((k) => {
    const n = ti * 4 + k;
    const status: Status = n % 7 === 3 ? 'bad' : n % 5 === 2 ? 'warn' : 'ok';
    return {
      id: `ws-${n}`,
      name: `${NAMES[n]} workspace`,
      town: t.name,
      owner: OWNERS[(n * 3) % 4],
      status,
      age: (n * 23) % 120,
      size: 1 + (n % 3),
      i: t.i0 + (k % 2) * 2,
      j: t.j0 + Math.floor(k / 2) * 2,
    };
  }),
);

type LensKey = 'status' | 'age' | 'owner' | 'size';
const LENSES: { value: LensKey; label: string; swatch: string; description: string }[] = [
  { value: 'status', label: 'Health', swatch: 'var(--ok-solid)', description: 'Refresh health' },
  { value: 'age', label: 'Staleness', swatch: 'linear-gradient(90deg, var(--world-foliage-2), var(--amber-9))', description: 'Days since refresh' },
  { value: 'owner', label: 'Owner', swatch: 'conic-gradient(var(--indigo-9) 0 25%, var(--teal-9) 0 50%, var(--coral-9) 0 75%, var(--gold-9) 0)', description: 'Who owns it' },
  { value: 'size', label: 'Size', swatch: 'var(--gray-9)', description: 'Item count' },
];
const OWNER_COL = ['var(--indigo-9)', 'var(--teal-9)', 'var(--coral-9)', 'var(--gold-9)'];
const STATUS_COL: Record<Status, string> = { ok: 'var(--ok-solid)', warn: 'var(--warn-solid)', bad: 'var(--bad-solid)' };
const STATUS_LABEL: Record<Status, string> = { ok: 'Healthy', warn: 'Warning', bad: 'Failing' };

function roofColor(h: House, lens: LensKey): string {
  if (lens === 'status') return STATUS_COL[h.status];
  if (lens === 'owner') return OWNER_COL[OWNERS.indexOf(h.owner)];
  if (lens === 'size') return `color-mix(in oklab, var(--gray-9) ${30 + h.size * 23}%, var(--world-structure))`;
  const t = Math.min(1, h.age / 120);
  return `color-mix(in oklab, var(--amber-9) ${Math.round(t * 100)}%, var(--world-foliage-2))`;
}

function legendFor(lens: LensKey): LegendItem[] {
  if (lens === 'status') return (['ok', 'warn', 'bad'] as Status[]).map((s) => ({ label: STATUS_LABEL[s], color: STATUS_COL[s], shape: 'square', value: HOUSES.filter((h) => h.status === s).length }));
  if (lens === 'owner') return OWNERS.map((o, i) => ({ label: o, color: OWNER_COL[i], shape: 'square' }));
  if (lens === 'size') return [1, 2, 3].map((s) => ({ label: ['Small', 'Medium', 'Large'][s - 1], color: `color-mix(in oklab, var(--gray-9) ${30 + s * 23}%, var(--world-structure))`, shape: 'square' }));
  return [
    { label: 'Fresh', color: 'var(--world-foliage-2)', shape: 'square' },
    { label: '60 days', color: 'color-mix(in oklab, var(--amber-9) 50%, var(--world-foliage-2))', shape: 'square' },
    { label: '120+ days', color: 'var(--amber-9)', shape: 'square' },
  ];
}

/* ------------------------------------------------------------------ isometric town (SVG) */

const TW = 64;
const TH = 32;
const N = 12;
const iso = (i: number, j: number) => ({ x: (i - j) * (TW / 2), y: (i + j) * (TH / 2) });

function diamond(i: number, j: number, lift = 0) {
  const { x, y } = iso(i, j);
  return `${x},${y - lift} ${x + TW / 2},${y + TH / 2 - lift} ${x},${y + TH - lift} ${x - TW / 2},${y + TH / 2 - lift}`;
}

function Town({ lens, focus, viewAs, onPick }: { lens: LensKey; focus: string | null; viewAs: string; onPick: (id: string) => void }) {
  const reduced = useReducedMotion();
  const colors = useThemeColors();
  const river = (i: number, j: number) => Math.abs(i - j + (i > 5 ? 1 : 0)) <= 0 && i > 4 && i < 7;
  const water = (i: number, j: number) => i === 5 || j === 5 || river(i, j);
  const trees = useMemo(() => {
    const t: [number, number][] = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (!water(i, j) && (i * 7 + j * 3) % 9 === 0 && !HOUSES.some((h) => h.i === i && h.j === j)) t.push([i, j]);
    return t;
  }, []);
  const minX = -N * (TW / 2) - 8;
  const width = N * TW + 16;
  const height = N * TH + 120;
  const houses = [...HOUSES].sort((a, b) => a.i + a.j - (b.i + b.j));
  return (
    <svg viewBox={`${minX} -110 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" className="absolute inset-y-0 left-0 h-full w-[calc(100%-var(--side-w,0px))]" role="img" aria-label="Isometric town: four towns, sixteen workspaces">
      <defs>
        <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
      {/* ground */}
      {Array.from({ length: N * N }, (_, k) => {
        const i = k % N;
        const j = Math.floor(k / N);
        const w = water(i, j);
        return (
          <polygon
            key={k}
            points={diamond(i, j)}
            fill={w ? 'var(--world-water)' : (i + j) % 2 ? 'var(--world-ground)' : 'color-mix(in oklab, var(--world-ground) 70%, var(--world-ground-2))'}
            stroke="var(--world-grid)"
            strokeWidth={1}
          />
        );
      })}
      {/* trees */}
      {trees.map(([i, j]) => {
        const { x, y } = iso(i, j);
        return (
          <g key={`t${i}-${j}`}>
            <ellipse cx={x} cy={y + TH / 2 + 4} rx={10} ry={4} fill="var(--world-shadow)" />
            <circle cx={x} cy={y + TH / 2 - 8} r={10} fill="var(--world-foliage-2)" />
            <circle cx={x - 3} cy={y + TH / 2 - 11} r={6} fill="var(--world-foliage)" />
          </g>
        );
      })}
      {/* town labels */}
      {TOWNS.map((t) => {
        const { x, y } = iso(t.i0 + 1, t.j0 + 3.6);
        return (
          <text key={t.name} x={x} y={y + 20} textAnchor="middle" className="x-legend-label" fill="var(--world-ink-muted)" style={{ fontSize: 11 }}>
            {t.name}
          </text>
        );
      })}
      {/* houses */}
      {houses.map((h) => {
        const { x, y } = iso(h.i, h.j);
        const hh = 14 + h.size * 10;
        const cx = x;
        const cy = y + TH / 2;
        const w = TW * 0.32;
        const d = TH * 0.32;
        const dim = viewAs === 'owner' && h.owner !== OWNERS[0];
        const focused = focus === h.id;
        const roof = roofColor(h, lens);
        const lit = h.status === 'ok';
        return (
          <g
            key={h.id}
            onClick={() => onPick(h.id)}
            style={{ cursor: 'pointer', opacity: dim ? 0.35 : 1, transition: reduced ? undefined : 'opacity 200ms' }}
            role="button"
            aria-label={`${h.name}, ${h.town}, ${STATUS_LABEL[h.status]}`}
          >
            <ellipse cx={cx + 6} cy={cy + 6} rx={w + 6} ry={d + 3} fill="var(--world-shadow)" filter="url(#soft)" />
            {focused && (
              <ellipse cx={cx} cy={cy} rx={w + 14} ry={d + 7} fill="none" stroke="var(--accent-9)" strokeWidth={2}>
                {!reduced && <animate attributeName="opacity" values="1;0.35;1" dur="1.6s" repeatCount="indefinite" />}
              </ellipse>
            )}
            {/* left wall */}
            <polygon points={`${cx - w},${cy} ${cx},${cy + d} ${cx},${cy + d - hh} ${cx - w},${cy - hh}`} fill="var(--world-structure)" stroke="var(--world-grid)" />
            {/* right wall */}
            <polygon points={`${cx},${cy + d} ${cx + w},${cy} ${cx + w},${cy - hh} ${cx},${cy + d - hh}`} fill="var(--world-structure-2)" stroke="var(--world-grid)" />
            {/* windows: lit when healthy */}
            {Array.from({ length: h.size }, (_, r) => {
              // A window is a small parallelogram on the right wall (which rises by d over its width w).
              const u0 = 0.38;
              const u1 = 0.62;
              const top = cy + d - hh + 7 + r * 10;
              const p = (u: number, dy: number) => `${cx + w * u},${top - d * u + dy}`;
              return (
                <polygon
                  key={r}
                  points={`${p(u0, 0)} ${p(u1, 0)} ${p(u1, 5)} ${p(u0, 5)}`}
                  fill={lit ? 'var(--world-glow)' : 'color-mix(in oklab, var(--world-structure-2) 60%, var(--world-ink-muted))'}
                />
              );
            })}
            {/* roof */}
            <polygon points={`${cx - w},${cy - hh} ${cx},${cy - hh + d} ${cx + w},${cy - hh} ${cx},${cy - hh - d}`} fill={roof} />
            {/* smoke for failing */}
            {h.status === 'bad' && (
              <g opacity={0.55}>
                <circle cx={cx + 4} cy={cy - hh - 14} r={5} fill="var(--world-ink-muted)">
                  {!reduced && <animate attributeName="cy" values={`${cy - hh - 10};${cy - hh - 26}`} dur="2.4s" repeatCount="indefinite" />}
                </circle>
                <circle cx={cx + 9} cy={cy - hh - 24} r={7} fill="var(--world-ink-muted)" opacity={0.6} />
              </g>
            )}
            {focused && (
              <g>
                <rect x={cx - 64} y={cy - hh - 62} width={128} height={26} rx={8} fill={colors.dark ? 'rgb(30 30 28 / .9)' : 'rgb(255 255 255 / .92)'} stroke="var(--world-grid)" />
                <text x={cx} y={cy - hh - 45} textAnchor="middle" fill="var(--world-ink)" style={{ fontSize: 11, fontWeight: 600 }}>
                  {h.name}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ page */

export function StageDemo({ forceNoWebGL }: { forceNoWebGL?: boolean }) {
  const [lens, setLens] = useState<LensKey>('status');
  const [view, setView] = useState<StageView>('stage');
  const [viewAs, setViewAs] = useState('admin');
  const [focus, setFocus] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const today: TodayItem[] = useMemo(() => {
    const failing = HOUSES.filter((h) => h.status === 'bad');
    const stale = [...HOUSES].sort((a, b) => b.age - a.age)[0];
    return [
      ...failing.map((h) => ({ id: h.id, title: `${h.name} failed its refresh`, severity: 'bad' as Tone, value: 3, unit: 'runs failed', lens: 'Health', meta: h.town })),
      { id: stale.id, title: `${stale.name} is the stalest`, severity: 'warn' as Tone, value: stale.age, unit: 'days', lens: 'Staleness', meta: stale.town },
      { id: 'capacity', title: 'Sales capacity at 86%', severity: 'info' as Tone, value: '86%', lens: 'Size', meta: 'Sales' },
    ];
  }, []);

  const pick = (id: string) => setFocus((f) => (f === id ? null : id));
  const fly = () => {
    const hit = HOUSES.find((h) => h.name.toLowerCase().includes(q.trim().toLowerCase()));
    if (hit) setFocus(hit.id);
  };
  const focused = HOUSES.find((h) => h.id === focus);

  return (
    <StagePage
      label="Tenant town map"
      view={view}
      breadcrumb={[{ label: 'Tenant', onClick: () => setFocus(null) }, { label: focused ? focused.town : 'All towns' }]}
      title={focused ? focused.name : 'Contoso tenant'}
      meta={
        focused ? (
          <>
            <Badge tone={focused.status === 'ok' ? 'ok' : focused.status}>{STATUS_LABEL[focused.status]}</Badge>
            <span>{focused.owner}</span>
            <span className="font-mono num">{focused.age}d</span>
          </>
        ) : (
          <span className="num">4 towns · 16 workspaces · as of 09:40</span>
        )
      }
      topRight={
        <>
          <form
            className="relative"
            onSubmit={(e) => {
              e.preventDefault();
              fly();
            }}
          >
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 z-[1] size-4 -translate-y-1/2 text-faint" />
            <label htmlFor="fly" className="sr-only">
              Fly to a workspace
            </label>
            <Input id="fly" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Fly to…" className={view === 'stage' ? 'x-glass w-48 rounded-full! pl-8' : 'w-48 pl-8'} />
          </form>
          <ViewToggle value={view} onChange={setView} glass={view === 'stage'} />
        </>
      }
      lenses={<LensBar lenses={LENSES} value={lens} onChange={setLens} />}
      legend={<Legend title={LENSES.find((l) => l.value === lens)?.label} items={legendFor(lens)} collapsible />}
      bottomRight={
        <ViewAsSwitch
          value={viewAs}
          onChange={setViewAs}
          options={[
            { value: 'admin', label: 'Admin', name: 'Alex Rivera' },
            { value: 'owner', label: 'Owner', name: 'Priya Nair' },
          ]}
        />
      }
      side={<TodayPanel bare items={today} date="Fri 20 Nov" activeId={focus} onSelect={(it) => pick(it.id === 'capacity' ? HOUSES[6].id : it.id)} />}
      sideCount={today.length}
      stage={
        forceNoWebGL ? (
          <StageMessage icon={<CloudOff />} title="3D view needs WebGL" action={<Button onClick={() => setView('list')}>Show the list</Button>}>
            This browser can't draw the 3D map. The list has the same data.
          </StageMessage>
        ) : (
          <Town lens={lens} focus={focus} viewAs={viewAs} onPick={pick} />
        )
      }
      list={
        <TableWrap label="Workspaces">
          <Table>
            <thead>
              <tr>
                <Th>Workspace</Th>
                <Th>Town</Th>
                <Th>Health</Th>
                <Th>Owner</Th>
                <Th numeric>Age</Th>
              </tr>
            </thead>
            <tbody>
              {HOUSES.map((h) => (
                <Tr key={h.id} selected={h.id === focus}>
                  <Td className="font-medium">{h.name}</Td>
                  <Td muted>{h.town}</Td>
                  <Td>
                    <Badge tone={h.status === 'ok' ? 'ok' : h.status}>{STATUS_LABEL[h.status]}</Badge>
                  </Td>
                  <Td muted>{h.owner}</Td>
                  <Td numeric>{h.age}d</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      }
    />
  );
}
