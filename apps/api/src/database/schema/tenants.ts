// apps/api/src/database/schema/tenants.ts
// REEMPLAZA el archivo que ya tienes: ahora incluye "slug".
import { pgTable, pgEnum, uuid, varchar, char, boolean, timestamp, unique } from 'drizzle-orm/pg-core';

export const planCode = pgEnum('plan_code', ['basico', 'intermedio', 'avanzado']);

export const tenants = pgTable('tenants', {
  id:        uuid('id').primaryKey().defaultRandom(),
  name:      varchar('name', { length: 160 }).notNull(),
  legalName: varchar('legal_name', { length: 200 }),
  taxId:     varchar('tax_id', { length: 30 }),
  ncr:       varchar('ncr', { length: 30 }),
  slug:      varchar('slug', { length: 60 }).notNull(),
  plan:      planCode('plan').notNull().default('basico'),
  currency:  char('currency', { length: 3 }).notNull().default('USD'),
  timezone:  varchar('timezone', { length: 60 }).notNull().default('America/El_Salvador'),
  isActive:  boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uqSlug: unique('uq_tenant_slug').on(t.slug),
}));

export type Tenant    = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
