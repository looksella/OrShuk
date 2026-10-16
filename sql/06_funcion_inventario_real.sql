-- ============================================================
-- OrShuk · Migracion 06 · Funcion transaccional de inventario
-- Adaptada al esquema REAL que ya existe en la base:
--   products (unit varchar, sin unit_code)
--   stock (product_id, branch_id, quantity)
--   inventory_movements (type, quantity, balance_after, unit_cost,
--                          reference_type, reference_id, notes)
-- NO crea tablas nuevas. Solo agrega la funcion transaccional
-- y el blindaje del libro mayor.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Blindaje del libro mayor: nadie puede editar ni borrar
--    un movimiento ya registrado. Las correcciones se hacen
--    con un movimiento nuevo, nunca editando uno viejo.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_inventory_movements_solo_insercion()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'El libro de movimientos de inventario es de solo lectura una vez escrito. Use un movimiento de ajuste para corregir.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inventory_movements_no_update ON inventory_movements;
CREATE TRIGGER trg_inventory_movements_no_update
  BEFORE UPDATE OR DELETE ON inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION fn_inventory_movements_solo_insercion();

-- ------------------------------------------------------------
-- 2. Funcion transaccional: mueve stock y registra el
--    movimiento en una sola operacion atomica, bloqueando la
--    fila de stock para evitar condiciones de carrera entre
--    dos ventas simultaneas del mismo producto.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_mover_stock(
  p_tenant_id       uuid,
  p_product_id      uuid,
  p_branch_id       uuid,
  p_type            movement_type,
  p_quantity_delta  numeric,      -- positivo = entrada, negativo = salida
  p_unit_cost       numeric DEFAULT NULL,
  p_user_id         uuid DEFAULT NULL,
  p_reference_type  varchar DEFAULT NULL,
  p_reference_id    uuid DEFAULT NULL,
  p_notes           text DEFAULT NULL,
  p_allow_negative  boolean DEFAULT false
)
RETURNS TABLE (movement_id bigint, new_balance numeric) AS $$
DECLARE
  v_saldo_actual   numeric;
  v_nuevo_saldo    numeric;
  v_nombre_producto varchar;
  v_movimiento_id  bigint;
BEGIN
  IF p_quantity_delta = 0 THEN
    RAISE EXCEPTION 'La cantidad del movimiento no puede ser cero';
  END IF;

  -- Crea la fila de stock si el producto nunca ha tenido
  -- movimientos en esa sucursal.
  INSERT INTO stock (tenant_id, product_id, branch_id, quantity)
  VALUES (p_tenant_id, p_product_id, p_branch_id, 0)
  ON CONFLICT (product_id, branch_id) DO NOTHING;

  -- Bloquea la fila de stock: cualquier otra venta del mismo
  -- producto en la misma sucursal espera aqui hasta que esta
  -- transaccion termine.
  SELECT quantity INTO v_saldo_actual
  FROM stock
  WHERE product_id = p_product_id AND branch_id = p_branch_id
  FOR UPDATE;

  v_nuevo_saldo := v_saldo_actual + p_quantity_delta;

  IF v_nuevo_saldo < 0 AND NOT p_allow_negative THEN
    SELECT name INTO v_nombre_producto FROM products WHERE id = p_product_id;
    RAISE EXCEPTION
      'Stock insuficiente de %: disponible %, solicitado %',
      COALESCE(v_nombre_producto, p_product_id::text),
      v_saldo_actual,
      abs(p_quantity_delta);
  END IF;

  UPDATE stock
  SET quantity = v_nuevo_saldo, updated_at = now()
  WHERE product_id = p_product_id AND branch_id = p_branch_id;

  INSERT INTO inventory_movements (
    tenant_id, product_id, branch_id, user_id, type,
    quantity, balance_after, unit_cost,
    reference_type, reference_id, notes
  )
  VALUES (
    p_tenant_id, p_product_id, p_branch_id, p_user_id, p_type,
    p_quantity_delta, v_nuevo_saldo, p_unit_cost,
    p_reference_type, p_reference_id, p_notes
  )
  RETURNING id INTO v_movimiento_id;

  RETURN QUERY SELECT v_movimiento_id, v_nuevo_saldo;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- 3. Funcion de reconciliacion: compara el saldo cacheado en
--    "stock" contra la suma real del libro "inventory_movements".
--    Debe devolver 0 filas si todo cuadra.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_reconciliar_stock(p_tenant_id uuid)
RETURNS TABLE (
  product_id uuid,
  branch_id uuid,
  saldo_cacheado numeric,
  saldo_calculado numeric,
  diferencia numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.product_id,
    s.branch_id,
    s.quantity AS saldo_cacheado,
    COALESCE(SUM(m.quantity), 0) AS saldo_calculado,
    s.quantity - COALESCE(SUM(m.quantity), 0) AS diferencia
  FROM stock s
  LEFT JOIN inventory_movements m
    ON m.product_id = s.product_id AND m.branch_id = s.branch_id
  WHERE s.tenant_id = p_tenant_id
  GROUP BY s.product_id, s.branch_id, s.quantity
  HAVING s.quantity - COALESCE(SUM(m.quantity), 0) != 0;
END;
$$ LANGUAGE plpgsql;

COMMIT;

\echo ''
\echo '=== Migracion 06 aplicada: funcion transaccional adaptada al esquema real ==='
