import { AppMarker } from './AppMarker.js';
import { Note } from './Note.js';
import { Person } from './Person.js';

export type AppSchema = {
  Person: Person;
  AppMarker: AppMarker;
  Note: Note;
};

export const schema = [Person, AppMarker, Note];
