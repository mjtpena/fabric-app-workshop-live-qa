/**
 * Host deck: the moderation queue. A dense, keyboard-first list (J/K to move, A answer, P pin, S park, H hide,
 * E edit) beside a spotlight of the selected question and the join code. Live: polls every 5 s, and new questions
 * wait behind a pill so the queue never jumps under the host.
 */
import { useEffect, useId, useMemo, useRef, useState, type ReactElement } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Bubbles,
  CheckCheck,
  Eye,
  EyeOff,
  Pause,
  Pencil,
  Pin,
  PinOff,
  Presentation,
  RotateCcw,
  ScrollText,
} from 'lucide-react';

import { useApp } from '@x10/shared/runtime';
import { formatDateTime, formatRelative, plural, useAction } from '@x10/shared/lib';
import {
  Breadcrumb,
  Button,
  ConfirmDialog,
  cx,
  DataState,
  Dialog,
  EmptyState,
  Field,
  IconButton,
  InlineError,
  Kbd,
  LinkButton,
  Skeleton,
  Stat,
  StatStrip,
  Tabs,
  TextArea,
  Toast,
  useHotkeys,
  useMediaQuery,
} from '@x10/shared/ui';

import { useBoard, useStableOrder } from '../components/live';
import { ShortcutsButton, ShortcutsDialog, type ShortcutGroup } from '../components/Shortcuts';
import { MessagePage, UnknownSession } from '../components/states';
import { LiveDot, NewQuestionsPill, QrCode, SafeCopyButton, StatusChips, VoteOrb } from '../components/ui';
import { rules } from '../config';
import { editQuestionText, moderateQuestion } from '../domain/questions';
import {
  ACTION_LABELS,
  allowedActions,
  authorLabel,
  boardSections,
  joinLink,
  normaliseCode,
  validateQuestionText,
  type ModerationAction,
} from '../domain/rules';
import { closeSession, type Board } from '../domain/sessions';
import { limits, type Question, type Schema } from '../model';

export function HostPage() {
  const code = normaliseCode(useParams().code);
  const board = useBoard(code);
  return (
    <DataState state={board} isEmpty={(b) => b === null} empty={<UnknownSession code={code} />} skeleton={<DeckSkeleton />}>
      {(b) =>
        b &&
        (b.isHost ? (
          <HostDeck board={b} reload={board.reload} />
        ) : (
          <MessagePage
            title="Only the host can open the host deck"
            action={
              <LinkButton to={`/s/${b.session.code}`} variant="primary" icon={<Bubbles aria-hidden="true" />}>
                Go to the board
              </LinkButton>
            }
          >
            {b.session.title} is hosted by {b.session.hostName}. You can still ask and vote on the board.
          </MessagePage>
        ))
      }
    </DataState>
  );
}

function DeckSkeleton() {
  return (
    <div>
      <Skeleton width={140} height={12} />
      <Skeleton width={360} height={28} className="mt-3" />
      <Skeleton height={84} className="mt-6" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} height={64} />
          ))}
        </div>
        <Skeleton height={420} className="max-lg:hidden" />
      </div>
    </div>
  );
}

type Tab = 'open' | 'answered' | 'hidden';

const KEY: Record<ModerationAction, string> = { answer: 'A', pin: 'P', unpin: 'P', park: 'S', reopen: 'R', hide: 'H', unhide: 'H' };
const ICON: Record<ModerationAction, ReactElement> = {
  answer: <CheckCheck aria-hidden="true" />,
  pin: <Pin aria-hidden="true" />,
  unpin: <PinOff aria-hidden="true" />,
  park: <Pause aria-hidden="true" />,
  reopen: <RotateCcw aria-hidden="true" />,
  hide: <EyeOff aria-hidden="true" />,
  unhide: <Eye aria-hidden="true" />,
};

const SHORTCUTS: ShortcutGroup[] = [
  {
    title: 'Queue',
    keys: [
      { keys: ['J'], label: 'Next question' },
      { keys: ['K'], label: 'Previous question' },
      { keys: ['1', '2', '3'], label: 'Open, Answered, Hidden' },
      { keys: ['N'], label: 'Show new questions' },
      { keys: ['?'], label: 'This cheat sheet' },
    ],
  },
  {
    title: 'Selected question',
    keys: [
      { keys: ['A'], label: 'Mark answered' },
      { keys: ['P'], label: 'Pin or unpin' },
      { keys: ['S'], label: 'Park' },
      { keys: ['R'], label: 'Reopen' },
      { keys: ['H'], label: 'Hide or unhide' },
      { keys: ['E'], label: 'Edit the text' },
    ],
  },
  {
    title: 'Tools',
    keys: [
      { keys: ['G'], label: 'Board (the column)' },
      { keys: ['B'], label: 'Big screen' },
      { keys: ['W'], label: 'Wrap-up' },
    ],
  },
];

function HostDeck({ board, reload }: { board: Board; reload: () => Promise<void> }) {
  const { store, me } = useApp<Schema>();
  const navigate = useNavigate();
  const wide = useMediaQuery('(min-width: 1024px)');
  const { session } = board;
  const isOpen = session.status === 'open';
  const viewer = { sub: me.sub, isHost: true };
  const sections = boardSections(board.questions, board.scores, true);
  const live = useStableOrder(sections.open.map((q) => q.id));
  const byId = useMemo(() => new Map(board.questions.map((q) => [q.id, q])), [board.questions]);
  const openList = live.order.map((id) => byId.get(id)).filter((q): q is Question => !!q);
  const [tab, setTab] = useState<Tab>('open');
  const [closing, setClosing] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const lastIndex = useRef(0);
  const link = joinLink(window.location.href, session.code);
  const maxScore = Math.max(1, ...board.questions.map((q) => board.scores.get(q.id) ?? 0));

  const list: Question[] = tab === 'open' ? openList : tab === 'answered' ? sections.answered : sections.hidden;
  const current = (selected && list.find((q) => q.id === selected)) || list[Math.min(lastIndex.current, list.length - 1)] || null;
  useEffect(() => {
    if (current) lastIndex.current = list.indexOf(current);
  }, [current, list]);

  const moderate = useAction(async (q: Question, action: ModerationAction) => {
    setBusy(`${q.id}:${action}`);
    try {
      await moderateQuestion(store, me, q.id, action);
    } finally {
      setBusy(null);
      await reload();
    }
    const undo: Partial<Record<ModerationAction, ModerationAction>> = { answer: 'reopen', hide: 'unhide', park: 'reopen', pin: 'unpin', unpin: 'pin' };
    const back = undo[action];
    setToast({
      message: `${ACTION_LABELS[action]}: "${q.text.length > 48 ? `${q.text.slice(0, 47)}…` : q.text}"`,
      undo: back ? () => void moderateQuestion(store, me, q.id, back).then(reload) : undefined,
    });
  });

  const act = (a: ModerationAction) => {
    if (!current || !isOpen || moderate.pending) return;
    if (allowedActions(current).includes(a)) void moderate.run(current, a);
  };
  const move = (d: 1 | -1) => {
    if (!list.length) return;
    const i = current ? list.indexOf(current) : -1;
    const next = list[Math.max(0, Math.min(list.length - 1, i + d))];
    setSelected(next.id);
    document.querySelector(`[data-testid="question-card"][data-id="${CSS.escape(next.id)}"]`)?.scrollIntoView({ block: 'nearest' });
  };

  useHotkeys({
    j: () => move(1),
    arrowdown: () => move(1),
    k: () => move(-1),
    arrowup: () => move(-1),
    a: () => act('answer'),
    p: () => current && act(current.isPinned ? 'unpin' : 'pin'),
    s: () => act('park'),
    r: () => act('reopen'),
    h: () => current && act(current.status === 'hidden' ? 'unhide' : 'hide'),
    e: () => current && isOpen && current.status !== 'hidden' && setEditing(current),
    1: () => setTab('open'),
    2: () => setTab('answered'),
    3: () => setTab('hidden'),
    n: () => live.showAll(),
    g: () => navigate(`/s/${session.code}`),
    b: () => window.open(`#/s/${session.code}/screen`, '_blank', 'noopener'),
    w: () => navigate(`/s/${session.code}/wrap-up`),
    'shift+?': () => setHelp(true),
  });

  const parked = sections.open.filter((q) => q.status === 'parked').length;

  return (
    <div data-testid="host-console">
      <Breadcrumb items={[{ label: 'Sessions', to: '/' }, { label: `${session.code} · Host deck` }]} className="mb-2" />
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="m-0 text-2xl font-semibold tracking-[-0.02em] break-words">{session.title}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-ui text-muted">
            <LiveDot open={isOpen} />
            <span>{isOpen ? `Started ${formatRelative(session.createdAt)} · updates every ${rules.pollMs / 1000} s` : `Closed ${formatDateTime(session.closedAt)} · read-only`}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LinkButton to={`/s/${session.code}`} icon={<Bubbles aria-hidden="true" />}>
            Board
          </LinkButton>
          <LinkButton to={`/s/${session.code}/screen`} target="_blank" rel="noopener" icon={<Presentation aria-hidden="true" />}>
            Big screen
          </LinkButton>
          <LinkButton to={`/s/${session.code}/wrap-up`} icon={<ScrollText aria-hidden="true" />}>
            Wrap-up
          </LinkButton>
          <ShortcutsButton onClick={() => setHelp(true)} />
          {isOpen && (
            <Button variant="danger" onClick={() => setClosing(true)}>
              Close session
            </Button>
          )}
        </div>
      </div>

      <StatStrip className="mt-5">
        <Stat label="Open" value={sections.open.length} hint={parked ? `${parked} parked` : 'none parked'} />
        <Stat label="Answered" value={sections.answered.length} tone={sections.answered.length ? 'ok' : undefined} />
        <div data-testid="kpi-participants" className="min-w-0">
          <Stat label="Attendees active" value={board.participants} hint="asked or voted" />
        </div>
        <Stat label="Upvotes" value={board.upvotes.length} hint={`${sections.hidden.length} hidden`} />
      </StatStrip>

      {!wide && <JoinCode code={session.code} link={link} compact className="mt-4" />}

      {!isOpen && (
        <div role="status" className="mt-4 flex items-start gap-2.5 rounded-xl bg-surface-2 px-3 py-2.5 text-sm">
          <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gray-9" />
          <span>This session is closed, so moderation is off. The wrap-up has the answered and unanswered lists.</span>
        </div>
      )}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <Tabs<Tab>
            label="Question lists"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'open', label: `Open (${sections.open.length})` },
              { value: 'answered', label: `Answered (${sections.answered.length})` },
              { value: 'hidden', label: `Hidden (${sections.hidden.length})` },
            ]}
          />
          {tab === 'open' && <NewQuestionsPill pending={live.pending.length} stale={live.stale} onShow={() => live.showAll()} />}
          <InlineError error={moderate.error} />
          {list.length === 0 && !(tab === 'open' && live.pending.length > 0) ? (
            board.questions.length === 0 ? (
              <EmptyState title="No questions yet" icon={<Bubbles aria-hidden="true" />}>
                <span className="block">Share the code and the room can start asking.</span>
                <span className="mt-3 block font-mono text-4xl font-semibold tracking-[0.2em] text-fg">{session.code}</span>
              </EmptyState>
            ) : (
              <EmptyState compact title={tab === 'open' ? 'Nothing open' : tab === 'answered' ? 'Nothing answered yet' : 'Nothing hidden'}>
                {tab === 'open'
                  ? 'Every question has been answered or set aside.'
                  : tab === 'answered'
                    ? 'Press A on a question once you have covered it.'
                    : 'Hidden questions disappear for attendees and wait here.'}
              </EmptyState>
            )
          ) : (
            <ul className="m-0 mt-2 list-none divide-y divide-[var(--line)] p-0" data-testid="question-list">
              {list.map((q, i) => (
                <DeckRow
                  key={q.id}
                  q={q}
                  index={tab === 'open' ? i + 1 : null}
                  selected={current?.id === q.id}
                  score={board.scores.get(q.id) ?? 0}
                  maxScore={maxScore}
                  author={authorLabel(q, viewer)}
                  isOpen={isOpen}
                  busy={busy}
                  onSelect={() => setSelected(q.id)}
                  onAct={(a) => void moderate.run(q, a)}
                  onEdit={() => setEditing(q)}
                />
              ))}
            </ul>
          )}
        </div>
        {wide && (
          <aside className="sticky top-[calc(var(--header-h)+16px)] grid gap-4" aria-label="Spotlight">
            <Spotlight
              q={current}
              rank={tab === 'open' && current ? list.indexOf(current) + 1 : null}
              of={list.length}
              score={current ? board.scores.get(current.id) ?? 0 : 0}
              maxScore={maxScore}
              author={current ? authorLabel(current, viewer) : ''}
              isOpen={isOpen}
              busy={busy}
              onAct={(a) => current && void moderate.run(current, a)}
              onEdit={() => current && setEditing(current)}
            />
            <JoinCode code={session.code} link={link} />
          </aside>
        )}
      </div>

      <ConfirmDialog
        open={closing}
        onClose={() => setClosing(false)}
        title="Close this session?"
        confirmLabel="Close session"
        danger
        body={<p className="m-0">Attendees can no longer ask or vote, and the board becomes read-only. The wrap-up opens with the answered and unanswered lists.</p>}
        onConfirm={async () => {
          await closeSession(store, me, session.id);
          await reload();
          navigate(`/s/${session.code}/wrap-up`);
        }}
      />
      <EditDialog question={editing} onClose={() => setEditing(null)} onSaved={reload} />
      <ShortcutsDialog open={help} onClose={() => setHelp(false)} groups={SHORTCUTS} />
      <Toast message={toast?.message ?? null} action={toast?.undo ? { label: 'Undo', onClick: toast.undo } : undefined} onDone={() => setToast(null)} />
    </div>
  );
}

function DeckRow({
  q,
  index,
  selected,
  score,
  maxScore,
  author,
  isOpen,
  busy,
  onSelect,
  onAct,
  onEdit,
}: {
  q: Question;
  index: number | null;
  selected: boolean;
  score: number;
  maxScore: number;
  author: string;
  isOpen: boolean;
  busy: string | null;
  onSelect: () => void;
  onAct: (a: ModerationAction) => void;
  onEdit: () => void;
}) {
  const actions = allowedActions(q);
  return (
    <li
      className={cx(
        'group relative flex cursor-pointer flex-wrap items-start gap-3 py-3 pl-3 pr-2 transition-colors duration-150 sm:flex-nowrap',
        selected ? 'bg-[color-mix(in_oklab,var(--accent-9)_8%,transparent)]' : 'hover:bg-[color-mix(in_oklab,var(--gray-12)_3%,transparent)]',
      )}
      data-testid="question-card"
      data-status={q.status}
      data-id={q.id}
      aria-current={selected || undefined}
      onClick={onSelect}
    >
      {selected && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-accent-9" />}
      <span className="w-6 shrink-0 pt-2 text-right font-mono text-[11px] text-faint num">{index ?? ''}</span>
      <VoteOrb score={score} max={maxScore} tone={q.status === 'answered' ? 'ok' : q.status === 'hidden' || q.status === 'parked' ? 'muted' : 'accent'} />
      <div className="min-w-0 flex-1">
        <p className="m-0 whitespace-pre-wrap break-words text-sm leading-5 text-fg" data-testid="question-text">
          {q.text}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span className="font-medium text-fg/80" data-testid="question-author">
            {author}
          </span>
          <span aria-hidden="true" className="text-faint">
            ·
          </span>
          <span title={formatDateTime(q.createdAt)}>{q.status === 'answered' ? `answered ${formatRelative(q.answeredAt)}` : formatRelative(q.createdAt)}</span>
          <StatusChips q={q} isHost />
        </div>
      </div>
      {isOpen && (
        <div className="flex shrink-0 items-center gap-0.5 self-center max-sm:w-full max-sm:justify-end max-sm:gap-1" onClick={(e) => e.stopPropagation()}>
          {actions.map((a) =>
            a === 'answer' ? (
              <Button
                key={a}
                size="sm"
                variant="soft"
                aria-label={ACTION_LABELS[a]}
                title={`${ACTION_LABELS[a]} (${KEY[a]})`}
                icon={ICON[a]}
                busy={busy === `${q.id}:${a}`}
                disabled={!!busy}
                onClick={() => onAct(a)}
              >
                Answer
              </Button>
            ) : (
              <IconButton
                key={a}
                size="sm"
                label={ACTION_LABELS[a]}
                title={`${ACTION_LABELS[a]} (${KEY[a]})`}
                icon={ICON[a]}
                busy={busy === `${q.id}:${a}`}
                disabled={!!busy}
                onClick={() => onAct(a)}
              />
            ),
          )}
          {q.status !== 'hidden' && <IconButton size="sm" label="Edit text" title="Edit text (E)" icon={<Pencil aria-hidden="true" />} onClick={onEdit} />}
        </div>
      )}
    </li>
  );
}

function Spotlight({
  q,
  rank,
  of,
  score,
  maxScore,
  author,
  isOpen,
  busy,
  onAct,
  onEdit,
}: {
  q: Question | null;
  rank: number | null;
  of: number;
  score: number;
  maxScore: number;
  author: string;
  isOpen: boolean;
  busy: string | null;
  onAct: (a: ModerationAction) => void;
  onEdit: () => void;
}) {
  if (!q)
    return (
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="x-legend-label text-muted">Spotlight</div>
        <p className="m-0 mt-3 text-sm text-muted">Select a question with J and K, or click one.</p>
      </section>
    );
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-1" data-testid="spotlight">
      <div className="flex items-center justify-between gap-3">
        <span className="x-legend-label text-muted">Spotlight{rank ? ` · #${rank} of ${of}` : ''}</span>
        <VoteOrb score={score} max={maxScore} tone={q.status === 'answered' ? 'ok' : 'accent'} />
      </div>
      <p className="m-0 mt-3 text-xl font-medium leading-7 tracking-[-0.015em] text-fg">{q.text}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        <span className="font-medium text-fg/80">{author}</span>
        <span aria-hidden="true">·</span>
        <span>{formatRelative(q.createdAt)}</span>
        <span aria-hidden="true">·</span>
        <span className="num">{plural(score, 'vote')}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <StatusChips q={q} isHost />
      </div>
      {isOpen && (
        <div className="mt-4 grid grid-cols-2 gap-1.5 border-t border-line pt-4">
          {allowedActions(q).map((a) => (
            <Button
              key={a}
              size="md"
              variant={a === 'answer' ? 'primary' : 'secondary'}
              icon={ICON[a]}
              busy={busy === `${q.id}:${a}`}
              disabled={!!busy}
              onClick={() => onAct(a)}
              className={cx('justify-between', a === 'answer' && 'col-span-2')}
              iconRight={<Kbd className={a === 'answer' ? 'bg-white/20! text-white! shadow-none!' : ''}>{KEY[a]}</Kbd>}
            >
              <span className="flex-1 text-left">{ACTION_LABELS[a]}</span>
            </Button>
          ))}
          {q.status !== 'hidden' && (
            <Button size="md" icon={<Pencil aria-hidden="true" />} onClick={onEdit} iconRight={<Kbd>E</Kbd>} className="justify-between">
              <span className="flex-1 text-left">Edit text</span>
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function JoinCode({ code, link, compact, className }: { code: string; link: string; compact?: boolean; className?: string }) {
  return (
    <section className={cx('rounded-2xl border border-line bg-surface', compact ? 'flex items-center justify-between gap-3 p-3' : 'p-5', className)} aria-label="Join code">
      <div className="min-w-0">
        <div className="x-legend-label text-muted">Join code</div>
        <div className={cx('font-mono font-semibold tracking-[0.18em] text-fg', compact ? 'text-2xl' : 'mt-1 text-4xl')} data-testid="join-code">
          {code}
        </div>
        {!compact && <div className="mt-1 truncate font-mono text-xs text-muted">{link}</div>}
      </div>
      {compact ? (
        <SafeCopyButton text={link} label="Copy join link" size="md" />
      ) : (
        <div className="mt-4 flex items-end justify-between gap-4">
          <SafeCopyButton text={link} label="Copy join link" size="md" />
          <QrCode url={link} className="w-24 rounded-lg p-1 shadow-[0_0_0_1px_var(--line)]" />
        </div>
      )}
    </section>
  );
}

function EditDialog({ question, onClose, onSaved }: { question: Question | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const { store, me } = useApp<Schema>();
  const id = useId();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [openFor, setOpenFor] = useState<string | null>(null);
  if (question && openFor !== question.id) {
    setOpenFor(question.id);
    setText(question.text);
    setError(null);
  }
  const save = useAction(async () => {
    if (!question) return;
    const msg = validateQuestionText(text);
    setError(msg);
    if (msg) return;
    await editQuestionText(store, me, question.id, text);
    await onSaved();
    close();
  });
  const close = () => {
    setOpenFor(null);
    save.clearError();
    onClose();
  };
  return (
    <Dialog
      open={!!question}
      onClose={close}
      title="Edit question text"
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" busy={save.pending} onClick={() => void save.run()}>
            Save
          </Button>
        </>
      }
    >
      <Field label="Question" htmlFor={id} error={error} counter={{ value: text.trim().length, max: limits.questionText.max }} hint="Fix typos or merge a duplicate. The author and votes stay the same.">
        <TextArea id={id} rows={4} value={text} onChange={(e) => setText(e.target.value)} invalid={!!error} />
      </Field>
      <InlineError error={save.error} />
    </Dialog>
  );
}
