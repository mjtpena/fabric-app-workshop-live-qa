/**
 * Wrap-up: the shareable summary of a session. A snapshot of the column (answered questions in green, the rest in
 * violet, sized by votes and numbered like the lists), the answered and not-answered lists, and the Markdown that
 * copies out. Anonymous questions stay anonymous in the Markdown, even when the host copies it.
 */
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Bubbles, Download, ListChecks, Printer } from 'lucide-react';

import { useApp } from '@x10/shared/runtime';
import { downloadText, formatDateTime, plural, useAsync } from '@x10/shared/lib';
import { Breadcrumb, Button, DataState, EmptyState, LinkButton, Skeleton, Stat, StatStrip } from '@x10/shared/ui';

import { UnknownSession } from '../components/states';
import { LiveDot, SafeCopyButton } from '../components/ui';
import { authorLabel, boardSections, normaliseCode, sortQuestions, wrapUpMarkdown } from '../domain/rules';
import { loadBoard, type Board } from '../domain/sessions';
import type { Question, Schema } from '../model';
import { radiusFor } from '../stage/arrange';
import { packRising } from '../stage/pack';

export function WrapUpPage() {
  const { store, me } = useApp<Schema>();
  const code = normaliseCode(useParams().code);
  const board = useAsync(() => loadBoard(store, me, code), [store, me.sub, code]);
  return (
    <DataState state={board} isEmpty={(b) => b === null} empty={<UnknownSession code={code} />} skeleton={<WrapSkeleton />}>
      {(b) => b && <WrapUp board={b} />}
    </DataState>
  );
}

function WrapSkeleton() {
  return (
    <div>
      <Skeleton width={120} height={12} />
      <Skeleton width={420} height={40} className="mt-3" />
      <Skeleton height={84} className="mt-6" />
      <Skeleton height={220} className="mt-6" />
    </div>
  );
}

function WrapUp({ board }: { board: Board }) {
  const { me } = useApp<Schema>();
  const { session, isHost } = board;
  const sections = boardSections(board.questions, board.scores, isHost);
  const answered = sortQuestions(sections.answered, board.scores);
  const open = sections.open;
  const markdown = wrapUpMarkdown(session, board.questions, board.scores);
  // The host sees names here (as in the host deck); the Markdown export is always anonymous.
  const viewer = { sub: me.sub, isHost };
  const isOpen = session.status === 'open';
  const total = answered.length + open.length;

  return (
    <article data-testid="wrap-up">
      <Breadcrumb items={[{ label: 'Sessions', to: '/' }, { label: `${session.code} · Wrap-up` }]} className="x-noprint mb-3" />
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <p className="x-legend-label m-0 text-accent-11">Q&A wrap-up</p>
          <h1 className="x-serif m-0 mt-1 text-4xl leading-[1.05] md:text-5xl">{session.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-ui text-muted">
            <LiveDot open={isOpen} />
            <span>
              Code <span className="font-mono text-fg">{session.code}</span>
            </span>
            <span>Hosted by {session.hostName}</span>
            <span>{formatDateTime(session.createdAt)}</span>
            {session.closedAt && <span>closed {formatDateTime(session.closedAt)}</span>}
          </div>
        </div>
        <div className="x-noprint flex flex-wrap items-center gap-2">
          <SafeCopyButton text={markdown} label="Copy as Markdown" variant="primary" size="md" testId="copy-markdown" />
          <Button icon={<Download aria-hidden="true" />} onClick={() => downloadText(`qa-wrap-up-${session.code}.md`, markdown, 'text/markdown;charset=utf-8')}>
            Download .md
          </Button>
          <Button icon={<Printer aria-hidden="true" />} onClick={() => window.print()}>
            Print
          </Button>
          {isHost && (
            <LinkButton to={`/s/${session.code}/host`} icon={<ListChecks aria-hidden="true" />}>
              Host deck
            </LinkButton>
          )}
        </div>
      </div>

      {isOpen && (
        <div role="status" className="x-noprint mt-5 flex items-start gap-2.5 rounded-xl bg-info-soft px-3 py-2.5 text-sm text-info-text">
          <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-info-solid" />
          <span>
            Still live: these lists change until the host closes the session.{' '}
            <Link to={isHost ? `/s/${session.code}/host` : `/s/${session.code}`}>{isHost ? 'Back to the host deck' : 'Back to the board'}</Link>
          </span>
        </div>
      )}

      <StatStrip className="mt-6">
        <Stat label="Questions" value={total} />
        <Stat label="Answered" value={answered.length} tone={answered.length ? 'ok' : undefined} hint={total ? `${Math.round((answered.length / total) * 100)}% of the room's questions` : undefined} />
        <Stat label="Not answered" value={open.length} tone={open.length ? 'warn' : undefined} />
        <Stat label="People taking part" value={board.participants} hint="asked or voted" />
      </StatStrip>

      {total > 0 && <Snapshot answered={answered} open={open} scores={board.scores} />}

      <div className="mt-8 grid gap-x-10 gap-y-8 lg:grid-cols-2">
        <section aria-labelledby="wu-answered">
          <h2 id="wu-answered" className="m-0 flex items-baseline gap-2 text-lg font-semibold">
            <span aria-hidden="true" className="size-2.5 rounded-full bg-green-9" />
            Answered <span className="font-mono text-sm font-normal text-muted num">{answered.length}</span>
          </h2>
          {answered.length ? (
            <ol className="m-0 mt-3 list-none divide-y divide-[var(--line)] p-0" data-testid="wrapup-answered">
              {answered.map((q, i) => (
                <WrapRow key={q.id} n={i + 1} q={q} score={board.scores.get(q.id) ?? 0} author={authorLabel(q, viewer)} tone="ok" />
              ))}
            </ol>
          ) : (
            <EmptyState compact title="Nothing was marked answered" icon={<Bubbles aria-hidden="true" />} />
          )}
        </section>
        <section aria-labelledby="wu-open">
          <h2 id="wu-open" className="m-0 flex items-baseline gap-2 text-lg font-semibold">
            <span aria-hidden="true" className="size-2.5 rounded-full bg-accent-9" />
            Not answered <span className="font-mono text-sm font-normal text-muted num">{open.length}</span>
          </h2>
          {open.length ? (
            <ol className="m-0 mt-3 list-none divide-y divide-[var(--line)] p-0" data-testid="wrapup-unanswered">
              {open.map((q, i) => (
                <WrapRow key={q.id} n={answered.length + i + 1} q={q} score={board.scores.get(q.id) ?? 0} author={authorLabel(q, viewer)} tone="accent" />
              ))}
            </ol>
          ) : (
            <EmptyState compact title="Every question was answered" icon={<Bubbles aria-hidden="true" />} />
          )}
        </section>
      </div>

      {isHost && sections.hidden.length > 0 && (
        <p className="mt-6 text-sm text-muted">
          {plural(sections.hidden.length, 'hidden question')} {sections.hidden.length === 1 ? 'is' : 'are'} left out of the wrap-up and the Markdown.
        </p>
      )}

      <details className="x-noprint mt-8 border-t border-line pt-4">
        <summary className="cursor-pointer text-sm font-semibold">Preview the Markdown</summary>
        <pre
          className="mt-3 max-h-96 overflow-auto rounded-xl bg-surface-sunken p-4 text-[13px] leading-5 whitespace-pre-wrap break-words"
          data-testid="wrapup-markdown"
          tabIndex={0}
        >
          {markdown}
        </pre>
      </details>
    </article>
  );
}

function WrapRow({ n, q, score, author, tone }: { n: number; q: Question; score: number; author: string; tone: 'ok' | 'accent' }) {
  return (
    <li className="flex items-start gap-3 py-3">
      <span
        aria-hidden="true"
        className={
          tone === 'ok'
            ? 'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-green-9 font-mono text-[11px] font-semibold text-green-contrast'
            : 'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-accent-9 font-mono text-[11px] font-semibold text-accent-contrast'
        }
      >
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 text-sm leading-5 break-words text-fg">{q.text}</p>
        <p className="m-0 mt-1 text-xs text-muted">{author}</p>
      </div>
      <span className="shrink-0 pt-0.5 text-right font-mono text-xs text-muted num">{plural(score, 'vote')}</span>
    </li>
  );
}

/** The column, frozen: every question as a bubble, answered on the left, the rest on the right. */
function Snapshot({ answered, open, scores }: { answered: Question[]; open: Question[]; scores: Map<string, number> }) {
  const W = 960;
  const H = 300;
  const total = answered.length + open.length;
  const split = Math.max(0.25, Math.min(0.75, total ? answered.length / total : 0.5));
  const art = useMemo(() => {
    const area = [...answered, ...open].reduce((s, q) => s + Math.PI * radiusFor(scores.get(q.id) ?? 0) ** 2, 0);
    const scale = Math.min(1.7, Math.sqrt((W * H * 0.18) / Math.max(1, area)));
    const place = (list: Question[], left: number, right: number) =>
      packRising(
        list.map((q) => ({ id: q.id, r: radiusFor(scores.get(q.id) ?? 0) * scale, group: 0 })),
        { left, right, top: 34, bottom: H - 8 },
        6,
        40,
        'left',
      ).placed;
    const a = place(answered, 8, W * split - 14);
    const o = place(open, W * split + 14, W - 8);
    const height = Math.max(120, ...[...a, ...o].map((t) => t.y + t.r + 12));
    return { a, o, height };
  }, [answered, open, scores, split]);
  const label = (r: number) => Math.max(10, Math.min(18, r * 0.55));
  return (
    <figure className="m-0 mt-6 rounded-2xl border border-line bg-[linear-gradient(180deg,var(--world-sky),var(--world-sky-2))] p-4">
      <svg viewBox={`0 0 ${W} ${art.height}`} className="block h-auto w-full" role="img" aria-label={`${plural(answered.length, 'answered question')} and ${plural(open.length, 'question')} not answered, sized by votes`}>
        <text x={8} y={16} className="x-legend-label" fill="var(--ok-text)" style={{ fontSize: 11 }}>
          ANSWERED · {answered.length}
        </text>
        <text x={W * split + 12} y={16} className="x-legend-label" fill="var(--accent-11)" style={{ fontSize: 11 }}>
          NOT ANSWERED · {open.length}
        </text>
        <defs>
          <radialGradient id="wu-gloss" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="white" stopOpacity="0.55" />
            <stop offset="35%" stopColor="white" stopOpacity="0.12" />
            <stop offset="100%" stopColor="black" stopOpacity="0.18" />
          </radialGradient>
        </defs>
        <line x1={W * split} x2={W * split} y1={8} y2={art.height - 8} stroke="var(--line-strong)" strokeDasharray="2 4" />
        {art.a.map((t, i) => (
          <g key={t.id}>
            <circle cx={t.x} cy={t.y} r={t.r} fill="var(--green-9)" />
            <circle cx={t.x} cy={t.y} r={t.r} fill="url(#wu-gloss)" />
            <text x={t.x} y={t.y} dy="0.35em" textAnchor="middle" fill="var(--green-contrast)" style={{ fontSize: label(t.r), fontWeight: 600 }}>
              {i + 1}
            </text>
          </g>
        ))}
        {art.o.map((t, i) => (
          <g key={t.id}>
            <circle cx={t.x} cy={t.y} r={t.r} fill="var(--accent-9)" />
            <circle cx={t.x} cy={t.y} r={t.r} fill="url(#wu-gloss)" />
            <text x={t.x} y={t.y} dy="0.35em" textAnchor="middle" fill="var(--accent-contrast)" style={{ fontSize: label(t.r), fontWeight: 600 }}>
              {answered.length + i + 1}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="mt-2 text-xs text-muted">Each bubble is a question, sized by its votes and numbered like the lists below.</figcaption>
    </figure>
  );
}
