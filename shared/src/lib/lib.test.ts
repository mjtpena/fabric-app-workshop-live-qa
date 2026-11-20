import { daxColumn, daxString, daxTable, MockModelClient, scalarResult } from '../connectors';
import { mdTable, parseCsv, toCsv } from './csv';
import { daysBetween, formatDuration, minutesBetween } from './time';
import { checkText } from './validate';
import { commaList, median, normKey, tokens } from './text';
import { latestBy } from '../data/collections';
import { describeError } from './errors';

describe('csv', () => {
  it('parses quoted commas, escaped quotes, CRLF and blank lines', () => {
    const rows = parseCsv('a,b\r\n"x, y","say ""hi"""\n\n1,\n');
    expect(rows).toEqual([['a', 'b'], ['x, y', 'say "hi"'], ['1', '']]);
  });
  it('round-trips', () => {
    const text = toCsv(['n', 'v'], [['a,b', 'q"x'], ['line\nbreak', 3]]);
    expect(parseCsv(text)).toEqual([['n', 'v'], ['a,b', 'q"x'], ['line\nbreak', '3']]);
  });
  it('builds markdown tables with escaped pipes', () => {
    expect(mdTable(['a'], [['x|y']])).toBe('| a |\n| --- |\n| x\\|y |');
  });
});

describe('time', () => {
  it('counts minutes and UTC days', () => {
    expect(minutesBetween('2026-03-29T00:30:00Z', '2026-03-29T03:30:00Z')).toBe(180);
    expect(daysBetween('2026-11-20T23:59:00Z', '2026-11-21T00:01:00Z')).toBe(1);
    expect(formatDuration(65)).toBe('1 h 5 min');
    expect(formatDuration(60 * 24 * 2 + 180)).toBe('2 d 3 h');
  });
});

describe('validate and text', () => {
  it('checks text limits', () => {
    expect(checkText('ab', { min: 3, max: 10, label: 'Name' })).toMatch(/at least 3/);
    expect(checkText('', { max: 10, optional: true })).toBeNull();
    expect(checkText('x'.repeat(11), { max: 10 })).toMatch(/10 characters or fewer/);
  });
  it('tokenises and normalises', () => {
    expect(tokens('Revenue (net), YoY!')).toEqual(['revenue', 'net', 'yoy']);
    expect(normKey('  Gross   Margin ')).toBe('gross margin');
    expect(commaList(' a, ,b ')).toEqual(['a', 'b']);
    expect(median([3, 1, 2, 10])).toBe(2.5);
  });
  it('keeps the newest row per key', () => {
    const rows = [
      { k: 'a', at: '2026-01-01', v: 1 },
      { k: 'a', at: '2026-01-03', v: 2 },
      { k: 'b', at: '2026-01-02', v: 3 },
    ];
    expect(latestBy(rows, (r) => r.k, (r) => r.at).map((r) => r.v).sort()).toEqual([2, 3]);
  });
});

describe('dax helpers and mock model', () => {
  it('escapes names', () => {
    expect(daxTable("O'Brien Sales")).toBe("'O''Brien Sales'");
    expect(daxColumn('Date', 'Year]x')).toBe("'Date'[Year]]x]");
    expect(daxString('say "hi"')).toBe('"say ""hi"""');
  });
  it('times out and never throws', async () => {
    const slow = new MockModelClient(() => new Promise(() => {}));
    const r = await slow.executeQuery('EVALUATE {1}', { timeoutMs: 20 });
    expect(r).toMatchObject({ status: 'error', error: { category: 'timeout' } });
    const boom = new MockModelClient(() => {
      throw new Error('kaput');
    });
    expect(await boom.executeQuery('x')).toMatchObject({ status: 'error', error: { message: 'kaput' } });
    expect(await new MockModelClient(() => scalarResult(5)).executeQuery('x')).toMatchObject({ status: 'success' });
  });
});

describe('describeError', () => {
  it('maps an over-limit capacity to a capacity error with a plain message', () => {
    const info = describeError({ status: 429, message: '{"code":"CapacityLimitExceeded"}' });
    expect(info.category).toBe('capacity');
    expect(info.message).toMatch(/over its limit/);
    expect(describeError(new Error('CapacityLimitExceeded: try later')).category).toBe('capacity');
  });

  it('maps a TIMEOUT code to the timeout category', () => {
    expect(describeError(Object.assign(new Error('slow'), { code: 'TIMEOUT' })).category).toBe('timeout');
  });
});
