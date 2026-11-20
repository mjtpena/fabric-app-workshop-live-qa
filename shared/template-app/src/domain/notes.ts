import { RuleError, type DataStore } from '@x10/shared/data';
import type { Person } from '@x10/shared/identity';
import { checkText } from '@x10/shared/lib';

import { limits, type Note, type Schema } from '../model';

export function validateTitle(title: string): string | null {
  return checkText(title, { ...limits.noteTitle, label: 'Title' });
}

export async function listNotes(store: DataStore<Schema>): Promise<Note[]> {
  return store.repo('Note').list({ orderBy: { field: 'createdAt', dir: 'desc' } });
}

export async function addNote(store: DataStore<Schema>, me: Person, title: string, now = new Date()): Promise<Note> {
  const msg = validateTitle(title);
  if (msg) throw new RuleError(msg);
  return store.repo('Note').create({
    title: title.trim(),
    authorSub: me.sub,
    authorName: me.displayName,
    createdAt: now.toISOString(),
  });
}
