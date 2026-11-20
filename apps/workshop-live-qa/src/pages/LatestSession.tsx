import { Navigate } from 'react-router-dom';
import { Bubbles } from 'lucide-react';

import { useApp } from '@x10/shared/runtime';
import { useAsync } from '@x10/shared/lib';
import { ErrorPanel, LinkButton, Skeleton } from '@x10/shared/ui';

import { MessagePage } from '../components/states';
import { listMySessions } from '../domain/sessions';
import type { Schema } from '../model';

const NAMES = { host: 'Host deck', screen: 'Big screen', 'wrap-up': 'Wrap-up' } as const;

/**
 * The nav's tools (Host deck, Big screen, Wrap-up) open the host's latest live session, or the latest session of any
 * kind for the wrap-up. With none, a designed empty state points to starting one.
 */
export function LatestSession({ tool }: { tool: 'host' | 'screen' | 'wrap-up' }) {
  const { store, me, isAdmin } = useApp<Schema>();
  const sessions = useAsync(() => (isAdmin ? listMySessions(store, me) : Promise.resolve([])), [store, me.sub, isAdmin]);
  if (!isAdmin) return <Navigate to="/" replace />;
  if (sessions.error && !sessions.data) return <ErrorPanel error={sessions.error} onRetry={() => void sessions.reload()} />;
  if (!sessions.data)
    return (
      <div className="mx-auto max-w-md py-14" role="status" aria-label="Loading">
        <Skeleton width={160} height={14} />
        <Skeleton width={280} height={28} className="mt-3" />
      </div>
    );
  const list = sessions.data;
  const pick = tool === 'wrap-up' ? list[0] : list.find((s) => s.session.status === 'open');
  if (pick) return <Navigate to={`/s/${pick.session.code}/${tool}`} replace />;
  return (
    <MessagePage
      title={tool === 'wrap-up' ? 'No sessions to wrap up' : 'No live session'}
      icon={
        <span className="grid size-10 place-items-center rounded-xl bg-accent-3 text-accent-11">
          <Bubbles aria-hidden="true" className="size-5" />
        </span>
      }
      action={
        <LinkButton to="/" variant="primary">
          Start a session
        </LinkButton>
      }
    >
      {NAMES[tool]} opens your latest {tool === 'wrap-up' ? 'session' : 'live session'}. Start one from Sessions.
    </MessagePage>
  );
}
