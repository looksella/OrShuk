// Va en: apps/api/src/database/schema/products.ts
// RENOMBRA este archivo a: products.ts
import { pgTable, uuid, varchar, text, numeric, boolean, timestamp, unique, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenants';

export const products = pgTable('products', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  categoryId:  uuid('category_id'),
  sku:         varchar('sku', { length: 60 }).notNull(),
  barcode:     varchar('barcode', { length: 60 }),
  name:        varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  unit:        varchar('unit', { length: 20 }).notNull().default('unidad'),
  costPrice:   numeric('cost_price', { precision: 12, scale: 4 }).notNull().default('0'),
  salePrice:   numeric('sale_price', { precision: 12, scale: 4 }).notNull().default('0'),
  taxRate:     numeric('tax_rate',   { precision: 5,  scale: 4 }).notNull().default('0.13'),
  minStock:    numeric('min_stock',  { precision: 12, scale: 3 }).notNull().default('0'),
  trackStock:  boolean('track_stock').notNull().default(true),
  isService:   boolean('is_service').notNull().default(false),
  isActive:    boolean('is_active').notNull().default(true),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uqSku:      unique('uq_product_sku').on(t.tenantId, t.sku),
  idxTenant:  index('idx_products_tenant').on(t.tenantId),
}));

export const productsRelations = relations(products, ({ one }) => ({
  tenant: one(tenants, { fields: [products.tenantId], references: [tenants.id] }),
}));

export type Product    = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
