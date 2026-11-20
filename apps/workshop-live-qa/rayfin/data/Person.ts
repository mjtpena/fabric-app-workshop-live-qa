import { boolean, date, entity, role, text, uuid } from '@microsoft/rayfin-core';

/**
 * Shared identity row, upserted on first load (see @x10/shared/identity).
 * Everyone signed in can read people (to show names). A user can create and update only their own row, and can never
 * set isAdmin or change sub: those fields are excluded from client writes. The deployer sets isAdmin with SQL.
 */
@entity()
@role('authenticated', 'read')
@role('authenticated', 'create', {
  policy: (claims, item) => claims.sub.eq(item.sub),
  exclude: ['isAdmin'],
})
@role('authenticated', 'update', {
  policy: (claims, item) => claims.sub.eq(item.sub),
  exclude: ['isAdmin', 'sub'],
})
export class Person {
  @uuid() id!: string;
  @text({ min: 1, max: 255 }) sub!: string;
  @text({ min: 1, max: 100 }) displayName!: string;
  @text({ max: 255, optional: true }) email?: string;
  @boolean({ optional: true }) isAdmin?: boolean;
  @date() createdAt!: Date;
}
