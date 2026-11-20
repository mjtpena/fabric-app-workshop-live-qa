/**
 * App configuration. No React imports here: tools/seed-fabric.mjs loads this file in Node to export seed rows.
 */
import type { Persona } from '@x10/shared/identity';
import type { AppConfig } from '@x10/shared/runtime';

import { defs, type Schema } from './model';
import { seed } from './seed';

export const personas: Persona[] = [
  { sub: 'demo-admin', name: 'Alex Rivera', email: 'alex@example.com', isAdmin: true, role: 'Admin' },
  { sub: 'demo-user', name: 'Sam Taylor', email: 'sam@example.com', isAdmin: false, role: 'User' },
];

export const config: AppConfig<Schema> = {
  appId: '__SLUG__',
  title: '__TITLE__',
  tagline: '__TAGLINE__',
  defs,
  personas,
  seed,
  nav: [
    { to: '/', label: 'Home', end: true },
    { to: '/about', label: 'About' },
  ],
};
