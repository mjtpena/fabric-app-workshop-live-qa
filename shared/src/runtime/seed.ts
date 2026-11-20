import type { DataStore } from '../data/types';
import { hasMarker, personaRows, writeMarker, type AppMarker, type Person, type Persona } from '../identity';

export interface SeedContext {
  /** The run time. Seed dates must be computed from it, never hard-coded. */
  now: Date;
  personas: Persona[];
  /** Person rows created for the personas, in persona order. */
  people: Person[];
}

export type SeedFn<S> = (store: DataStore<S>, ctx: SeedContext) => Promise<void>;

export const SEED_MARKER = 'seed:v1';

/**
 * Idempotent seed: does nothing when the marker row exists. Inserts persona Person rows, runs the app's seed,
 * then writes the marker last so a failed run can be retried.
 */
export async function runSeed<S extends { Person: Person; AppMarker: AppMarker }>(
  store: DataStore<S>,
  personas: Persona[],
  seed: SeedFn<S>,
  now = new Date(),
): Promise<boolean> {
  const s = store as unknown as DataStore<{ Person: Person; AppMarker: AppMarker }>;
  if (await hasMarker(s, SEED_MARKER)) return false;
  const people: Person[] = [];
  const existing = await s.repo('Person').list();
  for (const p of personaRows(personas, now)) {
    const found = existing.find((e) => e.sub === p.sub);
    people.push(found ?? (await s.repo('Person').create(p)));
  }
  await seed(store, { now, personas, people });
  await writeMarker(s, SEED_MARKER, now);
  return true;
}
