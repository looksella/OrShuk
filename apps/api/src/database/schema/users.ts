// apps/api/src/database/schema/users.ts
import { pgTable, pgEnum, uuid, varchar, text, boolean, timestamp, unique, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenants';
import { branches } from './branches';

export const userRole = pgEnum('user_role', ['owner', 'admin', 'manager', 'cashier']);

export const users = pgTable('users', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  branchId:     uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
  email:        varchar('email', { length: 255 }).notNull(),
  passwordHash: text('password_hash').notNull(),
  fullName:     varchar('full_name', { length: 160 }).notNull(),
  role:         userRole('role').notNull().default('cashier'),
  pin:          varchar('pin', { length: 255 }),
  isActive:     boolean('is_active').notNull().default(true),
  lastLoginAt:  timestamp('last_login_at', { withTimezone: true }),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uqEmail:   unique('uq_user_email').on(t.tenantId, t.email),
  idxTenant: index('idx_users_tenant').on(t.tenantId),
}));

export const usersRelations = relations(users, ({ one }) => ({
  tenant: one(tenants,  { fields: [users.tenantId], references: [tenants.id] }),
  branch: one(branches, { fields: [users.branchId], references: [branches.id] }),
}));

export type User    = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserRole = (typeof userRole.enumValues)[number];
