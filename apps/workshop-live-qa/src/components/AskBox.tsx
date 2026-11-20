import { forwardRef, useId, useState } from 'react';
import { SendHorizontal } from 'lucide-react';

import { useApp } from '@x10/shared/runtime';
import { useAction } from '@x10/shared/lib';
import { Button, Checkbox, cx, InlineError, Kbd, TextArea } from '@x10/shared/ui';

import { rules } from '../config';
import { askQuestion } from '../domain/questions';
import { limitMessage, validateQuestionText } from '../domain/rules';
import type { Board } from '../domain/sessions';
import { limits, type Question, type Schema } from '../model';

/**
 * The ask box: one field, the anonymity switch when the host allows it, and the five-question allowance as five dots.
 * The draft lives in the parent (component state only, by design), so a refused question keeps its text.
 */
export const AskBox = forwardRef<
  HTMLTextAreaElement,
  {
    board: Board;
    draft: string;
    setDraft: (v: string) => void;
    onAsked: (q: Question) => Promise<void>;
    /** Host previewing the attendee view: shown, but cannot post. */
    preview?: boolean;
    className?: string;
  }
>(function AskBox({ board, draft, setDraft, onAsked, preview, className }, ref) {
  const { store, me } = useApp<Schema>();
  const id = useId();
  const [anonymous, setAnonymous] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const max = rules.maxOpenQuestionsPerAttendee;
  const used = board.myOpenCount;
  const atLimit = used >= max;
  const length = draft.trim().length;
  const ask = useAction(async () => {
    const msg = validateQuestionText(draft);
    setError(msg);
    if (msg) return;
    const q = await askQuestion(store, me, board.session.id, { text: draft, anonymous: anonymous && board.session.allowAnonymous });
    setDraft('');
    await onAsked(q);
  });
  return (
    <form
      noValidate
      data-testid="ask-box"
      className={cx('rounded-2xl bg-surface p-3 shadow-[0_0_0_1px_var(--line),0_8px_24px_-12px_rgb(0_0_0/0.18)]', className)}
      onSubmit={(e) => {
        e.preventDefault();
        if (!preview) void ask.run();
      }}
    >
      <div className="flex items-baseline justify-between gap-2 px-0.5">
        <label htmlFor={id} className="text-ui font-semibold text-fg">
          Your question
        </label>
        <span className={cx('font-mono text-[11px] num', length > limits.questionText.max ? 'text-bad' : 'text-faint')} aria-hidden="true">
          {length}/{limits.questionText.max}
        </span>
      </div>
      <TextArea
        ref={ref}
        id={id}
        rows={3}
        value={draft}
        disabled={preview}
        onChange={(e) => {
          setDraft(e.target.value);
          if (error) setError(null);
        }}
        invalid={!!error}
        aria-describedby={`${id}-help`}
        placeholder={preview ? 'Attendees type their questions here' : 'What should the host answer?'}
        className="mt-1.5 min-h-[76px] resize-none text-[16px] md:text-sm"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            if (!preview) void ask.run();
          }
        }}
      />
      {error && <InlineError error={error} />}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        {board.session.allowAnonymous ? (
          <Checkbox label="Ask anonymously" checked={anonymous} onChange={setAnonymous} disabled={preview} />
        ) : (
          <span className="text-xs text-muted">Questions show your name</span>
        )}
        <Button
          type="submit"
          variant="primary"
          busy={ask.pending}
          disabled={atLimit || preview}
          iconRight={<SendHorizontal aria-hidden="true" />}
          className="h-10 max-md:w-full md:h-8"
        >
          Ask question
        </Button>
      </div>
      <div id={`${id}-help`} className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-2.5 text-xs text-muted">
        <span className="inline-flex items-center gap-1" aria-hidden="true">
          {Array.from({ length: max }, (_, i) => (
            <span key={i} className={cx('size-2 rounded-full', i < used ? 'bg-accent-9' : 'bg-gray-5')} />
          ))}
        </span>
        <span data-testid="open-count">
          {used} of {max} unanswered questions used
        </span>
        {anonymous && board.session.allowAnonymous && <span className="basis-full">Others see "Anonymous"; the host still sees your name.</span>}
        {!preview && (
          <span className="ml-auto hidden items-center gap-1 md:inline-flex">
            <Kbd>Ctrl</Kbd>
            <Kbd>Enter</Kbd>
          </span>
        )}
      </div>
      {atLimit && !preview && (
        <p role="alert" className="m-0 mt-2.5 flex items-start gap-2 rounded-xl bg-warn-soft px-3 py-2.5 text-ui text-warn-text" data-testid="limit-message">
          <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warn-solid" />
          <span>{limitMessage(max)}</span>
        </p>
      )}
      <InlineError error={ask.error} />
    </form>
  );
});
