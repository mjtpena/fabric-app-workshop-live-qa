/**
 * Big screen: the projector view, rendered without the app shell (no header, nav, buttons or links). The top five
 * questions in huge type re-order with a spring as votes arrive (polled every 5 s); a slim rising column beside them
 * shows every open question as a bubble, numbered where it matches the list; the join code and QR fill the right.
 * A fixed dark palette reads from the back of a room on any projector. Escape returns to the host deck.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useApp } from '@x10/shared/runtime';
import { plural } from '@x10/shared/lib';
import { cx, useMediaQuery } from '@x10/shared/ui';
import { AnimatePresence, motion, MotionProvider } from '@x10/shared/motion';

import { useBoard } from '../components/live';
import { QrCode } from '../components/ui';
import { rules } from '../config';
import { authorLabel, joinLink, normaliseCode, topForScreen } from '../domain/rules';
import type { Board } from '../domain/sessions';
import type { Schema } from '../model';
import { arrange, type Bubble } from '../stage/arrange';
import { RisingColumn, type ColumnGeometry } from '../stage/RisingColumn';

export function ScreenPage() {
  const code = normaliseCode(useParams().code);
  const board = useBoard(code);
  const navigate = useNavigate();
  const { me } = useApp<Schema>();
  const hostSub = board.data?.session.hostSub;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate(hostSub === me.sub ? `/s/${code}/host` : `/s/${code}`);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [code, hostSub, me.sub, navigate]);

  return (
    <main className="qa-screen min-h-screen overflow-hidden" data-testid="big-screen" data-accent="violet" aria-live="polite">
      {board.data ? (
        <MotionProvider>
          <Screen board={board.data} />
        </MotionProvider>
      ) : board.data === null ? (
        <Message title={`No session with code ${code}`} body="Check the link in the host deck." />
      ) : board.error ? (
        <Message title="Could not load the questions" body={`${board.error.message} Retrying every ${rules.pollMs / 1000} seconds.`} />
      ) : (
        <Message title="Gathering the questions…" />
      )}
    </main>
  );
}

function Message({ title, body }: { title: string; body?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-8 text-center">
      <h1 className="m-0 text-[clamp(2rem,4vw,4rem)] font-semibold tracking-[-0.02em]">{title}</h1>
      {body && <p className="mt-4 text-[clamp(1.2rem,2vw,2rem)] text-[var(--scr-muted)]">{body}</p>}
    </div>
  );
}

const stripGeometry = ({ w, h }: { w: number; h: number }): ColumnGeometry => ({ column: { left: 6, top: 6, right: w - 6, bottom: h - 6 } });

function Screen({ board }: { board: Board }) {
  const { session } = board;
  const wide = useMediaQuery('(min-width: 1024px)');
  const top = topForScreen(board.questions, board.scores, rules.bigScreenTop);
  const link = joinLink(window.location.href, session.code);
  const viewer = { sub: '', isHost: false };
  const isOpen = session.status === 'open';
  const attendeeView = useMemo(() => board.questions.filter((q) => q.status !== 'hidden'), [board.questions]);
  const answered = attendeeView.filter((q) => q.status === 'answered').length;
  const maxScore = Math.max(1, ...top.map((q) => board.scores.get(q.id) ?? 0));

  // Vote arrivals since the last poll, for the "+n" on the orbs.
  const prev = useRef(new Map<string, number>());
  const [bumps, setBumps] = useState<Record<string, number>>({});
  useEffect(() => {
    const next: Record<string, number> = {};
    for (const q of top) {
      const s = board.scores.get(q.id) ?? 0;
      const p = prev.current.get(q.id);
      if (p !== undefined && s > p) next[q.id] = s - p;
    }
    prev.current = new Map(attendeeView.map((q) => [q.id, board.scores.get(q.id) ?? 0]));
    if (Object.keys(next).length) {
      setBumps(next);
      const t = setTimeout(() => setBumps({}), 1600);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board]);

  // The strip: every open question as a bubble; the top five carry their list number.
  const topIndex = useMemo(() => new Map(top.map((q, i) => [q.id, i + 1])), [top]);
  const bubbles = useMemo(
    () =>
      arrange(attendeeView, board.scores, 'top').map((b): Bubble =>
        topIndex.has(b.id) ? { ...b, fill: '#8b5cf6', ink: '#fff' } : b.zone === 'shelf' ? { ...b, fill: '#3dd68c', ink: '#0b1f14' } : { ...b, fill: '#3b3159', ink: '#d9d0ff' },
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [board],
  );

  return (
    <div className="grid min-h-screen gap-[2.4vw] px-[3vw] py-[3.2vh] lg:grid-cols-[minmax(130px,9vw)_minmax(0,1fr)_minmax(290px,24vw)]">
      {wide && (
        <div className="relative min-h-[60vh] overflow-hidden rounded-[28px]" aria-hidden="true">
          <RisingColumn
            bubbles={bubbles}
            geometry={stripGeometry}
            label="Every open question"
            interactive={false}
            excerpts={false}
            fill={0.42}
            badgeFor={(b) => topIndex.get(b.id) ?? ''}
            shelfCaption={answered ? `${answered} answered` : undefined}
            className="[&_.x-legend-label]:text-[var(--scr-muted)]"
          />
        </div>
      )}

      <section className="flex min-w-0 flex-col">
        <div className="flex items-center gap-3 font-mono text-[clamp(0.85rem,1.1vw,1.25rem)] font-medium uppercase tracking-[0.2em] text-[var(--scr-accent-2)]">
          <span className={cx('size-2.5 rounded-full', isOpen ? 'bg-[var(--scr-ok)] shadow-[0_0_0_6px_rgb(61_214_140/0.18)]' : 'bg-[var(--scr-muted)]')} aria-hidden="true" />
          {isOpen ? 'Top questions right now' : 'This session has closed'}
        </div>
        <h1 className="x-serif m-0 mt-2 text-[clamp(1.9rem,min(3.4vw,5.2vh),4.4rem)] leading-[1.02] break-words">{session.title}</h1>
        {top.length === 0 ? (
          <p className="mt-[6vh] text-[clamp(1.6rem,2.8vw,3rem)] leading-snug text-[var(--scr-muted)]" data-testid="screen-empty">
            No questions yet. Scan the code and ask the first one.
          </p>
        ) : (
          <ol className="m-0 mt-[2.4vh] flex list-none flex-col gap-[1.1vh] p-0">
            <AnimatePresence initial={false}>
              {top.map((q, i) => {
                const score = board.scores.get(q.id) ?? 0;
                const t = Math.sqrt(score / maxScore);
                return (
                  <motion.li
                    key={q.id}
                    layout
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                    className="flex items-center gap-[1.6vw] rounded-[24px] border border-[var(--scr-line)] bg-[var(--scr-panel)] px-[1.4vw] py-[1.2vh]"
                    data-testid="screen-question"
                  >
                    <div className="relative grid w-[clamp(4rem,min(6vw,10vh),8rem)] shrink-0 place-items-center">
                      <motion.div
                        key={score}
                        initial={bumps[q.id] ? { scale: 0.82 } : false}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 14 }}
                        className="qa-face relative! grid place-items-center"
                        style={
                          {
                            width: `calc(clamp(4rem,min(6vw,10vh),8rem) * ${0.7 + 0.3 * t})`,
                            aspectRatio: '1',
                            '--qa-fill': i === 0 ? '#8b5cf6' : t > 0.6 ? '#7c4ef0' : '#5b45a8',
                            '--qa-ink': '#fff',
                          } as CSSProperties
                        }
                      >
                        <span className="relative z-[1] flex flex-col items-center leading-none">
                          <span className="text-[clamp(1.6rem,min(2.6vw,4.6vh),3.2rem)] font-semibold tracking-[-0.03em] num">{score}</span>
                          <span className="mt-1 text-[clamp(0.6rem,0.75vw,0.9rem)] font-semibold uppercase tracking-[0.12em] opacity-85">{score === 1 ? 'vote' : 'votes'}</span>
                        </span>
                      </motion.div>
                      {bumps[q.id] && <span className="qa-plus text-[clamp(0.9rem,1.1vw,1.3rem)]! text-[var(--scr-ok)]!">+{bumps[q.id]}</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cx(
                          'm-0 line-clamp-3 font-medium leading-[1.18] tracking-[-0.012em] break-words',
                          q.text.length > 140 ? 'text-[clamp(1.1rem,min(1.5vw,2.5vh),2.1rem)]' : 'text-[clamp(1.25rem,min(1.9vw,2.85vh),2.6rem)]',
                        )}
                      >
                        <span className="sr-only">Question {i + 1}: </span>
                        {q.text}
                      </p>
                      <p className="m-0 mt-[0.7vh] flex flex-wrap items-center gap-x-3 text-[clamp(0.95rem,min(1.15vw,2vh),1.4rem)] text-[var(--scr-muted)]">
                        <span>{authorLabel(q, viewer)}</span>
                        {q.isPinned && (
                          <span className="inline-flex items-center gap-2 font-medium text-[var(--scr-accent-2)]">
                            <span aria-hidden="true" className="size-2 rounded-full bg-[var(--scr-accent-2)]" />
                            Pinned
                          </span>
                        )}
                        {q.status === 'parked' && (
                          <span className="inline-flex items-center gap-2">
                            <span aria-hidden="true" className="size-2 rounded-full border border-current" />
                            Parked
                          </span>
                        )}
                      </p>
                    </div>
                    <span aria-hidden="true" className="hidden shrink-0 self-start font-mono text-[clamp(0.8rem,0.95vw,1.1rem)] text-[var(--scr-muted)] lg:block">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ol>
        )}
      </section>

      <aside className="flex flex-col items-center gap-[2.2vh] self-start rounded-[28px] border border-[var(--scr-line)] bg-[var(--scr-panel)] p-[2vw] text-center lg:sticky lg:top-[3.2vh]">
        <p className="m-0 text-[clamp(1.3rem,2vw,2.4rem)] font-semibold tracking-[-0.015em]">{isOpen ? 'Scan to ask' : 'Thanks for joining'}</p>
        {isOpen && <QrCode url={link} className="w-full max-w-[min(24vw,400px)] min-w-[220px] rounded-[18px] p-2" />}
        <div>
          <p className="m-0 font-mono text-[clamp(0.85rem,1.1vw,1.25rem)] uppercase tracking-[0.3em] text-[var(--scr-muted)]">or join with code</p>
          <p className="m-0 mt-1 font-mono text-[clamp(2.8rem,5vw,6rem)] font-semibold leading-none tracking-[0.1em]" data-testid="join-code">
            {session.code}
          </p>
        </div>
        <div className="flex w-full items-center justify-center gap-[1.6vw] border-t border-[var(--scr-line)] pt-[2vh] text-[clamp(0.95rem,1.15vw,1.35rem)] text-[var(--scr-muted)]">
          <span>
            <strong className="font-semibold text-[var(--scr-text)] num">{board.participants}</strong> {board.participants === 1 ? 'person' : 'people'}
          </span>
          <span>
            <strong className="font-semibold text-[var(--scr-text)] num">{board.upvotes.length}</strong> {board.upvotes.length === 1 ? 'vote' : 'votes'}
          </span>
          <span>
            <strong className="font-semibold text-[var(--scr-ok)] num">{answered}</strong> answered
          </span>
        </div>
        <span className="sr-only">{`${plural(board.participants, 'person', 'people')} taking part`}</span>
      </aside>
    </div>
  );
}
