/**
 * App-local components on top of @x10/shared/ui: the copy button that never throws, the thumb-sized upvote with its
 * press, the question row used by every list, status badges, the vote orb, the "new questions" pill and the QR code.
 */
import QRCode from 'qrcode';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowUp, Check, Copy, RefreshCw } from 'lucide-react';

import { copyText, truncate } from '@x10/shared/lib';
import { Badge, Button, cx } from '@x10/shared/ui';

import type { Question } from '../model';

/* ------------------------------------------------------------------ copy */

/**
 * Copy button that reports failure instead of throwing (a clipboard rejection happens when the browser denies
 * clipboard access).
 */
export function SafeCopyButton({
  text,
  label = 'Copy',
  size = 'sm',
  variant = 'secondary',
  testId,
  className,
}: {
  text: string | (() => string);
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'ghost' | 'subtle';
  testId?: string;
  className?: string;
}) {
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle');
  useEffect(() => {
    if (state === 'idle') return;
    const t = setTimeout(() => setState('idle'), 2000);
    return () => clearTimeout(t);
  }, [state]);
  return (
    <Button
      size={size}
      variant={variant}
      data-testid={testId}
      className={className}
      icon={state === 'done' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      onClick={async () => {
        try {
          await copyText(typeof text === 'function' ? text() : text);
          setState('done');
        } catch {
          setState('failed');
        }
      }}
    >
      {state === 'done' ? 'Copied' : state === 'failed' ? 'Copy blocked: select the text' : label}
      <span className="sr-only" aria-live="polite">
        {state === 'done' ? 'Copied to clipboard' : state === 'failed' ? 'The browser blocked the clipboard' : ''}
      </span>
    </Button>
  );
}

/* ------------------------------------------------------------------ votes */

const votesWord = (n: number) => (n === 1 ? 'vote' : 'votes');

/**
 * The upvote: a tall pill under the thumb. It sinks on press, fills violet with a one-off burst when the vote lands,
 * and the count ticks up. `size="lg"` is the 56px phone target.
 */
export function UpvoteButton({
  question,
  score,
  voted,
  busy,
  onToggle,
  size = 'md',
  testId = 'upvote-button',
}: {
  question: Pick<Question, 'text'>;
  score: number;
  voted: boolean;
  busy?: boolean;
  onToggle: () => void;
  size?: 'md' | 'lg';
  testId?: string;
}) {
  // Burst only on the transition to voted, not on first render.
  const was = useRef(voted);
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    if (voted && !was.current) setBurst((b) => b + 1);
    was.current = voted;
  }, [voted]);
  return (
    <button
      type="button"
      aria-pressed={voted}
      aria-label={`${voted ? 'Remove upvote from' : 'Upvote'}: ${truncate(question.text, 60)} (${score} ${votesWord(score)})`}
      aria-busy={busy || undefined}
      onClick={onToggle}
      data-testid={testId}
      className={cx(
        'qa-upvote relative flex shrink-0 cursor-pointer select-none flex-col items-center justify-center rounded-[14px] font-semibold',
        size === 'lg' ? 'h-[60px] w-14' : 'h-[52px] w-12',
        voted
          ? 'bg-accent-9 text-accent-contrast shadow-[0_6px_16px_-6px_var(--accent-9)]'
          : 'bg-surface text-fg shadow-[inset_0_0_0_1px_var(--line-strong),0_1px_2px_rgb(0_0_0/0.06)] hover:text-accent-11 hover:shadow-[inset_0_0_0_1px_var(--accent-8),0_1px_2px_rgb(0_0_0/0.06)]',
      )}
    >
      {burst > 0 && <span key={burst} aria-hidden="true" className="qa-burst" />}
      <ArrowUp aria-hidden="true" className={cx(size === 'lg' ? 'size-5' : 'size-4', 'transition-transform duration-150', voted && '-translate-y-px')} strokeWidth={2.25} />
      <span key={score} className={cx('qa-count leading-tight num', size === 'lg' ? 'text-lg' : 'text-base')} data-testid="score">
        {score}
      </span>
    </button>
  );
}

/** The vote count where voting is not possible (own question, host, closed session). */
export function ScoreBox({ score, size = 'md' }: { score: number; size?: 'md' | 'lg' }) {
  return (
    <div
      className={cx(
        'flex shrink-0 flex-col items-center justify-center rounded-[14px] bg-surface-sunken text-fg',
        size === 'lg' ? 'h-[60px] w-14' : 'h-[52px] w-12',
      )}
      aria-label={`${score} ${votesWord(score)}`}
    >
      <span className="text-base font-semibold leading-tight num" data-testid="score">
        {score}
      </span>
      <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted">{votesWord(score)}</span>
    </div>
  );
}

/** A small bubble sized by votes, for dense lists (host deck, wrap-up). */
export function VoteOrb({ score, max, tone = 'accent', label }: { score: number; max: number; tone?: 'accent' | 'ok' | 'muted'; label?: ReactNode }) {
  const t = max > 0 ? Math.sqrt(score / max) : 0;
  const d = Math.round(26 + 14 * t);
  const fill = tone === 'ok' ? 'var(--green-9)' : tone === 'muted' ? 'var(--gray-6)' : score === 0 ? 'var(--accent-5)' : t < 0.6 ? 'var(--accent-8)' : 'var(--accent-10)';
  const ink = tone === 'muted' || (tone === 'accent' && (score === 0 || t < 0.6)) ? 'var(--accent-12)' : '#fff';
  return (
    <span className="grid w-10 shrink-0 place-items-center" aria-hidden="true">
      <span
        className="qa-face relative! grid place-items-center text-[13px] font-semibold num"
        style={{ width: d, height: d, '--qa-fill': fill, '--qa-ink': ink } as CSSProperties}
      >
        <span className="relative z-[1]">{label ?? score}</span>
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ status */

export function StatusChips({ q, mine, isHost }: { q: Question; mine?: boolean; isHost?: boolean }) {
  return (
    <>
      {q.isPinned && (
        <Badge size="sm" tone="brand">
          Pinned
        </Badge>
      )}
      {q.status === 'parked' && (
        <Badge size="sm" tone="warn">
          Parked
        </Badge>
      )}
      {q.status === 'answered' && (
        <Badge size="sm" tone="ok">
          Answered
        </Badge>
      )}
      {q.status === 'hidden' && (
        <Badge size="sm" tone="bad">
          Hidden
        </Badge>
      )}
      {mine && (
        <Badge size="sm" tone="info">
          Yours
        </Badge>
      )}
      {isHost && q.isAnonymous && (
        <Badge size="sm" tone="neutral">
          Anonymous to attendees
        </Badge>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ question row */

/**
 * One question in a list: vote control, text, author line with status, optional actions. Rows sit in a divided list
 * (no card per item). `active` tints the row that the column has focused.
 */
export function QuestionRow({
  q,
  vote,
  author,
  meta,
  chips,
  actions,
  active,
  onFocusBubble,
  onHover,
}: {
  q: Question;
  vote: ReactNode;
  author: string;
  meta?: ReactNode;
  chips?: ReactNode;
  actions?: ReactNode;
  active?: boolean;
  onFocusBubble?: () => void;
  onHover?: (on: boolean) => void;
}) {
  return (
    <li
      className={cx(
        'relative flex gap-3 rounded-xl px-2.5 py-3 transition-colors duration-150',
        active ? 'bg-[color-mix(in_oklab,var(--accent-9)_9%,transparent)]' : 'hover:bg-[color-mix(in_oklab,var(--gray-12)_4%,transparent)]',
      )}
      data-testid="question-card"
      data-status={q.status}
      data-id={q.id}
      onMouseEnter={onHover ? () => onHover(true) : undefined}
      onMouseLeave={onHover ? () => onHover(false) : undefined}
    >
      {vote}
      <div className="min-w-0 flex-1">
        <p
          className={cx('m-0 whitespace-pre-wrap break-words text-sm leading-5 text-fg', onFocusBubble && 'cursor-pointer')}
          data-testid="question-text"
          onClick={onFocusBubble}
        >
          {q.text}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span className="font-medium text-fg/80" data-testid="question-author">
            {author}
          </span>
          {meta && (
            <>
              <span aria-hidden="true" className="text-faint">
                ·
              </span>
              {meta}
            </>
          )}
          {chips}
        </div>
        {actions && <div className="mt-2 flex flex-wrap items-center gap-1.5">{actions}</div>}
      </div>
    </li>
  );
}

/** Pill shown above a live list when questions arrived (or the order changed) since the reader last looked. */
export function NewQuestionsPill({ pending, stale, onShow }: { pending: number; stale: boolean; onShow: () => void }) {
  const label = pending > 0 ? `${pending} new ${pending === 1 ? 'question' : 'questions'}` : stale ? 'Re-sort by votes' : null;
  return (
    <div aria-live="polite" className="sticky top-2 z-20 flex h-0 justify-center overflow-visible">
      {label && (
        <button
          type="button"
          onClick={onShow}
          data-testid="new-questions-pill"
          className="inline-flex h-8 -translate-y-1 animate-x-in cursor-pointer items-center gap-1.5 rounded-full bg-accent-9 px-3.5 text-ui font-semibold text-accent-contrast shadow-[0_8px_20px_-8px_var(--accent-9)] transition-colors hover:bg-accent-10"
        >
          {pending > 0 ? <ArrowUp aria-hidden="true" className="size-3.5" strokeWidth={2.25} /> : <RefreshCw aria-hidden="true" className="size-3.5" />}
          {label}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ QR */

/** QR code for a URL, generated in the browser as SVG (dark modules on white, with a quiet zone). */
export function QrCode({ url, className }: { url: string; className?: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    QRCode.toString(url, { type: 'svg', margin: 2, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } })
      .then((s) => live && setSvg(s))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [url]);
  if (failed) {
    return (
      <div className={cx('flex aspect-square items-center justify-center bg-white p-4 text-center text-black', className)}>
        QR code unavailable. Use the code below.
      </div>
    );
  }
  return (
    <div
      role="img"
      aria-label={`QR code for the join link ${url}`}
      data-testid="join-qr"
      data-join-url={url}
      data-ready={svg ? 'true' : 'false'}
      className={cx('aspect-square bg-white [&>svg]:block [&>svg]:h-full [&>svg]:w-full', className)}
      dangerouslySetInnerHTML={{ __html: svg ?? '' }}
    />
  );
}

/** Live / closed status as a dot and a label. */
export function LiveDot({ open }: { open: boolean }) {
  return open ? (
    <Badge tone="ok" pulse size="sm">
      Live
    </Badge>
  ) : (
    <Badge tone="neutral" size="sm">
      Closed
    </Badge>
  );
}
