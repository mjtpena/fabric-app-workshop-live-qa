/**
 * Sessions hub. Everyone gets the join code slots; hosts also see their live session as a small rising column and
 * the list of sessions they ran. Attendees see the sessions this browser joined recently.
 */
import { useCallback, useId, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Bubbles, ListChecks, Plus, Presentation, ScrollText } from 'lucide-react';

import { useApp } from '@x10/shared/runtime';
import { formatDateTime, formatRelative, plural, useAction, useAsync } from '@x10/shared/lib';
import { Button, Checkbox, cx, DataState, Dialog, EmptyState, Field, InlineError, Input, LinkButton, Skeleton } from '@x10/shared/ui';

import { JoinBox } from '../components/JoinBox';
import { recentSessions } from '../components/recent';
import { LiveDot } from '../components/ui';
import { useBoard } from '../components/live';
import { validateSessionTitle } from '../domain/rules';
import { createSession, listMySessions, type SessionSummary } from '../domain/sessions';
import { limits, type Schema } from '../model';
import { arrange } from '../stage/arrange';
import { RisingColumn, type ColumnGeometry } from '../stage/RisingColumn';

export function HomePage() {
  const { isAdmin } = useApp<Schema>();
  return isAdmin ? <HostHub /> : <AttendeeHub />;
}

function Hero({ aside }: { aside?: React.ReactNode }) {
  return (
    <section className={cx('grid items-center gap-8 pb-10 md:pt-6', !!aside && 'lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]')}>
      <div className="min-w-0">
        <p className="x-legend-label m-0 text-accent-11">Live questions for workshops</p>
        <h1 className="m-0 mt-2 text-4xl font-semibold tracking-[-0.03em] md:text-5xl">Workshop Live Q&A</h1>
        <p className="m-0 mt-3 max-w-[46ch] text-base text-muted">Questions rise as the room votes. Join with the code on the host's screen.</p>
        <div className="mt-7">
          <JoinBox size="lg" />
        </div>
      </div>
      {aside}
    </section>
  );
}

/* ------------------------------------------------------------------ attendee */

function AttendeeHub() {
  const recent = useMemo(() => recentSessions(), []);
  return (
    <>
      <Hero />
      <section aria-labelledby="recent" className="border-t border-line pt-6">
        <h2 id="recent" className="m-0 text-base font-semibold">
          Recently joined
        </h2>
        {recent.length === 0 ? (
          <p className="m-0 mt-2 text-sm text-muted">Sessions you join on this device show up here.</p>
        ) : (
          <ul className="m-0 mt-2 list-none divide-y divide-[var(--line)] p-0">
            {recent.map((r) => (
              <li key={r.code}>
                <Link to={`/s/${r.code}`} className="group flex items-center gap-4 rounded-lg px-2 py-3 text-fg no-underline hover:bg-gray-2">
                  <span className="font-mono text-sm tracking-[0.12em] text-accent-11">{r.code}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.title}</span>
                    <span className="block text-xs text-muted">
                      Hosted by {r.hostName} · joined {formatRelative(r.at)}
                    </span>
                  </span>
                  <ArrowRight aria-hidden="true" className="size-4 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-fg" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ host */

function HostHub() {
  const { store, me } = useApp<Schema>();
  const sessions = useAsync(() => listMySessions(store, me), [store, me.sub]);
  const [creating, setCreating] = useState(false);
  const live = sessions.data?.find((s) => s.session.status === 'open');
  const newButton = (
    <Button variant="primary" icon={<Plus aria-hidden="true" />} onClick={() => setCreating(true)} data-testid="new-session">
      New session
    </Button>
  );
  return (
    <>
      <Hero aside={live ? <LiveNow summary={live} /> : sessions.data ? undefined : <Skeleton height={340} className="max-lg:hidden" />} />
      <section aria-labelledby="mine" className="border-t border-line pt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="mine" className="m-0 text-lg font-semibold">
            Your sessions
          </h2>
          {newButton}
        </div>
        <DataState
          state={sessions}
          isEmpty={(d) => d.length === 0}
          skeleton={
            <div className="grid gap-2">
              {[0, 1].map((i) => (
                <Skeleton key={i} height={72} />
              ))}
            </div>
          }
          empty={
            <EmptyState title="You have not hosted a session yet" icon={<Bubbles aria-hidden="true" />} action={newButton} bordered>
              A session gives you a join code, a rising column and a big screen for the room.
            </EmptyState>
          }
        >
          {(list) => (
            <ul className="m-0 list-none divide-y divide-[var(--line)] p-0">
              {list.map((s) => (
                <SessionRow key={s.session.id} s={s} />
              ))}
            </ul>
          )}
        </DataState>
      </section>
      <NewSessionDialog open={creating} onClose={() => setCreating(false)} />
    </>
  );
}

const miniGeometry = ({ w, h }: { w: number; h: number }): ColumnGeometry => ({ column: { left: 0, top: 0, right: w, bottom: h } });

/** The live session as a small, non-interactive rising column. */
function LiveNow({ summary }: { summary: SessionSummary }) {
  const { session } = summary;
  const board = useBoard(session.code);
  const bubbles = useMemo(
    () => (board.data ? arrange(board.data.questions.filter((q) => q.status !== 'hidden'), board.data.scores, 'top') : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [board.data?.questions, board.data?.scores],
  );
  const geometry = useCallback(miniGeometry, []);
  return (
    <section className="grid grid-cols-[150px_minmax(0,1fr)] gap-5 rounded-[20px] border border-line bg-surface p-4 shadow-1 max-sm:grid-cols-[110px_minmax(0,1fr)]" aria-label="Live now">
      <Link to={`/s/${session.code}`} aria-label={`Open the board for ${session.title}`} className="relative block h-[240px] overflow-hidden rounded-[22px]">
        {board.data && (
          <RisingColumn bubbles={bubbles} geometry={geometry} label="Live column" interactive={false} excerpts={false} fill={0.42} intro shelfCaption={undefined} />
        )}
      </Link>
      <div className="flex min-w-0 flex-col">
        <LiveDot open />
        <h2 className="m-0 mt-2 text-lg font-semibold leading-6 break-words">{session.title}</h2>
        <p className="m-0 mt-1 text-ui text-muted">
          Code <span className="font-mono text-fg">{session.code}</span> · started {formatRelative(session.createdAt)}
        </p>
        <dl className="m-0 mt-4 grid grid-cols-3 gap-2">
          {[
            ['Open', summary.open],
            ['Answered', summary.answered],
            ['Votes', board.data?.upvotes.length ?? '–'],
          ].map(([k, v]) => (
            <div key={k as string}>
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="m-0 text-xl font-semibold tracking-[-0.02em] num">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
          <LinkButton to={`/s/${session.code}`} variant="primary" size="sm" icon={<Bubbles aria-hidden="true" />}>
            Board
          </LinkButton>
          <LinkButton to={`/s/${session.code}/screen`} size="sm" target="_blank" rel="noopener" icon={<Presentation aria-hidden="true" />}>
            Big screen
          </LinkButton>
        </div>
      </div>
    </section>
  );
}

/** One question per dot: green answered, violet still open (counts only; scales down for big sessions). */
function QuestionDots({ open, answered }: { open: number; answered: number }) {
  const total = open + answered;
  if (total === 0) return <span className="text-xs text-faint">No questions</span>;
  const cap = 24;
  const k = total > cap ? cap / total : 1;
  const a = Math.round(answered * k);
  const o = Math.max(open ? 1 : 0, Math.round(open * k));
  return (
    <span className="inline-flex flex-wrap items-center gap-[3px]" aria-hidden="true">
      {Array.from({ length: a }, (_, i) => (
        <span key={`a${i}`} className="size-2 rounded-full bg-green-8" />
      ))}
      {Array.from({ length: o }, (_, i) => (
        <span key={`o${i}`} className="size-2 rounded-full bg-accent-8" />
      ))}
    </span>
  );
}

function SessionRow({ s }: { s: SessionSummary }) {
  const { session } = s;
  const open = session.status === 'open';
  return (
    <li className="grid items-center gap-x-5 gap-y-2 py-4 md:grid-cols-[minmax(0,1fr)_auto_auto]" data-testid="session-card">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <LiveDot open={open} />
          <h3 className="m-0 min-w-0 text-base font-semibold break-words">
            <Link to={`/s/${session.code}`} className="text-fg no-underline hover:underline">
              {session.title}
            </Link>
          </h3>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-ui text-muted">
          <span className="font-mono tracking-[0.1em] text-fg">{session.code}</span>
          <span title={formatDateTime(session.createdAt)}>
            {open ? `Started ${formatRelative(session.createdAt)}` : `Closed ${formatRelative(session.closedAt ?? session.createdAt)}`}
          </span>
          <span className="num">
            {plural(s.questions, 'question')} · {s.answered} answered
          </span>
        </div>
      </div>
      <QuestionDots open={s.open} answered={s.answered} />
      <div className="flex flex-wrap gap-1.5">
        {open ? (
          <>
            <LinkButton to={`/s/${session.code}`} variant="primary" size="sm" icon={<Bubbles aria-hidden="true" />}>
              Board
            </LinkButton>
            <LinkButton to={`/s/${session.code}/host`} size="sm" icon={<ListChecks aria-hidden="true" />}>
              Host deck
            </LinkButton>
            <LinkButton to={`/s/${session.code}/screen`} size="sm" target="_blank" rel="noopener" icon={<Presentation aria-hidden="true" />}>
              Big screen
            </LinkButton>
          </>
        ) : (
          <>
            <LinkButton to={`/s/${session.code}/wrap-up`} variant="primary" size="sm" icon={<ScrollText aria-hidden="true" />}>
              Wrap-up
            </LinkButton>
            <LinkButton to={`/s/${session.code}/host`} size="sm" icon={<ListChecks aria-hidden="true" />}>
              Host deck
            </LinkButton>
          </>
        )}
      </div>
    </li>
  );
}

function NewSessionDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { store, me, isAdmin } = useApp<Schema>();
  const navigate = useNavigate();
  const titleId = useId();
  const [title, setTitle] = useState('');
  const [allowAnonymous, setAllowAnonymous] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const create = useAction(async () => {
    const msg = validateSessionTitle(title);
    setError(msg);
    if (msg) return;
    const s = await createSession(store, me, isAdmin, { title, allowAnonymous });
    onClose();
    navigate(`/s/${s.code}/host`);
  });
  const close = () => {
    setTitle('');
    setError(null);
    create.clearError();
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={close}
      title="New session"
      description="You get a six-character join code, a rising column and a big screen with a QR code."
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" busy={create.pending} onClick={() => void create.run()}>
            Create session
          </Button>
        </>
      }
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void create.run();
        }}
      >
        <Field label="Session title" htmlFor={titleId} required error={error} counter={{ value: title.trim().length, max: limits.sessionTitle.max }}>
          <Input id={titleId} value={title} onChange={(e) => setTitle(e.target.value)} invalid={!!error} placeholder="Designing AI Agents, cohort 3" autoFocus />
        </Field>
        <Checkbox label="Allow anonymous questions" description="You still see who asked." checked={allowAnonymous} onChange={setAllowAnonymous} />
        <InlineError error={create.error} />
      </form>
    </Dialog>
  );
}
