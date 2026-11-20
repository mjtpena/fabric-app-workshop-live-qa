import type { DataStore, EntityDef } from '../data/types';

/**
 * Person: the shared identity entity every app carries (see shared/templates/rayfin/Person.ts).
 * `sub` is the Fabric SSO subject claim (`session.user.id`). `isAdmin` can only be set with SQL by the deployer;
 * the entity's row policy excludes it from client create and update.
 */
export interface Person {
  id: string;
  sub: string;
  displayName: string;
  email: string | null;
  isAdmin: boolean | null;
  createdAt: string;
}

export const PersonDef: EntityDef = {
  name: 'Person',
  fields: {
    id: 'uuid',
    sub: 'text',
    displayName: 'text',
    email: 'text',
    isAdmin: 'bool',
    createdAt: 'date',
  },
};

/** Marker rows written by seed scripts so a second run is a no-op. */
export interface AppMarker {
  id: string;
  key: string;
  createdAt: string;
}

export const AppMarkerDef: EntityDef = {
  name: 'AppMarker',
  fields: { id: 'uuid', key: 'text', createdAt: 'date' },
};

/** The signed-in user as the auth layer reports it. */
export interface Viewer {
  sub: string;
  name: string;
  email: string | null;
}

/** A fictional user offered by the demo-mode identity switcher. */
export interface Persona extends Viewer {
  isAdmin: boolean;
  /** Short role hint shown in the switcher, such as "Host" or "Attendee". */
  role: string;
}

type WithPerson = { Person: Person };

export const DISPLAY_NAME_LIMITS = { min: 1, max: 100 } as const;

function fallbackName(v: Viewer): string {
  const n = v.name?.trim();
  if (n) return n.slice(0, DISPLAY_NAME_LIMITS.max);
  if (v.email) return v.email.split('@')[0].slice(0, DISPLAY_NAME_LIMITS.max);
  return 'Signed-in user';
}

/** Find the viewer's Person row by `sub`, creating it on first load. Never sets `isAdmin`. */
export async function ensurePerson(store: DataStore<WithPerson>, viewer: Viewer, now = new Date()): Promise<Person> {
  const people = store.repo('Person');
  const existing = await people.list({ where: { sub: viewer.sub }, limit: 5 });
  if (existing.length) {
    // Keep the oldest row if two tabs raced on first load.
    return [...existing].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  }
  // isAdmin is deliberately not sent: the Person create policy excludes it (only SQL can grant admin).
  const input = {
    sub: viewer.sub,
    displayName: fallbackName(viewer),
    createdAt: now.toISOString(),
    ...(viewer.email ? { email: viewer.email } : {}),
  };
  return people.create(input as Parameters<typeof people.create>[0]);
}

export async function renamePerson(store: DataStore<WithPerson>, person: Person, displayName: string): Promise<Person> {
  const name = displayName.trim();
  if (name.length < DISPLAY_NAME_LIMITS.min || name.length > DISPLAY_NAME_LIMITS.max) {
    throw new Error(`Display name must be ${DISPLAY_NAME_LIMITS.min} to ${DISPLAY_NAME_LIMITS.max} characters.`);
  }
  return store.repo('Person').update(person.id, { displayName: name });
}

/** Person rows for the demo personas, for seeding the memory store. */
export function personaRows(personas: Persona[], now = new Date()): Person[] {
  return personas.map((p, i) => ({
    id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
    sub: p.sub,
    displayName: p.name,
    email: p.email,
    isAdmin: p.isAdmin,
    createdAt: new Date(now.getTime() - (personas.length - i) * 86400000).toISOString(),
  }));
}

export async function hasMarker(store: DataStore<{ AppMarker: AppMarker }>, key: string): Promise<boolean> {
  return (await store.repo('AppMarker').list({ where: { key }, limit: 1 })).length > 0;
}

export async function writeMarker(store: DataStore<{ AppMarker: AppMarker }>, key: string, now = new Date()) {
  await store.repo('AppMarker').create({ key, createdAt: now.toISOString() });
}
