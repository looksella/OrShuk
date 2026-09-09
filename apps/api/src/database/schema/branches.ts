// apps/api/src/database/schema/branches.ts
import { pgTable, uuid, varchar, text, boolean, timestamp, unique, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenants';

export const branches = pgTable('branches', {
  id:        uuid('id').primaryKey().defaultRandom(),
  tenantId:  uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  code:      varchar('code', { length: 20 }).notNull(),
  name:      varchar('name', { length: 120 }).notNull(),
  address:   text('address'),
  phone:     varchar('phone', { length: 30 }),
  isMain:    boolean('is_main').notNull().default(false),
  isActive:  boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uqCode:    unique('uq_branch_code').on(t.tenantId, t.code),
  idxTenant: index('idx_branches_tenant').on(t.tenantId),
}));

export const branchesRelations = relations(branches, ({ one }) => ({
  tenant: one(tenants, { fields: [branches.tenantId], references: [tenants.id] }),
}));

export type Branch    = typeof branches.$inferSelect;
export type NewBranch = typeof branches.$inferInsert;
