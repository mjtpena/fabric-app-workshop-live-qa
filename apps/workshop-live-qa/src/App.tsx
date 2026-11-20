import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';

import { AppShell } from '@x10/shared/runtime';

import { codeFromQuery } from './domain/rules';
import { AboutPage } from './pages/AboutPage';
import { BoardPage } from './pages/BoardPage';
import { HomePage } from './pages/HomePage';
import { HostPage } from './pages/HostPage';
import { JoinPage } from './pages/JoinPage';
import { LatestSession } from './pages/LatestSession';
import { WrapUpPage } from './pages/WrapUpPage';

// The big screen carries the motion library; load it only when a projector opens it.
const ScreenPage = lazy(() => import('./pages/ScreenPage').then((m) => ({ default: m.ScreenPage })));

/** Accept `?code=ABC123` in the normal query string too (for links typed or shortened without the hash route). */
function CodeFromQueryString() {
  const navigate = useNavigate();
  useEffect(() => {
    const code = codeFromQuery(window.location.search);
    if (!code) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('code');
    window.history.replaceState(window.history.state, '', url.toString());
    navigate(`/join?code=${encodeURIComponent(code)}`, { replace: true });
  }, [navigate]);
  return null;
}

export function App() {
  return (
    <>
      <CodeFromQueryString />
      <Routes>
        <Route path="/" element={<AppShell><HomePage /></AppShell>} />
        <Route path="/join" element={<AppShell><JoinPage /></AppShell>} />
        {/* The centrepiece: the rising column for one session. */}
        <Route path="/s/:code" element={<AppShell immersive><BoardPage /></AppShell>} />
        <Route path="/s/:code/host" element={<AppShell wide><HostPage /></AppShell>} />
        <Route path="/s/:code/wrap-up" element={<AppShell><WrapUpPage /></AppShell>} />
        {/* Big screen: no AppShell, so no header, nav or controls. */}
        <Route
          path="/s/:code/screen"
          element={
            <Suspense fallback={<main className="qa-screen min-h-screen" data-testid="big-screen" />}>
              <ScreenPage />
            </Suspense>
          }
        />
        {/* Tools in the nav open the host's latest session. */}
        <Route path="/deck" element={<AppShell><LatestSession tool="host" /></AppShell>} />
        <Route path="/screen" element={<AppShell><LatestSession tool="screen" /></AppShell>} />
        <Route path="/wrap-up" element={<AppShell><LatestSession tool="wrap-up" /></AppShell>} />
        <Route path="/about" element={<AppShell><AboutPage /></AppShell>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
