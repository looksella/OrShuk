-- ============================================================
-- OrShuk · Migracion 04 · Modulo de Productos e Inventario
-- ============================================================
-- Ejecutar:
--   docker compose exec -T postgres psql -U orshuk -d orshuk_dev -q < sql\04_productos.sql
--
-- Este archivo es idempotente: se puede correr varias veces sin romper nada.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Extension para busqueda difusa por nombre
-- ------------------------------------------------------------
-- pg_trgm permite que "ILIKE '%coca%'" use indice en lugar de
-- recorrer toda la tabla. Sin esto, la busqueda del POS se
-- vuelve lenta cuando el catalogo pasa de unos miles de filas.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ------------------------------------------------------------
-- 2. Categorias
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         VARCHAR(80)  NOT NULL,
  slug         VARCHAR(80)  NOT NULL,
  sort_order   INTEGER      NOT NULL DEFAULT 0,
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT categories_tenant_slug_uq UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS categories_tenant_idx
  ON categories (tenant_id) WHERE is_active;

-- ------------------------------------------------------------
-- 3. Unidades de medida
-- ------------------------------------------------------------
-- Catalogo global (no por tenant) para simplificar. El POS
-- necesita saber si un producto se vende por pieza o por peso.
CREATE TABLE IF NOT EXISTS units (
  code          VARCHAR(12) PRIMARY KEY,
  name          VARCHAR(40) NOT NULL,
  allow_decimal BOOLEAN     NOT NULL DEFAULT FALSE
);

INSERT INTO units (code, name, allow_decimal) VALUES
  ('UNIDAD', 'Unidad',    FALSE),
  ('LIBRA',  'Libra',     TRUE),
  ('KILO',   'Kilogramo', TRUE),
  ('LITRO',  'Litro',     TRUE),
  ('CAJA',   'Caja',      FALSE),
  ('FARDO',  'Fardo',     FALSE),
  ('QUINTAL','Quintal',   TRUE)
ON CONFLICT (code) DO NOTHING;

-- ------------------------------------------------------------
-- 4. Productos
-- ------------------------------------------------------------
-- Nota sobre dinero: se usa NUMERIC(12,4), nunca FLOAT.
-- NUMERIC es exacto; los tipos de punto flotante acumulan
-- error de redondeo y en dinero eso es inaceptable.
-- 4 decimales permiten precios de costo con fracciones de centavo.
CREATE TABLE IF NOT EXISTS products (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id    UUID REFERENCES categories(id) ON DELETE SET NULL,

  sku            VARCHAR(40)  NOT NULL,
  barcode        VARCHAR(64),
  name           VARCHAR(160) NOT NULL,
  description    TEXT,

  unit_code      VARCHAR(12)  NOT NULL DEFAULT 'UNIDAD'
                              REFERENCES units(code),

  cost_price     NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (cost_price  >= 0),
  sale_price     NUMERIC(12,4) NOT NULL           CHECK (sale_price  >= 0),
  tax_rate       NUMERIC(5,4)  NOT NULL DEFAULT 0.13 CHECK (tax_rate >= 0 AND tax_rate <= 1),
  price_includes_tax BOOLEAN   NOT NULL DEFAULT TRUE,

  track_stock    BOOLEAN      NOT NULL DEFAULT TRUE,
  min_stock      NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  allow_negative BOOLEAN      NOT NULL DEFAULT FALSE,

  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT products_tenant_sku_uq UNIQUE (tenant_id, sku)
);

-- Un mismo codigo de barras no puede repetirse dentro de un tenant,
-- pero si puede ser NULL en muchos productos (granel, servicios).
CREATE UNIQUE INDEX IF NOT EXISTS products_tenant_barcode_uq
  ON products (tenant_id, barcode) WHERE barcode IS NOT NULL;

-- Indice trigram: acelera ILIKE '%texto%' incluso con comodin inicial,
-- algo que un B-tree normal no puede hacer.
CREATE INDEX IF NOT EXISTS products_name_trgm_idx
  ON products USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS products_tenant_active_idx
  ON products (tenant_id, is_active);

CREATE INDEX IF NOT EXISTS products_tenant_category_idx
  ON products (tenant_id, category_id);

-- ------------------------------------------------------------
-- 5. Saldos de inventario (cache de lectura rapida)
-- ------------------------------------------------------------
-- Una fila por producto y sucursal. Esta es la fila que se
-- bloquea durante una venta para evitar condiciones de carrera.
CREATE TABLE IF NOT EXISTS stock_balances (
  tenant_id   UUID NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
  branch_id   UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity    NUMERIC(14,3) NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  PRIMARY KEY (branch_id, product_id)
);

CREATE INDEX IF NOT EXISTS stock_balances_tenant_idx
  ON stock_balances (tenant_id, product_id);

-- ------------------------------------------------------------
-- 6. Libro mayor de movimientos (append-only)
-- ------------------------------------------------------------
-- Principio: cada entrada, salida, venta, devolucion y ajuste
-- es un movimiento inmutable. El saldo es un cache; el libro
-- es la verdad. Si ambos discrepan, se reconstruye el saldo.
CREATE TABLE IF NOT EXISTS stock_movements (
  id              BIGSERIAL PRIMARY KEY,
  tenant_id       UUID NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
  branch_id       UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,

  movement_type   VARCHAR(24) NOT NULL,
  quantity_delta  NUMERIC(14,3) NOT NULL CHECK (quantity_delta <> 0),
  balance_after   NUMERIC(14,3) NOT NULL,
  unit_cost       NUMERIC(12,4),

  reference_type  VARCHAR(24),
  reference_id    UUID,
  reason          TEXT,

  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT stock_movements_type_chk CHECK (
    movement_type IN (
      'COMPRA', 'VENTA', 'DEVOLUCION_CLIENTE', 'DEVOLUCION_PROVEEDOR',
      'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'TRASLADO_ENTRADA',
      'TRASLADO_SALIDA', 'MERMA', 'INVENTARIO_INICIAL'
    )
  )
);

CREATE INDEX IF NOT EXISTS stock_movements_lookup_idx
  ON stock_movements (branch_id, product_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS stock_movements_tenant_date_idx
  ON stock_movements (tenant_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS stock_movements_reference_idx
  ON stock_movements (reference_type, reference_id)
  WHERE reference_id IS NOT NULL;

-- ------------------------------------------------------------
-- 7. Blindaje del libro mayor
-- ------------------------------------------------------------
-- La disciplina no sobrevive al primer script de mantenimiento.
-- Un trigger que rechaza UPDATE y DELETE convierte la regla en
-- garantia de base de datos. Las correcciones son movimientos
-- compensatorios, no ediciones.
CREATE OR REPLACE FUNCTION fn_stock_movements_solo_insercion()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'stock_movements es de solo insercion. Para corregir, registre un movimiento de ajuste.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stock_movements_no_update ON stock_movements;
CREATE TRIGGER trg_stock_movements_no_update
  BEFORE UPDATE OR DELETE ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION fn_stock_movements_solo_insercion();

-- ------------------------------------------------------------
-- 8. Funcion transaccional de movimiento de stock
-- ------------------------------------------------------------
-- Toda la logica critica vive aqui, en una sola transaccion:
--   1. Bloquea la fila de saldo (FOR UPDATE) -> sin carreras
--   2. Valida que no quede negativo (si el producto no lo permite)
--   3. Actualiza el saldo
--   4. Inserta el movimiento con el saldo resultante estampado
--
-- El estampado de balance_after hace que la reconciliacion sea
-- una verificacion real y no una tautologia.
CREATE OR REPLACE FUNCTION fn_mover_stock(
  p_tenant_id      UUID,
  p_branch_id      UUID,
  p_product_id     UUID,
  p_movement_type  VARCHAR(24),
  p_quantity_delta NUMERIC(14,3),
  p_unit_cost      NUMERIC(12,4) DEFAULT NULL,
  p_reference_type VARCHAR(24)   DEFAULT NULL,
  p_reference_id   UUID          DEFAULT NULL,
  p_reason         TEXT          DEFAULT NULL,
  p_user_id        UUID          DEFAULT NULL
) RETURNS NUMERIC(14,3) AS $$
DECLARE
  v_saldo_actual   NUMERIC(14,3);
  v_saldo_nuevo    NUMERIC(14,3);
  v_permite_neg    BOOLEAN;
  v_controla_stock BOOLEAN;
  v_nombre         VARCHAR(160);
BEGIN
  IF p_quantity_delta = 0 THEN
    RAISE EXCEPTION 'La cantidad del movimiento no puede ser cero';
  END IF;

  SELECT allow_negative, track_stock, name
    INTO v_permite_neg, v_controla_stock, v_nombre
  FROM products
  WHERE id = p_product_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto no encontrado en esta empresa';
  END IF;

  IF NOT v_controla_stock THEN
    RETURN 0;
  END IF;

  -- Crea la fila de saldo si no existe todavia
  INSERT INTO stock_balances (tenant_id, branch_id, product_id, quantity)
  VALUES (p_tenant_id, p_branch_id, p_product_id, 0)
  ON CONFLICT (branch_id, product_id) DO NOTHING;

  -- Bloqueo de fila: cualquier otra venta del mismo producto espera aqui
  SELECT quantity INTO v_saldo_actual
  FROM stock_balances
  WHERE branch_id = p_branch_id AND product_id = p_product_id
  FOR UPDATE;

  v_saldo_nuevo := v_saldo_actual + p_quantity_delta;

  IF v_saldo_nuevo < 0 AND NOT v_permite_neg THEN
    RAISE EXCEPTION
      'Stock insuficiente de "%": disponible %, solicitado %',
      v_nombre, v_saldo_actual, ABS(p_quantity_delta);
  END IF;

  UPDATE stock_balances
     SET quantity = v_saldo_nuevo, updated_at = NOW()
   WHERE branch_id = p_branch_id AND product_id = p_product_id;

  INSERT INTO stock_movements (
    tenant_id, branch_id, product_id, movement_type,
    quantity_delta, balance_after, unit_cost,
    reference_type, reference_id, reason, user_id
  ) VALUES (
    p_tenant_id, p_branch_id, p_product_id, p_movement_type,
    p_quantity_delta, v_saldo_nuevo, p_unit_cost,
    p_reference_type, p_reference_id, p_reason, p_user_id
  );

  RETURN v_saldo_nuevo;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- 9. Funcion de reconciliacion
-- ------------------------------------------------------------
-- Reconstruye el cache de saldos desde el libro mayor.
-- Si el saldo y el libro discrepan, el libro gana.
CREATE OR REPLACE FUNCTION fn_reconciliar_stock(p_tenant_id UUID)
RETURNS TABLE (
  producto     VARCHAR(160),
  sucursal     VARCHAR(120),
  saldo_cache  NUMERIC(14,3),
  saldo_libro  NUMERIC(14,3),
  diferencia   NUMERIC(14,3)
) AS $$
BEGIN
  RETURN QUERY
  SELECT p.name,
         b.name,
         COALESCE(sb.quantity, 0),
         COALESCE(SUM(sm.quantity_delta), 0),
         COALESCE(sb.quantity, 0) - COALESCE(SUM(sm.quantity_delta), 0)
  FROM products p
  JOIN branches b        ON b.tenant_id = p.tenant_id
  LEFT JOIN stock_balances sb
         ON sb.product_id = p.id AND sb.branch_id = b.id
  LEFT JOIN stock_movements sm
         ON sm.product_id = p.id AND sm.branch_id = b.id
  WHERE p.tenant_id = p_tenant_id AND p.track_stock
  GROUP BY p.name, b.name, sb.quantity
  HAVING COALESCE(sb.quantity, 0) <> COALESCE(SUM(sm.quantity_delta), 0);
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- 10. Vista de productos con stock
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW v_productos_stock AS
SELECT p.id,
       p.tenant_id,
       p.sku,
       p.barcode,
       p.name,
       c.name        AS categoria,
       p.unit_code,
       u.allow_decimal,
       p.cost_price,
       p.sale_price,
       p.tax_rate,
       p.min_stock,
       p.track_stock,
       p.is_active,
       sb.branch_id,
       COALESCE(sb.quantity, 0) AS stock,
       CASE
         WHEN NOT p.track_stock                        THEN 'NO_APLICA'
         WHEN COALESCE(sb.quantity, 0) <= 0            THEN 'AGOTADO'
         WHEN COALESCE(sb.quantity, 0) <= p.min_stock  THEN 'BAJO'
         ELSE 'OK'
       END AS estado_stock
FROM products p
LEFT JOIN categories c    ON c.id = p.category_id
LEFT JOIN units u         ON u.code = p.unit_code
LEFT JOIN stock_balances sb ON sb.product_id = p.id;

-- ------------------------------------------------------------
-- 11. Trigger de updated_at
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_touch ON products;
CREATE TRIGGER trg_products_touch
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

DROP TRIGGER IF EXISTS trg_categories_touch ON categories;
CREATE TRIGGER trg_categories_touch
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

COMMIT;

\echo '=== Migracion 04 aplicada: productos e inventario ==='
