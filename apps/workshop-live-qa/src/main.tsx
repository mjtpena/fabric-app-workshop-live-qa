import { Bubbles, Info, ListChecks, Presentation, ScrollText } from 'lucide-react';

import type { ReactElement } from 'react';

import { mountApp } from '@x10/shared/runtime';

import { App } from './App';
import { config } from './app.config';
import './index.css';

// Phone tab-bar icons (app.config.ts stays JSX-free for the Node seed tools).
const ICONS: Record<string, ReactElement> = {
  '/': <Bubbles />,
  '/deck': <ListChecks />,
  '/screen': <Presentation />,
  '/wrap-up': <ScrollText />,
  '/about': <Info />,
};

mountApp({ ...config, nav: config.nav.map((n) => ({ ...n, icon: ICONS[n.to] })) }, <App />);
