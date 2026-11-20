import { boolean, date, entity, role, set, text, uuid } from '@microsoft/rayfin-core';

/**
 * A live Q&A session. Everyone signed in can read sessions (attendees join by code).
 * Only the host (claims.sub == hostSub) can create, update or delete a session row, and a session is always
 * created open. The host can never be reassigned and the join code never changes after creation.
 * Who may host at all (Person.isAdmin) is enforced in src/domain/sessions.ts: the policy DSL has no admin claim.
 */
@entity()
@role('authenticated', 'read')
@role('authenticated', 'create', {
  policy: (claims, item) => claims.sub.eq(item.hostSub).and(item.status.eq('open')),
  exclude: ['closedAt'],
})
@role('authenticated', 'update', {
  policy: (claims, item) => claims.sub.eq(item.hostSub),
  exclude: ['hostSub', 'code', 'createdAt'],
})
@role('authenticated', 'delete', {
  policy: (claims, item) => claims.sub.eq(item.hostSub),
})
export class QaSession {
  @uuid() id!: string;
  @text({ min: 3, max: 100 }) title!: string;
  @text({ min: 6, max: 6, unique: true }) code!: string;
  @text({ min: 1, max: 255 }) hostSub!: string;
  @text({ min: 1, max: 100 }) hostName!: string;
  @set('open', 'closed') status!: 'open' | 'closed';
  @boolean() allowAnonymous!: boolean;
  @date() createdAt!: Date;
  @date({ optional: true }) closedAt?: Date;
}
