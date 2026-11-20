/**
 * Thin semantic-model query interface shared by Measure Unit Tests and Model Explainer.
 *
 * The app talks to `ModelClient`. In Fabric it is backed by the Rayfin connector client
 * (`client.connectors.<name>.executeQuery`, from `@microsoft/rayfin-connector-fabric-semanticmodel` 2.x, which returns a
 * column-aligned `{ status, table: { columns, rows: unknown[][] } }` union). Offline it is backed by `MockModelClient`.
 * The Execute Queries REST API is never called directly.
 */

export interface ModelColumn {
  name: string;
  dataType: string;
}

export interface ModelTable {
  columns: ModelColumn[];
  /** Column-aligned rows: rows[i][j] is the value of columns[j]. */
  rows: unknown[][];
}

export type ModelErrorCategory = 'api' | 'query' | 'network' | 'overflow' | 'timeout' | 'cancelled' | 'unknown';

export type ModelQueryResult =
  | { status: 'success'; table: ModelTable }
  | { status: 'error'; error: { category: ModelErrorCategory | string; message: string } };

export interface ModelQueryOptions {
  /** Hard row cap enforced by the engine; exceeding it returns an `overflow` error. */
  rowLimit?: number;
  /** Client-side timeout. Default 30 s. */
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface ModelClient {
  /** Display label of the bound model, for headers. */
  readonly label: string;
  executeQuery(query: string, opts?: ModelQueryOptions): Promise<ModelQueryResult>;
}

/** The connector surface we rely on, kept structural so tests can fake it. */
export interface ConnectorLike {
  executeQuery(input: { query: string; resultSetRowCountLimit?: number }): Promise<
    | { status: 'success'; table: { columns: { name: string; dataType?: string }[]; rows: unknown[][] } }
    | { status: 'error'; error: { category?: string; message: string } }
  >;
}

function withTimeout<T>(p: Promise<T>, ms: number, signal?: AbortSignal): Promise<T | 'timeout' | 'cancelled'> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return resolve('cancelled');
    const t = setTimeout(() => resolve('timeout'), ms);
    const onAbort = () => {
      clearTimeout(t);
      resolve('cancelled');
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    p.then(
      (v) => {
        clearTimeout(t);
        signal?.removeEventListener('abort', onAbort);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        signal?.removeEventListener('abort', onAbort);
        reject(e);
      },
    );
  });
}

async function guarded(
  run: () => Promise<ModelQueryResult>,
  opts: ModelQueryOptions = {},
): Promise<ModelQueryResult> {
  try {
    const r = await withTimeout(run(), opts.timeoutMs ?? 30_000, opts.signal);
    if (r === 'timeout')
      return { status: 'error', error: { category: 'timeout', message: `No answer within ${(opts.timeoutMs ?? 30_000) / 1000} s.` } };
    if (r === 'cancelled') return { status: 'error', error: { category: 'cancelled', message: 'Cancelled.' } };
    return r;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'error', error: { category: 'unknown', message } };
  }
}

/** Wrap a Rayfin semantic-model connector. Never throws: every failure becomes an error result. */
export function connectorModelClient(connector: ConnectorLike, label: string): ModelClient {
  return {
    label,
    executeQuery(query, opts) {
      return guarded(async () => {
        const res = await connector.executeQuery({
          query,
          ...(opts?.rowLimit ? { resultSetRowCountLimit: opts.rowLimit } : {}),
        });
        if (res.status === 'success') {
          return {
            status: 'success',
            table: {
              columns: res.table.columns.map((c) => ({ name: c.name, dataType: c.dataType ?? 'unknown' })),
              rows: res.table.rows,
            },
          };
        }
        return { status: 'error', error: { category: res.error.category ?? 'unknown', message: res.error.message } };
      }, opts);
    },
  };
}

export type MockHandler = (query: string) => ModelQueryResult | Promise<ModelQueryResult>;

/** Offline model client. The handler decides the answer for each query; latency makes progress visible. */
export class MockModelClient implements ModelClient {
  readonly calls: string[] = [];
  constructor(
    private readonly handler: MockHandler,
    readonly label = 'Mock model',
    private readonly latencyMs = 0,
  ) {}

  executeQuery(query: string, opts?: ModelQueryOptions): Promise<ModelQueryResult> {
    this.calls.push(query);
    return guarded(async () => {
      if (this.latencyMs) await new Promise((r) => setTimeout(r, this.latencyMs));
      const res = await this.handler(query);
      if (res.status === 'success' && opts?.rowLimit && res.table.rows.length > opts.rowLimit) {
        return { status: 'error', error: { category: 'overflow', message: `More than ${opts.rowLimit} rows.` } };
      }
      return res;
    }, opts);
  }
}

/** Build a one-row, one-column success result. */
export function scalarResult(value: unknown, column = '[v]', dataType = 'unknown'): ModelQueryResult {
  return { status: 'success', table: { columns: [{ name: column, dataType }], rows: [[value]] } };
}

export function tableResult(columns: string[], rows: unknown[][]): ModelQueryResult {
  return { status: 'success', table: { columns: columns.map((name) => ({ name, dataType: 'unknown' })), rows } };
}

export function errorResult(category: ModelErrorCategory | string, message: string): ModelQueryResult {
  return { status: 'error', error: { category, message } };
}

/** Rows as objects keyed by column name, for display. Bounded to `max` rows. */
export function rowsAsObjects(table: ModelTable, max = 100): Record<string, unknown>[] {
  return table.rows.slice(0, max).map((r) => Object.fromEntries(table.columns.map((c, i) => [c.name, r[i]])));
}

/** Quote a DAX table name: 'Sales Order' -> 'Sales Order', O'Brien -> 'O''Brien'. */
export function daxTable(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}

/** Quote a DAX column or measure name inside brackets: a]b -> [a]]b]. */
export function daxBracket(name: string): string {
  return `[${name.replace(/]/g, ']]')}]`;
}

/** Fully qualified column reference: 'Table'[Column]. */
export function daxColumn(table: string, column: string): string {
  return `${daxTable(table)}${daxBracket(column)}`;
}

/** DAX string literal with doubled quotes. */
export function daxString(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}
