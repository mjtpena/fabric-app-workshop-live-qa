import { date, entity, role, text, uuid } from '@microsoft/rayfin-core';

/** Example entity (replace it): everyone reads, authors create and edit only their own rows. */
@entity()
@role('authenticated', 'read')
@role('authenticated', ['create', 'update', 'delete'], {
  policy: (claims, item) => claims.sub.eq(item.authorSub),
})
export class Note {
  @uuid() id!: string;
  @text({ min: 3, max: 120 }) title!: string;
  @text({ min: 1, max: 255 }) authorSub!: string;
  @text({ min: 1, max: 100 }) authorName!: string;
  @date() createdAt!: Date;
}
