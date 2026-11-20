import { useId, useState } from 'react';

import { useApp } from '@x10/shared/runtime';
import { useAsync, useAction, formatRelative } from '@x10/shared/lib';
import { Button, Card, DataState, EmptyState, Field, InlineError, Input, PageHeader } from '@x10/shared/ui';

import { addNote, listNotes, validateTitle } from '../domain/notes';
import { limits, type Schema } from '../model';

export function HomePage() {
  const { store, me } = useApp<Schema>();
  const notes = useAsync(() => listNotes(store), [store]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const save = useAction(async () => {
    const msg = validateTitle(title);
    setError(msg);
    if (msg) return;
    await addNote(store, me, title);
    setTitle('');
    await notes.reload();
  });

  return (
    <>
      <PageHeader title="Notes" subtitle="Replace this example page with the app's first screen." />
      <Card className="mb-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save.run();
          }}
        >
          <Field label="Title" htmlFor={id} error={error} required counter={{ value: title.length, max: limits.noteTitle.max }}>
            <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} invalid={!!error} />
          </Field>
          <Button type="submit" variant="primary" busy={save.pending}>
            Add note
          </Button>
          <InlineError error={save.error} />
        </form>
      </Card>
      <DataState state={notes} isEmpty={(d) => d.length === 0} empty={<EmptyState title="No notes yet" />}>
        {(list) => (
          <ul className="m-0 list-none space-y-2 p-0">
            {list.map((n) => (
              <li key={n.id}>
                <Card as="div">
                  <strong>{n.title}</strong>
                  <div className="text-sm text-muted">
                    {n.authorName} · {formatRelative(n.createdAt)}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </DataState>
    </>
  );
}
