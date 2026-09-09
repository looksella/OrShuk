-- =====================================================================
-- OrShuk · Datos de prueba (tienda de conveniencia, Sonsonate)
-- =====================================================================

INSERT INTO tenants (id, name, legal_name, tax_id, plan)
VALUES ('11111111-1111-1111-1111-111111111111',
        'Tienda La Esquina', 'Tienda La Esquina S.A. de C.V.',
        '0614-123456-101-2', 'basico');

INSERT INTO branches (id, tenant_id, code, name, address, is_main)
VALUES ('22222222-2222-2222-2222-222222222222',
        '11111111-1111-1111-1111-111111111111',
        'SUC01', 'Sucursal Centro', 'Sonsonate, El Salvador', TRUE);

-- Contrasena: orshuk123
INSERT INTO users (id, tenant_id, branch_id, email, password_hash, full_name, role)
VALUES ('33333333-3333-3333-3333-333333333333',
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222',
        'admin@laesquina.sv',
        '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
        'Administrador', 'owner');

INSERT INTO categories (id, tenant_id, name) VALUES
 ('44444444-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Bebidas'),
 ('44444444-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Snacks'),
 ('44444444-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Abarrotes'),
 ('44444444-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','Limpieza');

INSERT INTO products (tenant_id, category_id, sku, barcode, name, unit, cost_price, sale_price, min_stock) VALUES
 ('11111111-1111-1111-1111-111111111111','44444444-0000-0000-0000-000000000001','BEB-001','7501055310241','Coca-Cola 600ml','unidad',0.55,0.90,24),
 ('11111111-1111-1111-1111-111111111111','44444444-0000-0000-0000-000000000001','BEB-002','7501055363513','Agua Cristal 600ml','unidad',0.25,0.50,24),
 ('11111111-1111-1111-1111-111111111111','44444444-0000-0000-0000-000000000002','SNK-001','7622210951755','Papas Diana 45g','unidad',0.40,0.75,20),
 ('11111111-1111-1111-1111-111111111111','44444444-0000-0000-0000-000000000002','SNK-002','7441029000112','Galletas Maria','unidad',0.60,1.00,12),
 ('11111111-1111-1111-1111-111111111111','44444444-0000-0000-0000-000000000003','ABA-001','7441001000019','Frijol rojo 1lb','libra',0.85,1.25,30),
 ('11111111-1111-1111-1111-111111111111','44444444-0000-0000-0000-000000000003','ABA-002','7441001000026','Arroz 1lb','libra',0.55,0.85,40),
 ('11111111-1111-1111-1111-111111111111','44444444-0000-0000-0000-000000000004','LIM-001','7501025403119','Jabon Axion 425g','unidad',1.10,1.75,10);

INSERT INTO stock (tenant_id, product_id, branch_id, quantity)
SELECT p.tenant_id, p.id, '22222222-2222-2222-2222-222222222222', 100
FROM products p WHERE p.tenant_id = '11111111-1111-1111-1111-111111111111';

INSERT INTO inventory_movements (tenant_id, product_id, branch_id, user_id, type, quantity, balance_after, unit_cost, notes)
SELECT p.tenant_id, p.id, '22222222-2222-2222-2222-222222222222',
       '33333333-3333-3333-3333-333333333333', 'initial', 100, 100, p.cost_price,
       'Carga inicial de inventario'
FROM products p WHERE p.tenant_id = '11111111-1111-1111-1111-111111111111';

SELECT 'Tablas creadas' AS chequeo, COUNT(*) AS total
FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';
SELECT 'Productos cargados' AS chequeo, COUNT(*) AS total FROM products;
SELECT 'Stock inicial' AS chequeo, SUM(quantity) AS total FROM stock;
