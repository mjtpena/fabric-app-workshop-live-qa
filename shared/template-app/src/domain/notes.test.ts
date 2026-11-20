import { FIXED_NOW, testStore } from '@x10/shared/test';

import { personas } from '../app.config';
import { defs } from '../model';
import { seed } from '../seed';
import { addNote, listNotes, validateTitle } from './notes';

describe('notes', () => {
  it('validates the title with the entity limits', () => {
    expect(validateTitle('ab')).toMatch(/at least 3/);
    expect(validateTitle('fine title')).toBeNull();
  });

  it('seed is idempotent and new notes list first', async () => {
    const store = await testStore(defs, { personas, fn: seed, now: FIXED_NOW });
    const me = (await store.repo('Person').list())[0];
    expect(await listNotes(store)).toHaveLength(2);
    await addNote(store, me, 'Fresh note', new Date(FIXED_NOW.getTime() + 1000));
    expect((await listNotes(store))[0].title).toBe('Fresh note');
  });
});
