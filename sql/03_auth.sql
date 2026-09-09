-- =====================================================================
-- OrShuk · Migracion de autenticacion (Semana 2)
-- Ejecutar DESPUES de 01_schema.sql y 02_seed.sql
-- =====================================================================

-- 1. Slug del tenant: identificador legible para subdominios futuros
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS slug VARCHAR(60);
UPDATE tenants SET slug = 'la-esquina' WHERE slug IS NULL;
ALTER TABLE tenants ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_slug ON tenants(slug);

-- 2. Tokens de refresco. Se guarda solo el hash, nunca el token.
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL,
    user_agent  VARCHAR(255),
    ip_address  VARCHAR(45),
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rt_user   ON refresh_tokens(user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rt_expiry ON refresh_tokens(expires_at);

-- 3. Bitacora de intentos de acceso. Sirve para bloquear fuerza bruta.
CREATE TABLE IF NOT EXISTS login_attempts (
    id          BIGSERIAL PRIMARY KEY,
    email       CITEXT NOT NULL,
    tenant_slug VARCHAR(60),
    ip_address  VARCHAR(45),
    successful  BOOLEAN NOT NULL DEFAULT FALSE,
    reason      VARCHAR(60),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_la_email ON login_attempts(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_la_ip    ON login_attempts(ip_address, created_at DESC);

-- 4. Reemplazo del hash de prueba por Argon2id.
--    Contrasena: orshuk123
--    Parametros: m=64MiB, t=3, p=1  (perfil OWASP 2024)
UPDATE users
SET password_hash = '$argon2id$v=19$m=65536,t=3,p=1$N8gJqVqZLsHV1dngfjYmEA$V9kxz3ivUmCqw24iWo2E3yN2eCms7Dn7i53z1EdZGZg'
WHERE email = 'admin@laesquina.sv';

-- 5. Segundo tenant para probar el aislamiento multi-tenant.
INSERT INTO tenants (id, name, legal_name, slug, plan)
VALUES ('55555555-5555-5555-5555-555555555555',
        'Ferreteria El Tornillo', 'Ferreteria El Tornillo S.A. de C.V.',
        'el-tornillo', 'basico')
ON CONFLICT (id) DO NOTHING;

INSERT INTO branches (id, tenant_id, code, name, address, is_main)
VALUES ('66666666-6666-6666-6666-666666666666',
        '55555555-5555-5555-5555-555555555555',
        'SUC01', 'Sucursal Unica', 'Santa Ana, El Salvador', TRUE)
ON CONFLICT (tenant_id, code) DO NOTHING;

-- Contrasena: orshuk123  (mismo hash, distinto tenant)
INSERT INTO users (id, tenant_id, branch_id, email, password_hash, full_name, role)
VALUES ('77777777-7777-7777-7777-777777777777',
        '55555555-5555-5555-5555-555555555555',
        '66666666-6666-6666-6666-666666666666',
        'admin@eltornillo.sv',
        '$argon2id$v=19$m=65536,t=3,p=1$N8gJqVqZLsHV1dngfjYmEA$V9kxz3ivUmCqw24iWo2E3yN2eCms7Dn7i53z1EdZGZg',
        'Administrador Tornillo', 'owner')
ON CONFLICT (tenant_id, email) DO NOTHING;

INSERT INTO categories (id, tenant_id, name) VALUES
 ('88888888-0000-0000-0000-000000000001','55555555-5555-5555-5555-555555555555','Herramientas')
ON CONFLICT (tenant_id, name) DO NOTHING;

INSERT INTO products (tenant_id, category_id, sku, barcode, name, unit, cost_price, sale_price, min_stock) VALUES
 ('55555555-5555-5555-5555-555555555555','88888888-0000-0000-0000-000000000001','HER-001','7501111000011','Martillo 16oz','unidad',4.50,8.00,5),
 ('55555555-5555-5555-5555-555555555555','88888888-0000-0000-0000-000000000001','HER-002','7501111000028','Desarmador Phillips','unidad',1.20,2.50,10)
ON CONFLICT (tenant_id, sku) DO NOTHING;

INSERT INTO stock (tenant_id, product_id, branch_id, quantity)
SELECT p.tenant_id, p.id, '66666666-6666-6666-6666-666666666666', 25
FROM products p WHERE p.tenant_id = '55555555-5555-5555-5555-555555555555'
ON CONFLICT (product_id, branch_id) DO NOTHING;

-- Verificacion
SELECT t.slug, t.name, COUNT(p.id) AS productos
FROM tenants t LEFT JOIN products p ON p.tenant_id = t.id
GROUP BY t.slug, t.name ORDER BY t.slug;
