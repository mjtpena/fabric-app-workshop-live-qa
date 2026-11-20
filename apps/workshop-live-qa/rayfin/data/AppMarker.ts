import { date, entity, role, text, uuid } from '@microsoft/rayfin-core';

/** Marker rows written by the seed script so it is idempotent. Read-only for app users; seeding uses SQL. */
@entity()
@role('authenticated', 'read')
export class AppMarker {
  @uuid() id!: string;
  @text({ min: 1, max: 60 }) key!: string;
  @date() createdAt!: Date;
}
