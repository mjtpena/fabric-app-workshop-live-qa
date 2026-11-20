import { createMemoryStore } from '../data/memoryStore';
import type { DataStore, EntityDefs } from '../data/types';
import type { AppMarker, Person, Persona } from '../identity';
import { runSeed, type SeedFn } from '../runtime/seed';

/** A fresh in-memory store for a unit test, optionally seeded with the app's seed. */
export async function testStore<S extends { Person: Person; AppMarker: AppMarker }>(
  defs: EntityDefs<S>,
  seed?: { personas: Persona[]; fn: SeedFn<S>; now?: Date },
): Promise<DataStore<S> & { dump(): Record<string, Record<string, unknown>[]> }> {
  const store = createMemoryStore<S>(defs);
  if (seed) await runSeed(store, seed.personas, seed.fn, seed.now ?? new Date());
  return store;
}

/** Fixed clock for deterministic tests: 2026-11-20 09:00 UTC unless given. */
export const FIXED_NOW = new Date('2026-11-20T09:00:00.000Z');
