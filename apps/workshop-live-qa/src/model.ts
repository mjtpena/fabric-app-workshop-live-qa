/**
 * App data types and runtime entity definitions. Keep these in step with rayfin/data/*.ts:
 * every field listed here must exist on the entity class with the matching decorator.
 * Dates are ISO strings in the app; optional fields are `| null`.
 */
import type { EntityDefs } from '@x10/shared/data';
import { AppMarkerDef, PersonDef, type AppMarker, type Person } from '@x10/shared/identity';

/** The same numbers as the @text({ min, max }) decorators. */
export const limits = {
  sessionTitle: { min: 3, max: 100 },
  questionText: { min: 3, max: 280 },
  code: { min: 6, max: 6 },
} as const;

export const SESSION_STATUSES = ['open', 'closed'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const QUESTION_STATUSES = ['new', 'answered', 'parked', 'hidden'] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export interface QaSession {
  id: string;
  title: string;
  code: string;
  hostSub: string;
  hostName: string;
  status: SessionStatus;
  allowAnonymous: boolean;
  createdAt: string;
  closedAt: string | null;
}

export interface Question {
  id: string;
  sessionId: string;
  text: string;
  authorSub: string;
  authorName: string;
  isAnonymous: boolean;
  isPinned: boolean;
  status: QuestionStatus;
  hostSub: string;
  createdAt: string;
  answeredAt: string | null;
}

export interface Upvote {
  id: string;
  questionId: string;
  sessionId: string;
  voterSub: string;
  createdAt: string;
}

export type Schema = {
  Person: Person;
  AppMarker: AppMarker;
  QaSession: QaSession;
  Question: Question;
  Upvote: Upvote;
};

export const defs: EntityDefs<Schema> = {
  Person: PersonDef,
  AppMarker: AppMarkerDef,
  QaSession: {
    name: 'QaSession',
    fields: {
      id: 'uuid',
      title: 'text',
      code: 'text',
      hostSub: 'text',
      hostName: 'text',
      status: 'set',
      allowAnonymous: 'bool',
      createdAt: 'date',
      closedAt: 'date',
    },
  },
  Question: {
    name: 'Question',
    fields: {
      id: 'uuid',
      sessionId: 'uuid',
      text: 'text',
      authorSub: 'text',
      authorName: 'text',
      isAnonymous: 'bool',
      isPinned: 'bool',
      status: 'set',
      hostSub: 'text',
      createdAt: 'date',
      answeredAt: 'date',
    },
  },
  Upvote: {
    name: 'Upvote',
    fields: { id: 'uuid', questionId: 'uuid', sessionId: 'uuid', voterSub: 'text', createdAt: 'date' },
  },
};
