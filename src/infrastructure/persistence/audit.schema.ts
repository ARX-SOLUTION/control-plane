import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  inet,
} from 'drizzle-orm/pg-core';

export const auditEvents = pgTable('audit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorUserId: uuid('actor_user_id'),
  action: text('action').notNull(), // e.g. 'secret.reveal', 'project.delete'
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  ip: inet('ip'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
