import { boolean, date, entity, role, set, text, uuid } from '@microsoft/rayfin-core';

/**
 * A question in a session. `hostSub` is the session host's sub, denormalised from QaSession so row policies can
 * name the host without a join.
 * - create: only as yourself (authorSub), never as the host of the row (so an attendee cannot make themselves the
 *   "host" of their own question), always status 'new' and unpinned, never pre-answered.
 * - update: only the host (status, pin, answeredAt and text). Author, host, session and anonymity are fixed.
 *   Attendees do not update rows: they withdraw (delete) and ask again.
 * - delete: the author or the host.
 * Read is open to every signed-in user, so hidden questions and the real author of anonymous questions are readable
 * through the API (see README, Known limits). The 5-question limit and "closed session is read-only" are domain rules.
 */
@entity()
@role('authenticated', 'read')
@role('authenticated', 'create', {
  policy: (claims, item) =>
    claims.sub.eq(item.authorSub)
      .and(claims.sub.neq(item.hostSub))
      .and(item.status.eq('new'))
      .and(item.isPinned.eq(false)),
  exclude: ['answeredAt'],
})
@role('authenticated', 'update', {
  policy: (claims, item) => claims.sub.eq(item.hostSub),
  exclude: ['sessionId', 'authorSub', 'authorName', 'isAnonymous', 'hostSub', 'createdAt'],
})
@role('authenticated', 'delete', {
  policy: (claims, item) => claims.sub.eq(item.authorSub).or(claims.sub.eq(item.hostSub)),
})
export class Question {
  @uuid() id!: string;
  @uuid() sessionId!: string;
  @text({ min: 3, max: 280 }) text!: string;
  @text({ min: 1, max: 255 }) authorSub!: string;
  @text({ min: 1, max: 100 }) authorName!: string;
  @boolean() isAnonymous!: boolean;
  @boolean() isPinned!: boolean;
  @set('new', 'answered', 'parked', 'hidden') status!: 'new' | 'answered' | 'parked' | 'hidden';
  @text({ min: 1, max: 255 }) hostSub!: string;
  @date() createdAt!: Date;
  @date({ optional: true }) answeredAt?: Date;
}
