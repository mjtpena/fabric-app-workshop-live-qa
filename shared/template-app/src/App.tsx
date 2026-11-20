import { Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from '@x10/shared/runtime';

import { AboutPage } from './pages/AboutPage';
import { HomePage } from './pages/HomePage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<AppShell><HomePage /></AppShell>} />
      <Route path="/about" element={<AppShell><AboutPage /></AppShell>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
