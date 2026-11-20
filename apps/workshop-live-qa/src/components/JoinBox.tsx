import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

import { useApp } from '@x10/shared/runtime';
import { useAction } from '@x10/shared/lib';
import { Button, cx, InlineError } from '@x10/shared/ui';

import { rules } from '../config';
import { normaliseCode, validateCodeInput } from '../domain/rules';
import { resolveJoin } from '../domain/sessions';
import type { Schema } from '../model';
import { rememberSession } from './recent';

/**
 * The join form: six code slots read like the code on the projector. A transparent input sits over the slots, so
 * typing, pasting and autofill all work; unknown and closed codes get a friendly message.
 */
export function JoinBox({ initialCode = '', autoFocus, size = 'md' }: { initialCode?: string; autoFocus?: boolean; size?: 'md' | 'lg' }) {
  const { store } = useApp<Schema>();
  const navigate = useNavigate();
  const id = useId();
  const [code, setCode] = useState(initialCode);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState<{ code: string; title: string } | null>(null);
  const join = useAction(async () => {
    setClosed(null);
    const msg = validateCodeInput(code);
    setError(msg);
    if (msg) return;
    const result = await resolveJoin(store, code);
    if (result.kind === 'unknown' || result.kind === 'invalid') {
      setError(`No session uses the code ${result.code}. Check it with your host and try again.`);
      return;
    }
    if (result.kind === 'closed') {
      setClosed({ code: result.code, title: result.session.title });
      return;
    }
    rememberSession(result.session);
    navigate(`/s/${result.code}`);
  });
  const slot = size === 'lg' ? 'h-14 w-11 text-[26px] sm:w-12' : 'h-12 w-10 text-[22px] sm:w-11';
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void join.run();
      }}
    >
      <label htmlFor={id} className="mb-2 block text-ui font-medium text-fg">
        Session code
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <div aria-hidden="true" className="flex gap-1.5">
            {Array.from({ length: rules.codeLength }, (_, i) => {
              const ch = code[i];
              const active = focused && (i === code.length || (code.length === rules.codeLength && i === rules.codeLength - 1));
              return (
                <span
                  key={i}
                  className={cx(
                    'grid place-items-center rounded-[10px] bg-[var(--field)] font-mono font-semibold uppercase text-fg transition-[box-shadow,background-color] duration-150',
                    slot,
                    error
                      ? 'shadow-[inset_0_0_0_1.5px_var(--bad-solid)]'
                      : active
                        ? 'shadow-[inset_0_0_0_2px_var(--accent-9),0_0_0_4px_color-mix(in_oklab,var(--accent-9)_16%,transparent)]'
                        : ch
                          ? 'shadow-[inset_0_0_0_1px_var(--accent-7)]'
                          : 'shadow-[inset_0_0_0_1px_var(--line-strong)]',
                  )}
                >
                  {ch ?? (active ? <span className="h-6 w-px animate-pulse bg-accent-9" /> : '')}
                </span>
              );
            })}
          </div>
          <input
            id={id}
            value={code}
            onChange={(e) => {
              setCode(normaliseCode(e.target.value).slice(0, rules.codeLength));
              if (error) setError(null);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? `${id}-err` : undefined}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            autoFocus={autoFocus}
            maxLength={rules.codeLength}
            inputMode="text"
            className="absolute inset-0 h-full w-full cursor-text bg-transparent font-mono text-transparent caret-transparent outline-none selection:bg-transparent"
          />
        </div>
        <Button type="submit" variant="primary" size="lg" busy={join.pending} iconRight={<ArrowRight aria-hidden="true" />} className={cx(size === 'lg' ? 'h-14 px-5' : 'h-12 px-4', 'max-sm:w-full')}>
          Join
        </Button>
      </div>
      {error && (
        <div id={`${id}-err`}>
          <InlineError error={error} />
        </div>
      )}
      {closed && (
        <div role="status" className="mt-3 flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-sm" data-testid="join-closed">
          <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gray-9" />
          <span>
            <strong className="font-semibold">{closed.title}</strong> has ended, so it no longer takes questions.{' '}
            <Link to={`/s/${closed.code}/wrap-up`}>See the wrap-up</Link>
          </span>
        </div>
      )}
      <InlineError error={join.error} />
    </form>
  );
}
