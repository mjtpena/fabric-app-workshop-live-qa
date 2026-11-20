import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { MessageCircleQuestion, ScrollText } from 'lucide-react';

import { useApp } from '@x10/shared/runtime';
import { useAsync } from '@x10/shared/lib';
import { DataState, Skeleton } from '@x10/shared/ui';

import { JoinBox } from '../components/JoinBox';
import { rememberSession } from '../components/recent';
import { MessagePage } from '../components/states';
import { normaliseCode } from '../domain/rules';
import { resolveJoin } from '../domain/sessions';
import type { Schema } from '../model';

const badge = (icon: React.ReactNode) => <span className="grid size-10 place-items-center rounded-xl bg-accent-3 text-accent-11 [&_svg]:size-5">{icon}</span>;

/** Landing route for join links and QR codes: /join?code=ABC123. Open sessions go straight to the board. */
export function JoinPage() {
  const { store } = useApp<Schema>();
  const [params] = useSearchParams();
  const code = normaliseCode(params.get('code'));
  const result = useAsync(() => resolveJoin(store, code), [store, code]);

  if (!code) {
    return (
      <MessagePage title="Join a session" action={<JoinBox autoFocus size="lg" />}>
        Type the six-character code on the host's screen.
      </MessagePage>
    );
  }

  return (
    <DataState
      state={result}
      skeleton={
        <div className="mx-auto max-w-md py-14">
          <Skeleton width={40} height={40} />
          <Skeleton width={300} height={28} className="mt-5" />
          <Skeleton width={240} height={14} className="mt-3" />
        </div>
      }
    >
      {(r) => {
        if (r.kind === 'open') {
          rememberSession(r.session);
          return <Navigate to={`/s/${r.code}`} replace />;
        }
        return r.kind === 'closed' ? (
          <MessagePage testId="join-message" icon={badge(<ScrollText aria-hidden="true" />)} title={`${r.session.title} has ended`} action={<JoinBox />}>
            The host closed this session, so it no longer takes questions or votes.{' '}
            <Link to={`/s/${r.code}/wrap-up`}>See the wrap-up</Link>
          </MessagePage>
        ) : (
          <MessagePage testId="join-message" icon={badge(<MessageCircleQuestion aria-hidden="true" />)} title="We could not find that session" action={<JoinBox />}>
            No session uses the code <strong className="font-mono text-fg">{r.code}</strong>. The link may have a typo; try typing the code.
          </MessagePage>
        );
      }}
    </DataState>
  );
}
