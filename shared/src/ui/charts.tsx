import { useEffect, useState, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';

/** Resolved chart colours for the current theme and accent (Recharts needs concrete values, not CSS variables). */
export interface ChartColors {
  /** Categorical series: the accent first, then five companions chosen to stay distinct from it. */
  series: string[];
  ok: string;
  warn: string;
  bad: string;
  grid: string;
  text: string;
  muted: string;
  surface: string;
  /** Axis tick colour. */
  axis: string;
  /** A neutral series colour (comparisons, "other"). */
  neutral: string;
  /** Hover band behind bars. */
  cursor: string;
}

function readColors(): ChartColors {
  const css = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
  const v = (n: string, fb: string) => css?.getPropertyValue(n).trim() || fb;
  return {
    series: [
      v('--chart-1', '#4d57dc'),
      v('--chart-2', '#005dca'),
      v('--chart-3', '#ffa913'),
      v('--chart-4', '#007d70'),
      v('--chart-5', '#7839e6'),
      v('--chart-6', '#11c2e0'),
    ],
    ok: v('--chart-ok', '#008240'),
    warn: v('--chart-warn', '#ffa913'),
    bad: v('--chart-bad', '#d01c29'),
    grid: v('--chart-grid', '#e8e9ee'),
    text: v('--text', '#1d2027'),
    muted: v('--muted', '#61656d'),
    surface: v('--surface-raised', '#ffffff'),
    axis: v('--chart-axis', '#80838d'),
    neutral: v('--chart-neutral', '#b9bbc6'),
    cursor: v('--gray-3', '#f0f0f3'),
  };
}

/** Chart colours that update when the theme (system or data-theme) or the accent changes. */
export function useChartColors(): ChartColors {
  const [c, setC] = useState(readColors);
  useEffect(() => {
    const on = () => setC(readColors());
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener?.('change', on);
    const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(on) : null;
    mo?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-accent'] });
    return () => {
      mq?.removeEventListener?.('change', on);
      mo?.disconnect();
    };
  }, []);
  return c;
}

export interface SeriesSpec {
  key: string;
  label: string;
  color?: string;
}

/* ------------------------------------------------------------------ frame, legend, tooltip */

/** Inline legend: a dot and a label per series. Prefer direct labels where the chart allows. */
export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="m-0 flex list-none flex-wrap items-center gap-x-3.5 gap-y-1 p-0 text-xs text-muted">
      {items.map((it) => (
        <li key={it.label} className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-[3px]" style={{ background: it.color }} aria-hidden="true" />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

/** Figure wrapper: a title, the chart, and a visually hidden data summary for screen readers. */
export function ChartFrame({
  title,
  summary,
  height = 260,
  children,
  empty,
  description,
  legend,
  actions,
  bare,
  emptyLabel = 'No data for this range.',
}: {
  title: string;
  summary: string;
  height?: number;
  children: ReactNode;
  empty?: boolean;
  /** One quiet line under the title (units, period). */
  description?: ReactNode;
  legend?: ReactNode;
  actions?: ReactNode;
  /** No panel border, for charts inside a Card. */
  bare?: boolean;
  emptyLabel?: ReactNode;
}) {
  return (
    <figure className={bare ? 'm-0 min-w-0' : 'm-0 min-w-0 rounded-xl border border-line bg-surface px-4 pt-3.5 pb-3'}>
      <figcaption className="mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-fg">{title}</div>
          {description && <div className="mt-0.5 text-xs text-muted">{description}</div>}
        </div>
        {(legend || actions) && (
          <div className="flex flex-wrap items-center gap-3">
            {legend}
            {actions}
          </div>
        )}
      </figcaption>
      {empty ? (
        <div
          className="flex items-center justify-center rounded-lg border border-dashed border-line text-sm text-muted"
          style={{ height }}
        >
          {emptyLabel}
        </div>
      ) : (
        <div style={{ height }} aria-hidden="true" className="-mx-1">
          {children}
        </div>
      )}
      <p className="sr-only">{summary}</p>
    </figure>
  );
}

type TipRow = { name?: string | number; value?: unknown; color?: string; payload?: Record<string, unknown>; dataKey?: string | number };

/** Tooltip body that matches the UI kit's floating panels. */
export function ChartTooltip({
  active,
  label,
  payload,
  format,
  labelFormat,
}: {
  active?: boolean;
  label?: unknown;
  payload?: TipRow[];
  format?: (v: number) => string;
  labelFormat?: (l: unknown) => ReactNode;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="x-panel min-w-[140px] px-3 py-2 text-xs">
      {label !== undefined && label !== '' && (
        <div className="mb-1.5 font-medium text-fg">{labelFormat ? labelFormat(label) : String(label)}</div>
      )}
      <div className="flex flex-col gap-1">
        {payload.map((p, i) => (
          <div key={`${p.dataKey ?? i}`} className="flex items-center gap-2">
            <span className="inline-block size-2 shrink-0 rounded-[3px]" style={{ background: p.color }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-muted">{p.name}</span>
            <span className="font-medium text-fg num">
              {typeof p.value === 'number' && format ? format(p.value) : String(p.value ?? '')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const axisProps = (c: ChartColors) => ({
  stroke: c.grid,
  tick: { fill: c.axis, fontSize: 12 },
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
});

/* ------------------------------------------------------------------ bar */

export function SimpleBarChart<T extends Record<string, unknown>>({
  data,
  xKey,
  series,
  stacked,
  horizontal,
  title,
  summary,
  height,
  colorFor,
  onBarClick,
  description,
  yFormat,
  bare,
}: {
  data: T[];
  xKey: keyof T & string;
  series: SeriesSpec[];
  stacked?: boolean;
  horizontal?: boolean;
  title: string;
  summary: string;
  height?: number;
  /** Per-bar colour for single-series charts. */
  colorFor?: (row: T, index: number) => string;
  onBarClick?: (row: T) => void;
  description?: ReactNode;
  yFormat?: (v: number) => string;
  bare?: boolean;
}) {
  const c = useChartColors();
  const color = (s: SeriesSpec, i: number) => s.color ?? c.series[i % c.series.length];
  const rot = !horizontal && data.length > 6;
  const longest = horizontal ? Math.max(0, ...data.map((d) => String(d[xKey] ?? '').length)) : 0;
  return (
    <ChartFrame
      title={title}
      summary={summary}
      height={height}
      empty={!data.length}
      description={description}
      bare={bare}
      legend={series.length > 1 ? <ChartLegend items={series.map((s, i) => ({ label: s.label, color: color(s, i) }))} /> : undefined}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={{ left: 0, right: 8, top: 4, bottom: 0 }}
          barCategoryGap={horizontal ? '28%' : '24%'}
        >
          <CartesianGrid stroke={c.grid} vertical={!!horizontal} horizontal={!horizontal} />
          {/* Recharts reads axes only as direct children, never through fragments. */}
          {horizontal
            ? [
                <XAxis key="x" type="number" allowDecimals={false} tickFormatter={yFormat} {...axisProps(c)} />,
                <YAxis
                  key="y"
                  type="category"
                  dataKey={xKey}
                  width={Math.min(180, Math.max(64, longest * 7.2 + 20))}
                  {...axisProps(c)}
                  tick={{ fill: c.muted, fontSize: 12 }}
                />,
              ]
            : [
                <XAxis
                  key="x"
                  dataKey={xKey}
                  {...axisProps(c)}
                  interval={rot ? 0 : 'preserveStartEnd'}
                  angle={rot ? -30 : 0}
                  textAnchor={rot ? 'end' : 'middle'}
                  height={rot ? 64 : 28}
                />,
                <YAxis key="y" allowDecimals={false} width={40} tickFormatter={yFormat} {...axisProps(c)} />,
              ]}
          <Tooltip
            cursor={{ fill: c.cursor, opacity: 0.6 }}
            content={<ChartTooltip format={yFormat} />}
            wrapperStyle={{ outline: 'none' }}
            isAnimationActive={false}
          />
          {series.map((s, i) => {
            const top = !stacked || i === series.length - 1;
            const r = 4;
            const radius: [number, number, number, number] = !top ? [0, 0, 0, 0] : horizontal ? [0, r, r, 0] : [r, r, 0, 0];
            return (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stackId={stacked ? 'a' : undefined}
                fill={color(s, i)}
                radius={radius}
                maxBarSize={horizontal ? 22 : 40}
                isAnimationActive={false}
                onClick={onBarClick ? (d: { payload?: T }) => d.payload && onBarClick(d.payload) : undefined}
                cursor={onBarClick ? 'pointer' : undefined}
              >
                {colorFor && series.length === 1 && data.map((row, idx) => <Cell key={idx} fill={colorFor(row, idx)} />)}
              </Bar>
            );
          })}
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* ------------------------------------------------------------------ line */

export function SimpleLineChart<T extends Record<string, unknown>>({
  data,
  xKey,
  series,
  title,
  summary,
  height,
  yDomain,
  yFormat,
  onPointClick,
  description,
  directLabels,
  bare,
}: {
  data: T[];
  xKey: keyof T & string;
  series: SeriesSpec[];
  title: string;
  summary: string;
  height?: number;
  yDomain?: [number, number];
  yFormat?: (v: number) => string;
  onPointClick?: (row: T) => void;
  description?: ReactNode;
  /** Label each line at its end instead of a legend. Default: on for 2–4 series. */
  directLabels?: boolean;
  bare?: boolean;
}) {
  const c = useChartColors();
  const color = (s: SeriesSpec, i: number) => s.color ?? c.series[i % c.series.length];
  const direct = directLabels ?? (series.length > 1 && series.length <= 4);
  const labelRoom = direct ? Math.min(120, Math.max(...series.map((s) => s.label.length)) * 6.4 + 14) : 12;
  const last = data.length - 1;
  return (
    <ChartFrame
      title={title}
      summary={summary}
      height={height}
      empty={!data.length}
      description={description}
      bare={bare}
      legend={series.length > 1 && !direct ? <ChartLegend items={series.map((s, i) => ({ label: s.label, color: color(s, i) }))} /> : undefined}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ left: 0, right: labelRoom, top: 8, bottom: 0 }}
          onClick={
            onPointClick
              ? (e: { activePayload?: { payload: T }[] } | null) => {
                  const row = e?.activePayload?.[0]?.payload;
                  if (row) onPointClick(row);
                }
              : undefined
          }
        >
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis dataKey={xKey} {...axisProps(c)} interval="preserveStartEnd" minTickGap={16} />
          <YAxis domain={yDomain} width={44} tickFormatter={yFormat} {...axisProps(c)} />
          <Tooltip
            cursor={{ stroke: c.axis, strokeWidth: 1, strokeDasharray: '2 3' }}
            content={<ChartTooltip format={yFormat} />}
            wrapperStyle={{ outline: 'none' }}
            isAnimationActive={false}
          />
          {series.map((s, i) => {
            const col = color(s, i);
            return (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={col}
                strokeWidth={2}
                dot={onPointClick || data.length <= 12 ? { r: 2.5, fill: col, strokeWidth: 0, cursor: onPointClick ? 'pointer' : undefined } : false}
                activeDot={{ r: 4.5, fill: col, stroke: c.surface, strokeWidth: 2, cursor: onPointClick ? 'pointer' : undefined }}
                isAnimationActive={false}
                connectNulls
                label={
                  direct
                    ? (p: { x?: number; y?: number; index?: number }) =>
                        p.index === last && p.x !== undefined && p.y !== undefined ? (
                          <text key={`l-${s.key}`} x={p.x + 8} y={p.y} dy={4} fontSize={12} fontWeight={500} fill={col}>
                            {s.label}
                          </text>
                        ) : (
                          <g key={`l-${s.key}-${p.index}`} />
                        )
                    : undefined
                }
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* ------------------------------------------------------------------ scatter */

export function SimpleScatterChart<T extends Record<string, unknown>>({
  data,
  xKey,
  yKey,
  labelKey,
  xLabel,
  yLabel,
  title,
  summary,
  height,
  xTicks,
  xTickFormat,
  yDomain,
  description,
  colorFor,
  bare,
}: {
  yDomain?: [number, number];
  data: T[];
  xKey: keyof T & string;
  yKey: keyof T & string;
  labelKey: keyof T & string;
  xLabel: string;
  yLabel: string;
  title: string;
  summary: string;
  height?: number;
  xTicks?: number[];
  xTickFormat?: (v: number) => string;
  description?: ReactNode;
  colorFor?: (row: T, index: number) => string;
  bare?: boolean;
}) {
  const c = useChartColors();
  return (
    <ChartFrame title={title} summary={summary} height={height} empty={!data.length} description={description} bare={bare}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ left: 4, right: 16, top: 8, bottom: 16 }}>
          <CartesianGrid stroke={c.grid} />
          <XAxis
            type="number"
            dataKey={xKey}
            name={xLabel}
            ticks={xTicks}
            tickFormatter={xTickFormat}
            {...axisProps(c)}
            label={{ value: xLabel, position: 'insideBottom', offset: -10, fill: c.muted, fontSize: 12 }}
          />
          <YAxis
            type="number"
            dataKey={yKey}
            name={yLabel}
            width={44}
            domain={yDomain}
            {...axisProps(c)}
            label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: c.muted, fontSize: 12 }}
          />
          <ZAxis range={[64, 64]} />
          <Tooltip
            cursor={{ stroke: c.axis, strokeDasharray: '2 3' }}
            wrapperStyle={{ outline: 'none' }}
            isAnimationActive={false}
            content={({ payload }) => {
              const p = payload?.[0]?.payload as T | undefined;
              if (!p) return null;
              return (
                <div className="x-panel px-3 py-2 text-xs">
                  <div className="mb-1 font-medium text-fg">{String(p[labelKey])}</div>
                  <div className="text-muted num">
                    {xLabel} <span className="text-fg">{xTickFormat ? xTickFormat(Number(p[xKey])) : String(p[xKey])}</span>
                    {' · '}
                    {yLabel} <span className="text-fg">{String(p[yKey])}</span>
                  </div>
                </div>
              );
            }}
          />
          <Scatter data={data} fill={c.series[0]} fillOpacity={0.85} stroke={c.surface} strokeWidth={1.5} isAnimationActive={false}>
            {colorFor && data.map((row, i) => <Cell key={i} fill={colorFor(row, i)} />)}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* ------------------------------------------------------------------ heatmap */

/** Grid heatmap (for example weekday × hour). Cells show counts as text, so colour is not the only signal. */
export function Heatmap({
  rows,
  cols,
  values,
  title,
  summary,
  showZero = false,
  description,
  color,
  bare,
}: {
  rows: string[];
  cols: string[];
  /** values[r][c] */
  values: number[][];
  title: string;
  summary: string;
  showZero?: boolean;
  description?: ReactNode;
  /** Base colour (defaults to the accent). */
  color?: string;
  bare?: boolean;
}) {
  const c = useChartColors();
  const base = color ?? c.series[0];
  const max = Math.max(1, ...values.flat());
  return (
    <figure className={bare ? 'm-0 min-w-0' : 'm-0 min-w-0 rounded-xl border border-line bg-surface px-4 pt-3.5 pb-4'}>
      <figcaption className="mb-3">
        <div className="text-sm font-semibold text-fg">{title}</div>
        {description && <div className="mt-0.5 text-xs text-muted">{description}</div>}
      </figcaption>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-[3px] text-[11px]" aria-label={title}>
          <thead>
            <tr>
              <th className="sr-only">Row</th>
              {cols.map((col) => (
                <th key={col} scope="col" className="px-0.5 pb-0.5 text-center font-normal text-muted">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={r}>
                <th scope="row" className="pr-1.5 text-right font-normal whitespace-nowrap text-muted">
                  {r}
                </th>
                {cols.map((col, ci) => {
                  const v = values[ri]?.[ci] ?? 0;
                  const a = v ? 0.14 + 0.86 * (v / max) : 0;
                  return (
                    <td
                      key={col}
                      title={`${r} ${col}: ${v}`}
                      className="h-7 min-w-7 rounded-[5px] text-center font-medium num"
                      style={{
                        background: v ? `color-mix(in oklab, ${base} ${Math.round(a * 100)}%, ${c.surface})` : `color-mix(in oklab, ${c.grid} 55%, transparent)`,
                        color: a > 0.55 ? (color ? '#fff' : 'var(--accent-contrast)') : c.text,
                      }}
                    >
                      {v || showZero ? v : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="sr-only">{summary}</p>
    </figure>
  );
}
