/**
 * The session board, the centrepiece: questions rise as bubbles in a glass column. Lenses re-encode the column
 * (top, newest, answered, pinned), Today focuses the bubble behind each item, the host can view as an attendee, and
 * the list view is the same data as a table. Attendees ask and vote from the side panel (the list under the column on
 * phones), with a thumb-sized upvote.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowUp, Bubbles, ListChecks, Presentation, ScrollText, Users, X } from 'lucide-react';

import { useApp } from '@x10/shared/runtime';
import { formatDateTime, formatRelative, plural, useAction, useNow } from '@x10/shared/lib';
import {
  Badge,
  Button,
  ConfirmDialog,
  cx,
  EmptyState,
  ErrorPanel,
  InlineError,
  Kbd,
  Legend,
  LensBar,
  LinkButton,
  StageMessage,
  StagePage,
  Table,
  TableWrap,
  Td,
  Th,
  Toast,
  TodayPanel,
  Tr,
  useHotkeys,
  useIsDesktop,
  ViewAsSwitch,
  ViewToggle,
  type StageView,
  type Tone,
} from '@x10/shared/ui';

import { AskBox } from '../components/AskBox';
import { useBoard, useStableOrder } from '../components/live';
import { rememberSession } from '../components/recent';
import { ShortcutsButton, ShortcutsDialog, type ShortcutGroup } from '../components/Shortcuts';
import { UnknownSession } from '../components/states';
import { LiveDot, NewQuestionsPill, QuestionRow, SafeCopyButton, ScoreBox, StatusChips, UpvoteButton } from '../components/ui';
import { moderateQuestion, toggleUpvote, withdrawQuestion } from '../domain/questions';
import { ACTION_LABELS, allowedActions, authorLabel, boardSections, joinLink, normaliseCode, type ModerationAction } from '../domain/rules';
import type { Board } from '../domain/sessions';
import type { Question, Schema } from '../model';
import { arrange, columnOrder, type Bubble, type Lens } from '../stage/arrange';
import { LENS_LABEL, LENS_OPTIONS, legendFor } from '../stage/lenses';
import { RisingColumn, type ColumnGeometry } from '../stage/RisingColumn';
import { todayItems } from '../stage/today';

export { UnknownSession };

type ViewAs = 'host' | 'attendee';

const STAGE_LABEL = 'Rising questions';

export function BoardPage() {
  const code = normaliseCode(useParams().code);
  const board = useBoard(code);
  if (board.data === undefined) {
    return (
      <StagePage
        label={STAGE_LABEL}
        breadcrumb={[{ label: 'Sessions', to: '/' }, { label: code }]}
        title={board.error ? 'Could not load the board' : 'Gathering the questions'}
        meta={<span className="font-mono">{code}</span>}
        stage={
          board.error ? (
            <div className="absolute inset-0 grid place-items-center p-6">
              <div className="w-full max-w-md">
                <ErrorPanel error={board.error} onRetry={() => void board.reload()} />
              </div>
            </div>
          ) : (
            <StageMessage icon={<Bubbles aria-hidden="true" />} title="Gathering the questions">
              The column fills as soon as the board loads.
            </StageMessage>
          )
        }
      />
    );
  }
  if (board.data === null)
    return (
      <div className="px-4 sm:px-6">
        <UnknownSession code={code} />
      </div>
    );
  return <LiveBoard board={board.data} reload={board.reload} />;
}

/** Keep the same object while its key is unchanged, so polling with no news does not re-layout the column. */
function useStable<T>(value: T, key: string): T {
  const ref = useRef({ key, value });
  if (ref.current.key !== key) ref.current = { key, value };
  return ref.current.value;
}

const UNDO: Partial<Record<ModerationAction, ModerationAction>> = { answer: 'reopen', pin: 'unpin', unpin: 'pin', park: 'reopen', hide: 'unhide' };
const DONE: Partial<Record<ModerationAction, string>> = {
  answer: 'Marked answered: it drops onto the shelf.',
  pin: 'Pinned: it docks at the top.',
  unpin: 'Unpinned.',
  park: 'Parked.',
  reopen: 'Reopened.',
  hide: 'Hidden from attendees.',
  unhide: 'Back on the board.',
};

function LiveBoard({ board, reload }: { board: Board; reload: () => Promise<void> }) {
  const { store, me } = useApp<Schema>();
  const desktop = useIsDesktop();
  const navigate = useNavigate();
  const now = useNow(30_000);
  const { session, isHost } = board;
  const isOpen = session.status === 'open';
  const link = joinLink(window.location.href, session.code);

  const [lens, setLens] = useState<Lens>('top');
  const [view, setView] = useState<StageView>('stage');
  const [viewAs, setViewAs] = useState<ViewAs>(isHost ? 'host' : 'attendee');
  const hostView = isHost && viewAs === 'host';
  const [focusId, setFocusId] = useState<string | null>(null);
  const [peekId, setPeekId] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null);
  const [draft, setDraft] = useState('');
  const [withdrawing, setWithdrawing] = useState<Question | null>(null);
  const askRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isHost) rememberSession(session);
  }, [isHost, session]);

  /* ---------------------------------------------------------------- optimistic votes */

  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  useEffect(() => {
    // Drop overrides the server now agrees with; keep the ones still in flight.
    setOptimistic((o) => {
      const left = Object.entries(o).filter(([id, v]) => board.myVotes.has(id) !== v);
      return left.length === Object.keys(o).length ? o : Object.fromEntries(left);
    });
  }, [board]);
  const voted = useMemo(() => {
    const s = new Set(board.myVotes);
    for (const [id, v] of Object.entries(optimistic)) v ? s.add(id) : s.delete(id);
    return s;
  }, [board.myVotes, optimistic]);
  const scores = useMemo(() => {
    const m = new Map(board.scores);
    for (const [id, v] of Object.entries(optimistic)) {
      const delta = (v ? 1 : 0) - (board.myVotes.has(id) ? 1 : 0);
      if (delta) m.set(id, Math.max(0, (m.get(id) ?? 0) + delta));
    }
    return m;
  }, [board.scores, board.myVotes, optimistic]);

  const vote = useAction(async (q: Question) => {
    const next = !voted.has(q.id);
    setOptimistic((o) => ({ ...o, [q.id]: next }));
    try {
      await toggleUpvote(store, me, q.id);
    } catch (e) {
      setOptimistic((o) => {
        const { [q.id]: _gone, ...rest } = o;
        return rest;
      });
      throw e;
    } finally {
      await reload();
    }
  });

  const moderate = useAction(async (q: Question, action: ModerationAction) => {
    await moderateQuestion(store, me, q.id, action);
    await reload();
    const undo = UNDO[action];
    setToast({
      message: DONE[action] ?? 'Done.',
      undo: undo
        ? () => {
            void moderateQuestion(store, me, q.id, undo).then(reload);
          }
        : undefined,
    });
  });

  /* ---------------------------------------------------------------- what this viewer sees */

  const viewer = { sub: me.sub, isHost: hostView };
  const visible = useMemo(() => (hostView ? board.questions : board.questions.filter((q) => q.status !== 'hidden')), [board.questions, hostView]);
  const byId = useMemo(() => new Map(visible.map((q) => [q.id, q])), [visible]);
  const sections = boardSections(visible, scores, hostView);
  const live = useStableOrder(sections.open.map((q) => q.id));
  const openList = live.order.map((id) => byId.get(id)).filter((q): q is Question => !!q);

  const arranged = arrange(visible, scores, lens, now);
  const bubbles = useStable(
    arranged,
    `${lens}|${arranged.map((b) => `${b.id}:${b.zone}:${b.order}:${b.score}:${b.fill}:${b.dim ? 1 : 0}:${b.dashed ? 1 : 0}:${b.q.text.length}`).join(',')}`,
  );
  const order = useMemo(() => columnOrder(bubbles), [bubbles]);
  const mine = useMemo(() => new Set(visible.filter((q) => q.authorSub === me.sub).map((q) => q.id)), [visible, me.sub]);

  useEffect(() => {
    if (focusId && !byId.has(focusId)) setFocusId(null);
  }, [byId, focusId]);

  const today = useMemo(
    () => todayItems({ questions: visible, upvotes: board.upvotes, scores, now, sub: me.sub, hostView }),
    [visible, board.upvotes, scores, now, me.sub, hostView],
  );

  const focus = useCallback((id: string | null) => {
    setFocusId(id);
    setPeekId(null);
  }, []);

  const calloutKey = useMemo(() => {
    if (!desktop) return '';
    const lead = [focusId, peekId].filter((x): x is string => !!x && byId.has(x));
    const rest = order.filter((b) => b.zone !== 'shelf' && !b.dim && !lead.includes(b.id)).map((b) => b.id);
    return [...new Set([...lead, ...rest])].slice(0, 8).join('|');
  }, [desktop, focusId, peekId, order, byId]);
  const calloutIds = useMemo(() => (calloutKey ? calloutKey.split('|') : []), [calloutKey]);

  /* ---------------------------------------------------------------- geometry */

  const geometry = useCallback(
    ({ w, h }: { w: number; h: number }): ColumnGeometry => {
      if (!desktop) return { column: { left: 12, top: 12, right: w - 12, bottom: h - 12 } };
      const cw = Math.max(230, Math.min(380, w * 0.32));
      const cx0 = w / 2;
      const left = cx0 - cw / 2;
      // The title panel floats top left (up to ~420px wide): start lower when the column would run under it.
      const top = left < 430 ? 120 : 28;
      const column = { left, right: cx0 + cw / 2, top, bottom: h - 78 };
      const lw = column.left - 36 - 24;
      const rw = w - 20 - (column.right + 36);
      return {
        column,
        left: lw >= 170 ? { left: 24, right: column.left - 36, top: 128, bottom: h - 168 } : null,
        right: rw >= 170 ? { left: column.right + 36, right: w - 20, top: 76, bottom: h - 84 } : null,
        calloutWidth: 320,
      };
    },
    [desktop],
  );

  /* ---------------------------------------------------------------- moves */

  const step = (dir: 1 | -1) => {
    const ids = order.map((b) => b.id);
    if (!ids.length) return;
    const i = focusId ? ids.indexOf(focusId) : -1;
    focus(ids[(i + dir + ids.length) % ids.length]);
  };
  const focused = focusId ? byId.get(focusId) : undefined;
  const canVoteOn = (q: Question) => isOpen && !isHost && q.authorSub !== me.sub && q.status !== 'answered' && q.status !== 'hidden';
  const runModeration = (a: ModerationAction) => {
    if (!focused || !hostView || !isOpen) return;
    if (allowedActions(focused).includes(a)) void moderate.run(focused, a);
  };

  useHotkeys({
    'shift+?': () => setHelp(true),
    j: () => step(1),
    k: () => step(-1),
    escape: () => focus(null),
    u: () => focused && canVoteOn(focused) && void vote.run(focused),
    '/': () => askRef.current?.focus(),
    a: () => runModeration('answer'),
    p: () => focused && runModeration(focused.isPinned ? 'unpin' : 'pin'),
    s: () => focused && runModeration(focused.status === 'parked' ? 'reopen' : 'park'),
    h: () => runModeration('hide'),
    b: () => isHost && window.open(`#/s/${session.code}/screen`, '_blank', 'noopener'),
    d: () => isHost && navigate(`/s/${session.code}/host`),
    w: () => navigate(`/s/${session.code}/wrap-up`),
  });

  // Keep the focused row in view in the side list.
  useEffect(() => {
    if (!focusId || !desktop) return;
    document.querySelector(`[data-testid="question-card"][data-id="${CSS.escape(focusId)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focusId, desktop]);

  /* ---------------------------------------------------------------- pieces */

  const bubbleLabel = (b: Bubble) => {
    const state = b.q.status === 'answered' ? 'Answered' : b.q.isPinned ? 'Pinned' : b.q.status === 'parked' ? 'Parked' : b.rank ? `Number ${b.rank}` : '';
    return `${state}, ${plural(b.score, 'vote')}: ${b.q.text}`;
  };

  const actionsFor = (q: Question, big?: boolean): ReactNode => {
    if (hostView && isOpen) {
      return allowedActions(q).map((a) => (
        <Button
          key={a}
          size="sm"
          variant={a === 'answer' ? 'primary' : 'secondary'}
          disabled={moderate.pending}
          onClick={() => void moderate.run(q, a)}
          iconRight={desktop ? <Kbd className={a === 'answer' ? 'bg-white/20! text-white! shadow-none!' : ''}>{KEY_FOR[a]}</Kbd> : undefined}
        >
          {ACTION_LABELS[a]}
        </Button>
      ));
    }
    if (canVoteOn(q)) {
      const on = voted.has(q.id);
      return (
        <Button
          size={big ? 'lg' : 'sm'}
          variant={on ? 'primary' : 'secondary'}
          aria-pressed={on}
          data-testid="callout-upvote"
          onClick={() => void vote.run(q)}
          className={cx('qa-upvote', big && 'h-11 flex-1')}
        >
          {on ? 'Upvoted' : 'Upvote'} · <span className="num">{scores.get(q.id) ?? 0}</span>
        </Button>
      );
    }
    if (q.authorSub === me.sub) return <span className="text-xs text-muted">Your question</span>;
    return null;
  };

  const renderCallout = (b: Bubble, side: 'left' | 'right') => (
    <BubbleCallout
      b={b}
      side={side}
      focused={b.id === focusId}
      author={authorLabel(b.q, viewer)}
      onPick={() => focus(b.id === focusId ? null : b.id)}
      onClose={() => focus(null)}
      actions={actionsFor(b.q)}
    />
  );

  const counts = {
    open: sections.open.length,
    answered: sections.answered.length,
    pinned: sections.open.filter((q) => q.isPinned).length,
    parked: sections.open.filter((q) => q.status === 'parked').length,
    maxVotes: Math.max(0, ...visible.map((q) => scores.get(q.id) ?? 0)),
  };
  const totalVotes = board.upvotes.length;

  const stage = (
    <div className="absolute inset-y-0 left-0 w-[calc(100%-var(--side-w,0px))]">
      <RisingColumn
        bubbles={bubbles}
        geometry={geometry}
        label={`${STAGE_LABEL}, ${LENS_LABEL[lens]} lens`}
        focusId={focusId}
        onPick={(id) => focus(id === focusId ? null : id)}
        onHover={desktop ? setPeekId : undefined}
        labelFor={bubbleLabel}
        calloutIds={calloutIds}
        renderCallout={desktop ? renderCallout : undefined}
        votedIds={voted}
        mineIds={isHost ? undefined : mine}
        excerpts={!desktop}
        fill={desktop ? 0.5 : 0.46}
        dockCaption="Pinned"
        shelfCaption={lens === 'answered' ? `Still open · ${counts.open}` : `Answered · ${counts.answered}`}
      />
      {bubbles.length === 0 && (
        <StageMessage icon={<Bubbles aria-hidden="true" />} title={isOpen ? 'The column is empty' : 'No questions were asked'}>
          {isOpen ? (
            <>
              Questions rise here as the room asks them. Code <span className="font-mono font-semibold text-fg">{session.code}</span>
            </>
          ) : (
            'This session closed without questions.'
          )}
        </StageMessage>
      )}
      {!desktop && focused && (
        <div className="absolute inset-x-2 top-2 z-10 animate-x-in">
          <BubbleCallout
            b={bubbles.find((x) => x.id === focused.id) ?? null}
            side="right"
            focused
            author={authorLabel(focused, viewer)}
            onPick={() => focus(null)}
            onClose={() => focus(null)}
            actions={actionsFor(focused, true)}
          />
        </div>
      )}
    </div>
  );

  const closedBanner = !isOpen && (
    <div role="status" className="flex items-start gap-2.5 rounded-xl bg-surface-2 px-3 py-2.5 text-sm" data-testid="closed-banner">
      <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gray-9" />
      <span>
        <strong className="font-semibold">Closed {formatRelative(session.closedAt)}.</strong> Questions and votes are read-only.{' '}
        <Link to={`/s/${session.code}/wrap-up`}>See the wrap-up</Link>
      </span>
    </div>
  );
  const previewNote = isHost && !hostView && (
    <div role="status" className="flex items-start gap-2.5 rounded-xl bg-accent-3 px-3 py-2.5 text-sm text-accent-12">
      <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent-9" />
      <span>Attendee preview: hidden questions and anonymous names are hidden, as the room sees them.</span>
    </div>
  );

  const askBox = isOpen && (!isHost || !hostView) && (
    <AskBox
      ref={askRef}
      board={board}
      draft={draft}
      setDraft={setDraft}
      preview={isHost}
      onAsked={async (q) => {
        await reload();
        live.showAll();
        focus(q.id);
        setToast({ message: 'Posted. Watch it rise; others see it within 5 seconds.' });
      }}
    />
  );

  const rowsFor = (list: Question[]) =>
    list.map((q) => {
      const own = q.authorSub === me.sub;
      const score = scores.get(q.id) ?? 0;
      return (
        <QuestionRow
          key={q.id}
          q={q}
          author={authorLabel(q, viewer)}
          active={q.id === focusId}
          onFocusBubble={() => {
            if (q.status === 'hidden') return;
            setView('stage');
            focus(q.id);
          }}
          onHover={desktop && q.status !== 'hidden' ? (on) => setPeekId(on ? q.id : null) : undefined}
          meta={
            <span title={formatDateTime(q.createdAt)}>{q.status === 'answered' ? `answered ${formatRelative(q.answeredAt)}` : formatRelative(q.createdAt)}</span>
          }
          chips={<StatusChips q={q} mine={!isHost && own} isHost={hostView} />}
          vote={
            canVoteOn(q) ? (
              <UpvoteButton question={q} score={score} voted={voted.has(q.id)} busy={vote.pending} onToggle={() => void vote.run(q)} size={desktop ? 'md' : 'lg'} />
            ) : (
              <ScoreBox score={score} size={desktop ? 'md' : 'lg'} />
            )
          }
          actions={
            own && isOpen && q.status !== 'answered' ? (
              <Button size="sm" variant="ghost" onClick={() => setWithdrawing(q)}>
                Withdraw or reword
              </Button>
            ) : undefined
          }
        />
      );
    });

  const rail = (
    <section aria-label="Questions" className="min-w-0">
      <div className="mb-1 flex items-baseline justify-between gap-2 px-1">
        <h2 className="m-0 text-base font-semibold">Questions</h2>
        <span className="font-mono text-[11px] text-muted num">{sections.open.length} open · pinned first, then votes</span>
      </div>
      <NewQuestionsPill
        pending={live.pending.length}
        stale={live.stale}
        onShow={() => {
          live.showAll();
        }}
      />
      <InlineError error={vote.error} className="px-1" />
      {openList.length === 0 && live.pending.length === 0 ? (
        <EmptyState compact title={isOpen ? 'No questions yet' : 'Nothing left open'} icon={<Bubbles aria-hidden="true" />}>
          {isOpen ? (
            <>
              Be the first to ask. Others join with code <strong className="font-mono text-fg">{session.code}</strong>.
            </>
          ) : (
            'Nothing was left unanswered.'
          )}
        </EmptyState>
      ) : (
        <ul className="m-0 list-none divide-y divide-[var(--line)] p-0" data-testid="question-list">
          {rowsFor(openList)}
        </ul>
      )}
      {sections.answered.length > 0 && (
        <details className="group mt-3 border-t border-line pt-2" data-testid="answered-list">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-1 py-1.5 text-sm font-semibold hover:bg-gray-3">
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="size-2 rounded-full bg-green-8" />
              Answered
            </span>
            <span className="font-mono text-[11px] font-normal text-muted num">{sections.answered.length}</span>
          </summary>
          <ul className="m-0 mt-1 list-none divide-y divide-[var(--line)] p-0">{rowsFor(sections.answered)}</ul>
        </details>
      )}
      {hostView && sections.hidden.length > 0 && (
        <details className="mt-1 border-t border-line pt-2">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-1 py-1.5 text-sm font-semibold hover:bg-gray-3">
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="size-2 rounded-full bg-bad-solid" />
              Hidden from attendees
            </span>
            <span className="font-mono text-[11px] font-normal text-muted num">{sections.hidden.length}</span>
          </summary>
          <ul className="m-0 mt-1 list-none divide-y divide-[var(--line)] p-0">{rowsFor(sections.hidden)}</ul>
        </details>
      )}
    </section>
  );

  const todayPanel = (
    <TodayPanel
      bare
      items={today.map((t) => ({
        id: t.id,
        title: t.title,
        severity: t.severity as Tone,
        value: t.value,
        unit: t.unit,
        lens: LENS_LABEL[t.lens],
      }))}
      date={hostView ? 'Host view' : 'Right now'}
      activeId={today.find((t) => t.focusId === focusId)?.id ?? null}
      empty={isOpen ? 'Nothing needs you yet. Questions appear here as they rise.' : 'This session is closed.'}
      onSelect={(it) => {
        const def = today.find((t) => t.id === it.id);
        if (!def) return;
        setView('stage');
        setLens(def.lens);
        focus(def.focusId);
      }}
    />
  );

  const side = desktop ? (
    <div className="flex flex-col gap-4">
      {todayPanel}
      {closedBanner}
      {previewNote}
      {askBox}
      {rail}
    </div>
  ) : (
    todayPanel
  );

  const tools = isHost ? (
    <div className={cx('flex items-center gap-0.5 rounded-full p-1', view === 'stage' ? 'x-glass' : 'bg-gray-3')}>
      <LinkButton size="sm" variant="ghost" to={`/s/${session.code}/host`} icon={<ListChecks aria-hidden="true" />} className="rounded-full">
        Host deck
      </LinkButton>
      <LinkButton size="sm" variant="ghost" to={`/s/${session.code}/screen`} target="_blank" rel="noopener" icon={<Presentation aria-hidden="true" />} className="rounded-full">
        Big screen
      </LinkButton>
      <LinkButton size="sm" variant="ghost" to={`/s/${session.code}/wrap-up`} icon={<ScrollText aria-hidden="true" />} className="rounded-full">
        Wrap-up
      </LinkButton>
    </div>
  ) : (
    <div className={cx('flex h-10 items-center gap-1.5 rounded-full pl-3.5 pr-1', view === 'stage' ? 'x-glass' : 'bg-gray-3')}>
      <span className="x-legend-label text-[10px] text-muted">Code</span>
      <strong className="font-mono text-sm tracking-[0.12em]" data-testid="session-code">
        {session.code}
      </strong>
      <SafeCopyButton text={() => link} label="Copy link" variant="ghost" className="rounded-full" />
    </div>
  );

  const viewAsSwitch = isHost ? (
    <ViewAsSwitch<ViewAs>
      value={viewAs}
      glass={view === 'stage'}
      onChange={(v) => {
        setViewAs(v);
        focus(null);
      }}
      options={[
        { value: 'host', label: 'Host', name: session.hostName },
        { value: 'attendee', label: 'Attendee', icon: <Users /> },
      ]}
    />
  ) : undefined;

  const listView = (
    <div className="grid gap-5">
      {closedBanner}
      {previewNote}
      {askBox && <div className="max-w-2xl">{askBox}</div>}
      <InlineError error={vote.error} />
      <QuestionTable
        bubbles={order}
        hidden={hostView ? sections.hidden : []}
        lens={lens}
        viewer={viewer}
        focusId={focusId}
        voted={voted}
        canVote={canVoteOn}
        onVote={(q) => void vote.run(q)}
      />
    </div>
  );

  return (
    <>
      <StagePage
        label={STAGE_LABEL}
        view={view}
        breadcrumb={[{ label: 'Sessions', to: '/' }, { label: `Code ${session.code}` }]}
        title={session.title}
        meta={
          <>
            <LiveDot open={isOpen} />
            <span className="num">
              {counts.open} open · {counts.answered} answered · {plural(totalVotes, 'vote')} · {board.participants} taking part
            </span>
          </>
        }
        topRight={
          <>
            {tools}
            {view === 'list' && viewAsSwitch}
            {desktop && <ShortcutsButton glass={view === 'stage'} onClick={() => setHelp(true)} />}
            <ViewToggle value={view} onChange={setView} glass={view === 'stage'} stageLabel="Column" stageIcon={<Bubbles />} />
          </>
        }
        lenses={<LensBar lenses={LENS_OPTIONS} value={lens} onChange={setLens} />}
        legend={<Legend title={`${LENS_LABEL[lens]} lens`} items={legendFor(lens, counts)} collapsible defaultOpen={desktop} />}
        bottomRight={viewAsSwitch}
        side={side}
        sideTitle="Today"
        sideCount={today.length}
        stage={<div data-lens={lens} data-view-as={viewAs} className="absolute inset-0">{stage}</div>}
        list={listView}
      >
        {!desktop && view === 'stage' && (
          <div className="grid gap-4">
            {closedBanner}
            {previewNote}
            {askBox}
            {rail}
          </div>
        )}
      </StagePage>

      <ConfirmDialog
        open={!!withdrawing}
        onClose={() => setWithdrawing(null)}
        title="Withdraw this question?"
        confirmLabel="Withdraw"
        danger
        body={<p className="m-0">It leaves the board and its votes are lost. Your text goes back into the ask box, so you can reword it and ask again.</p>}
        onConfirm={async () => {
          if (!withdrawing) return;
          const q = await withdrawQuestion(store, me, withdrawing.id);
          setDraft(q.text);
          await reload();
          setToast({ message: 'Withdrawn. Its text is back in the ask box.' });
        }}
      />
      <ShortcutsDialog open={help} onClose={() => setHelp(false)} groups={boardShortcuts(isHost)} />
      <Toast
        message={toast?.message ?? null}
        action={toast?.undo ? { label: 'Undo', onClick: toast.undo } : undefined}
        onDone={() => setToast(null)}
      />
    </>
  );
}

const KEY_FOR: Record<ModerationAction, string> = { answer: 'A', pin: 'P', unpin: 'P', park: 'S', reopen: 'S', hide: 'H', unhide: 'H' };

function boardShortcuts(isHost: boolean): ShortcutGroup[] {
  const groups: ShortcutGroup[] = [
    {
      title: 'Column',
      keys: [
        { keys: ['1', '–', '4'], label: 'Top, Newest, Answered, Pinned' },
        { keys: ['J'], label: 'Next bubble' },
        { keys: ['K'], label: 'Previous bubble' },
        { keys: ['Esc'], label: 'Clear focus' },
        { keys: ['L'], label: 'Column or list' },
        { keys: ['?'], label: 'This cheat sheet' },
      ],
    },
  ];
  if (isHost)
    groups.push({
      title: 'Host',
      keys: [
        { keys: ['V'], label: 'View as host or attendee' },
        { keys: ['A'], label: 'Mark focused answered' },
        { keys: ['P'], label: 'Pin or unpin' },
        { keys: ['S'], label: 'Park or reopen' },
        { keys: ['H'], label: 'Hide from attendees' },
        { keys: ['D'], label: 'Host deck' },
        { keys: ['B'], label: 'Big screen' },
        { keys: ['W'], label: 'Wrap-up' },
      ],
    });
  else
    groups.push({
      title: 'Attendee',
      keys: [
        { keys: ['U'], label: 'Upvote the focused bubble' },
        { keys: ['/'], label: 'Write a question' },
        { keys: ['Ctrl', 'Enter'], label: 'Post it' },
        { keys: ['W'], label: 'Wrap-up' },
      ],
    });
  return groups;
}

/* ------------------------------------------------------------------ callout */

function BubbleCallout({
  b,
  side,
  focused,
  author,
  onPick,
  onClose,
  actions,
}: {
  b: Bubble | null;
  side: 'left' | 'right';
  focused: boolean;
  author: string;
  onPick: () => void;
  onClose: () => void;
  actions: ReactNode;
}) {
  if (!b) return null;
  const q = b.q;
  const tag =
    q.status === 'answered' ? 'Answered' : q.isPinned ? 'Pinned' : q.status === 'parked' ? 'Parked' : b.rank ? `#${b.rank}` : '';
  const head = (
    <div className={cx('flex items-center gap-1.5 font-mono text-[11px] text-muted num', side === 'left' && !focused && 'justify-end')}>
      <span className={cx('font-semibold', q.status === 'answered' ? 'text-ok-text' : 'text-accent-11')}>{tag}</span>
      <span aria-hidden="true">·</span>
      <span>{plural(b.score, 'vote')}</span>
    </div>
  );
  if (!focused)
    return (
      <div aria-hidden="true" onClick={onPick} className={cx('group cursor-pointer select-none', side === 'left' && 'text-right')}>
        {head}
        <p className="m-0 mt-0.5 line-clamp-3 text-[13px] leading-[18px] text-fg/85 transition-colors group-hover:text-fg">{q.text}</p>
      </div>
    );
  return (
    <div className="x-glass relative rounded-2xl p-3.5 shadow-2" data-testid="focus-card" role="region" aria-label="Focused question">
      <div className="flex items-start justify-between gap-2">
        {head}
        <button type="button" aria-label="Close" onClick={onClose} className="-m-1.5 grid size-7 shrink-0 cursor-pointer place-items-center rounded-md text-muted hover:bg-gray-3 hover:text-fg">
          <X aria-hidden="true" className="size-3.5" />
        </button>
      </div>
      <p className="m-0 mt-1 text-[15px] font-medium leading-[21px] text-fg">{q.text}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        <span className="font-medium text-fg/80">{author}</span>
        <span aria-hidden="true">·</span>
        <span>{formatRelative(q.createdAt)}</span>
      </div>
      {actions && <div className="mt-3 flex flex-wrap items-center gap-1.5">{actions}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ list view */

function QuestionTable({
  bubbles,
  hidden,
  lens,
  viewer,
  focusId,
  voted,
  canVote,
  onVote,
}: {
  bubbles: Bubble[];
  hidden: Question[];
  lens: Lens;
  viewer: { sub: string; isHost: boolean };
  focusId: string | null;
  voted: Set<string>;
  canVote: (q: Question) => boolean;
  onVote: (q: Question) => void;
}) {
  const rows: { q: Question; score: number; place: string }[] = [
    ...bubbles.map((b) => ({
      q: b.q,
      score: b.score,
      place: b.zone === 'dock' ? 'Pinned dock' : b.zone === 'shelf' ? (lens === 'answered' ? 'Shelf (open)' : 'Shelf') : `Column ${b.order + 1}`,
    })),
    ...hidden.map((q) => ({ q, score: 0, place: 'Hidden' })),
  ];
  if (rows.length === 0) return <EmptyState title="No questions yet">The table fills as the room asks.</EmptyState>;
  const status = (q: Question) =>
    q.status === 'answered' ? (
      <Badge tone="ok">Answered</Badge>
    ) : q.status === 'parked' ? (
      <Badge tone="warn">Parked</Badge>
    ) : q.status === 'hidden' ? (
      <Badge tone="bad">Hidden</Badge>
    ) : q.isPinned ? (
      <Badge tone="brand">Pinned</Badge>
    ) : (
      <Badge tone="info">Open</Badge>
    );
  return (
    <TableWrap label={`Questions in ${LENS_LABEL[lens]} order`}>
      <Table>
        <thead>
          <tr>
            <Th>Place</Th>
            <Th>Question</Th>
            <Th>Asked by</Th>
            <Th>Status</Th>
            <Th numeric>Votes</Th>
            <Th numeric>Asked</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ q, score, place }) => (
            <Tr key={q.id} selected={q.id === focusId} data-testid="list-row">
              <Td muted className="whitespace-nowrap font-mono text-xs">
                {place}
              </Td>
              <Td className="min-w-[260px] max-w-[520px]">{q.text}</Td>
              <Td muted className="whitespace-nowrap">
                {authorLabel(q, viewer)}
              </Td>
              <Td>{status(q)}</Td>
              <Td numeric>
                {canVote(q) ? (
                  <button
                    type="button"
                    aria-pressed={voted.has(q.id)}
                    aria-label={`${voted.has(q.id) ? 'Remove upvote from' : 'Upvote'}: ${q.text.slice(0, 60)}`}
                    onClick={() => onVote(q)}
                    className={cx(
                      'qa-upvote inline-flex h-7 min-w-12 cursor-pointer items-center justify-end gap-1 rounded-md px-2 font-mono',
                      voted.has(q.id) ? 'bg-accent-9 text-accent-contrast' : 'bg-gray-3 text-fg hover:bg-gray-4',
                    )}
                  >
                    <ArrowUp aria-hidden="true" className="size-3" strokeWidth={2.25} />
                    {score}
                  </button>
                ) : (
                  score
                )}
              </Td>
              <Td numeric muted className="whitespace-nowrap">
                {formatRelative(q.createdAt)}
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </TableWrap>
  );
}
