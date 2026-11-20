import { date, entity, role, text, uuid } from '@microsoft/rayfin-core';

/**
 * One upvote by one person on one question. The score is the count of distinct voters, computed on read.
 * A user can only create or delete their own votes (claims.sub == voterSub); votes are never updated.
 * "One per user per question" is checked in src/domain before insert, and scoring de-duplicates by voter, so a
 * double click or a forged duplicate row can never count twice.
 */
@entity()
@role('authenticated', 'read')
@role('authenticated', ['create', 'delete'], {
  policy: (claims, item) => claims.sub.eq(item.voterSub),
})
export class Upvote {
  @uuid() id!: string;
  @uuid() questionId!: string;
  @uuid() sessionId!: string;
  @text({ min: 1, max: 255 }) voterSub!: string;
  @date() createdAt!: Date;
}
