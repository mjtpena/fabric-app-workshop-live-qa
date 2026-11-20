/**
 * App configuration. No React imports here: tools/seed-fabric.mjs loads this file in Node to export seed rows.
 * Phone tab-bar icons are added in main.tsx.
 */
import type { Persona } from '@x10/shared/identity';
import type { AppConfig } from '@x10/shared/runtime';

import { defs, type Schema } from './model';
import { seed } from './seed';

/**
 * Demo personas. The first is the host (admin) and the default viewer. Three attendees make the multi-user rules
 * visible: Ana asks with her name, Chloe asks anonymously, Ben already has 4 unanswered questions (one short of the
 * limit of 5), and all three upvote.
 */
export const personas: Persona[] = [
  { sub: 'demo-host', name: 'Jordan Lee', email: 'jordan@example.com', isAdmin: true, role: 'Host' },
  { sub: 'demo-ana', name: 'Ana Souza', email: 'ana@example.com', isAdmin: false, role: 'Attendee' },
  { sub: 'demo-ben', name: 'Ben Carter', email: 'ben@example.com', isAdmin: false, role: 'Attendee, 4 open' },
  { sub: 'demo-chloe', name: 'Chloe Nguyen', email: 'chloe@example.com', isAdmin: false, role: 'Attendee, anonymous' },
];

export const config: AppConfig<Schema> = {
  appId: 'workshop-live-qa',
  title: 'Workshop Live Q&A',
  tagline: 'Questions rise as the room votes.',
  defs,
  personas,
  seed,
  accent: 'violet',
  // Logomark: one big bubble and two small ones rising from it.
  logoPaths: ['M9 20a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11Z', 'M17.5 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z', 'M13.5 4.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z'],
  nav: [
    { to: '/', label: 'Sessions', end: true },
    { to: '/deck', label: 'Host deck', adminOnly: true },
    { to: '/screen', label: 'Big screen', adminOnly: true },
    { to: '/wrap-up', label: 'Wrap-up', adminOnly: true },
    { to: '/about', label: 'About' },
  ],
};
