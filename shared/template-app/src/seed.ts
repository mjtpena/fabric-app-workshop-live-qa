import type { DataStore } from '@x10/shared/data';
import { addDays } from '@x10/shared/lib';
import type { SeedContext } from '@x10/shared/runtime';

import type { Schema } from './model';

/** Fictional, generic seed data. Dates are computed from ctx.now. Runs once (runSeed checks a marker row). */
export async function seed(store: DataStore<Schema>, ctx: SeedContext): Promise<void> {
  const [admin, user] = ctx.people;
  const notes = store.repo('Note');
  await notes.create({ title: 'Welcome to the app', authorSub: admin.sub, authorName: admin.displayName, createdAt: addDays(ctx.now, -2) });
  await notes.create({ title: 'A second example note', authorSub: user.sub, authorName: user.displayName, createdAt: addDays(ctx.now, -1) });
}
