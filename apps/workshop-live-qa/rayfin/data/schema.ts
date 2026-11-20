import { AppMarker } from './AppMarker.js';
import { Person } from './Person.js';
import { QaSession } from './QaSession.js';
import { Question } from './Question.js';
import { Upvote } from './Upvote.js';

export type AppSchema = {
  Person: Person;
  AppMarker: AppMarker;
  QaSession: QaSession;
  Question: Question;
  Upvote: Upvote;
};

export const schema = [Person, AppMarker, QaSession, Question, Upvote];
