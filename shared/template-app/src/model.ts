/**
 * App data types and runtime entity definitions. Keep these in step with rayfin/data/*.ts:
 * every field listed here must exist on the entity class with the matching decorator.
 * Dates are ISO strings in the app; optional fields are `| null`.
 */
import type { EntityDefs } from '@x10/shared/data';
import { AppMarkerDef, PersonDef, type AppMarker, type Person } from '@x10/shared/identity';

export const limits = {
  noteTitle: { min: 3, max: 120 },
} as const;

export interface Note {
  id: string;
  title: string;
  authorSub: string;
  authorName: string;
  createdAt: string;
}

export type Schema = {
  Person: Person;
  AppMarker: AppMarker;
  Note: Note;
};

export const defs: EntityDefs<Schema> = {
  Person: PersonDef,
  AppMarker: AppMarkerDef,
  Note: {
    name: 'Note',
    fields: { id: 'uuid', title: 'text', authorSub: 'text', authorName: 'text', createdAt: 'date' },
  },
};
