// ============================================================
// apps/api/src/database/schema/productos.schema.ts
// ============================================================
// Espejo en TypeScript de la migracion 04. Drizzle no crea las
// tablas aqui (eso lo hace el SQL); este archivo le da tipos al
// codigo y permite escribir consultas con autocompletado.
// ============================================================

import {
  pgTable, uuid, varchar, text, boolean, integer,
  numeric, timestamp, bigserial, index, uniqueIndex, primaryKey,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { tenants, branches, users } from './auth.schema';

// ------------------------------------------------------------
// Unidades de medida
// ------------------------------------------------------------
export const units = pgTable('units', {
  code: varchar('code', { length: 12 }).primaryKey(),
  name: varchar('name', { length: 40 }).notNull(),
  allowDecimal: boolean('allow_decimal').notNull().default(false),
});

// ------------------------------------------------------------
// Categorias
// ------------------------------------------------------------
export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 80 }).notNull(),
    slug: varchar('slug', { length: 80 }).notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('categories_tenant_slug_uq').on(t.tenantId, t.slug),
    index('categories_tenant_idx').on(t.tenantId),
  ],
);

// ------------------------------------------------------------
// Productos
// ------------------------------------------------------------
// IMPORTANTE: los campos de dinero usan `numeric`, que Drizzle
// devuelve como STRING para no perder precision. Nunca los pases
// por parseFloat en calculos de dinero; usa una libreria decimal
// o hace la aritmetica en SQL.
export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),

    sku: varchar('sku', { length: 40 }).notNull(),
    barcode: varchar('barcode', { length: 64 }),
    name: varchar('name', { length: 160 }).notNull(),
    description: text('description'),

    unitCode: varchar('unit_code', { length: 12 })
      .notNull().default('UNIDAD').references(() => units.code),

    costPrice: numeric('cost_price', { precision: 12, scale: 4 }).notNull().default('0'),
    salePrice: numeric('sale_price', { precision: 12, scale: 4 }).notNull(),
    taxRate: numeric('tax_rate', { precision: 5, scale: 4 }).notNull().default('0.13'),
    priceIncludesTax: boolean('price_includes_tax').notNull().default(true),

    trackStock: boolean('track_stock').notNull().default(true),
    minStock: numeric('min_stock', { precision: 14, scale: 3 }).notNull().default('0'),
    allowNegative: boolean('allow_negative').notNull().default(false),

    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('products_tenant_sku_uq').on(t.tenantId, t.sku),
    index('products_tenant_active_idx').on(t.tenantId, t.isActive),
    index('products_tenant_category_idx').on(t.tenantId, t.categoryId),
  ],
);

// ------------------------------------------------------------
// Saldos de inventario
// ------------------------------------------------------------
export const stockBalances = pgTable(
  'stock_balances',
  {
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id').notNull().references(() => branches.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
    quantity: numeric('quantity', { precision: 14, scale: 3 }).notNull().default('0'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.branchId, t.productId] }),
    index('stock_balances_tenant_idx').on(t.tenantId, t.productId),
  ],
);

// ------------------------------------------------------------
// Libro mayor de movimientos
// ------------------------------------------------------------
export const MOVEMENT_TYPES = [
  'COMPRA', 'VENTA', 'DEVOLUCION_CLIENTE', 'DEVOLUCION_PROVEEDOR',
  'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'TRASLADO_ENTRADA',
  'TRASLADO_SALIDA', 'MERMA', 'INVENTARIO_INICIAL',
] as const;

export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const stockMovements = pgTable(
  'stock_movements',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id').notNull().references(() => branches.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'restrict' }),

    movementType: varchar('movement_type', { length: 24 }).notNull().$type<MovementType>(),
    quantityDelta: numeric('quantity_delta', { precision: 14, scale: 3 }).notNull(),
    balanceAfter: numeric('balance_after', { precision: 14, scale: 3 }).notNull(),
    unitCost: numeric('unit_cost', { precision: 12, scale: 4 }),

    referenceType: varchar('reference_type', { length: 24 }),
    referenceId: uuid('reference_id'),
    reason: text('reason'),

    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('stock_movements_lookup_idx').on(t.branchId, t.productId, t.occurredAt),
    index('stock_movements_tenant_date_idx').on(t.tenantId, t.occurredAt),
  ],
);

// ------------------------------------------------------------
// Relaciones
// ------------------------------------------------------------
export const categoriesRelations = relations(categories, ({ one, many }) => ({
  tenant: one(tenants, { fields: [categories.tenantId], references: [tenants.id] }),
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  tenant: one(tenants, { fields: [products.tenantId], references: [tenants.id] }),
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  unit: one(units, { fields: [products.unitCode], references: [units.code] }),
  balances: many(stockBalances),
  movements: many(stockMovements),
}));

export const stockBalancesRelations = relations(stockBalances, ({ one }) => ({
  product: one(products, { fields: [stockBalances.productId], references: [products.id] }),
  branch: one(branches, { fields: [stockBalances.branchId], references: [branches.id] }),
}));

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  product: one(products, { fields: [stockMovements.productId], references: [products.id] }),
  branch: one(branches, { fields: [stockMovements.branchId], references: [branches.id] }),
  user: one(users, { fields: [stockMovements.userId], references: [users.id] }),
}));

// ------------------------------------------------------------
// Tipos inferidos
// ------------------------------------------------------------
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type StockBalance = typeof stockBalances.$inferSelect;
export type StockMovement = typeof stockMovements.$inferSelect;
