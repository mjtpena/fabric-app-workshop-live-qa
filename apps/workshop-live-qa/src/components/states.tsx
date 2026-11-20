import type { ReactNode } from 'react';
import { MessageCircleQuestion } from 'lucide-react';

import { AppLogo } from '@x10/shared/runtime';
import { cx } from '@x10/shared/ui';

import { JoinBox } from './JoinBox';

/** A centred message page with the logomark: unknown codes, "host only" and similar dead ends. */
export function MessagePage({
  title,
  children,
  action,
  testId,
  icon,
  className,
}: {
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  testId?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('mx-auto w-full max-w-md px-0 py-6 md:py-14', className)} data-testid={testId}>
      <div className="mb-5 flex items-center gap-3">
        {icon ?? <AppLogo size={36} />}
      </div>
      <h1 className="m-0 text-2xl font-semibold tracking-[-0.02em]">{title}</h1>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/** Not-found state for a code that matches no session, with the join form to try again. */
export function UnknownSession({ code }: { code: string }) {
  return (
    <MessagePage
      testId="unknown-session"
      icon={
        <span className="grid size-10 place-items-center rounded-xl bg-accent-3 text-accent-11">
          <MessageCircleQuestion aria-hidden="true" className="size-5" />
        </span>
      }
      title={
        <>
          No session with code <span className="font-mono tracking-[0.08em]">{code}</span>
        </>
      }
      action={<JoinBox />}
    >
      Codes are six letters or digits, shown on the host's screen.
    </MessagePage>
  );
}
