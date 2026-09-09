-- =====================================================================
-- OrShuk · Esquema MVP (Fase 1) · PostgreSQL 16+
-- 10 tablas. Multi-tenant por columna tenant_id.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE TYPE user_role      AS ENUM ('owner','admin','manager','cashier');
CREATE TYPE plan_code      AS ENUM ('basico','intermedio','avanzado');
CREATE TYPE movement_type  AS ENUM ('purchase','sale','adjustment','transfer_in','transfer_out','return_in','return_out','initial','waste');
CREATE TYPE sale_status    AS ENUM ('draft','completed','voided','refunded');
CREATE TYPE payment_method AS ENUM ('cash','card','transfer','credit','mixed');
CREATE TYPE session_status AS ENUM ('open','closed');

CREATE TABLE tenants (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(160) NOT NULL,
    legal_name  VARCHAR(200),
    tax_id      VARCHAR(30),
    ncr         VARCHAR(30),
    plan        plan_code NOT NULL DEFAULT 'basico',
    currency    CHAR(3) NOT NULL DEFAULT 'USD',
    timezone    VARCHAR(60) NOT NULL DEFAULT 'America/El_Salvador',
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE branches (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code        VARCHAR(20) NOT NULL,
    name        VARCHAR(120) NOT NULL,
    address     TEXT,
    phone       VARCHAR(30),
    is_main     BOOLEAN NOT NULL DEFAULT FALSE,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_branch_code UNIQUE (tenant_id, code)
);
CREATE INDEX idx_branches_tenant ON branches(tenant_id);

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id     UUID REFERENCES branches(id) ON DELETE SET NULL,
    email         CITEXT NOT NULL,
    password_hash TEXT NOT NULL,
    full_name     VARCHAR(160) NOT NULL,
    role          user_role NOT NULL DEFAULT 'cashier',
    pin           VARCHAR(255),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_email UNIQUE (tenant_id, email)
);
CREATE INDEX idx_users_tenant ON users(tenant_id);

CREATE TABLE categories (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    parent_id  UUID REFERENCES categories(id) ON DELETE SET NULL,
    name       VARCHAR(120) NOT NULL,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_category_name UNIQUE (tenant_id, name)
);
CREATE INDEX idx_categories_tenant ON categories(tenant_id);

CREATE TABLE products (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    sku         VARCHAR(60) NOT NULL,
    barcode     VARCHAR(60),
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    unit        VARCHAR(20) NOT NULL DEFAULT 'unidad',
    cost_price  NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
    sale_price  NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (sale_price >= 0),
    tax_rate    NUMERIC(5,4)  NOT NULL DEFAULT 0.13 CHECK (tax_rate >= 0),
    min_stock   NUMERIC(12,3) NOT NULL DEFAULT 0,
    max_stock   NUMERIC(12,3),
    track_stock BOOLEAN NOT NULL DEFAULT TRUE,
    is_service  BOOLEAN NOT NULL DEFAULT FALSE,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_product_sku UNIQUE (tenant_id, sku)
);
CREATE INDEX idx_products_tenant    ON products(tenant_id);
CREATE INDEX idx_products_barcode   ON products(tenant_id, barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_products_name_trgm ON products USING gin (name gin_trgm_ops);

CREATE TABLE stock (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    branch_id  UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    quantity   NUMERIC(12,3) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_stock UNIQUE (product_id, branch_id)
);
CREATE INDEX idx_stock_tenant ON stock(tenant_id);
CREATE INDEX idx_stock_low    ON stock(tenant_id, branch_id, quantity);

CREATE TABLE inventory_movements (
    id             BIGSERIAL PRIMARY KEY,
    tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id     UUID NOT NULL REFERENCES products(id),
    branch_id      UUID NOT NULL REFERENCES branches(id),
    user_id        UUID REFERENCES users(id),
    type           movement_type NOT NULL,
    quantity       NUMERIC(12,3) NOT NULL,
    balance_after  NUMERIC(12,3) NOT NULL,
    unit_cost      NUMERIC(12,4),
    reference_type VARCHAR(40),
    reference_id   UUID,
    notes          TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_mov_tenant_date ON inventory_movements(tenant_id, created_at DESC);
CREATE INDEX idx_mov_product     ON inventory_movements(product_id, created_at DESC);
CREATE INDEX idx_mov_reference   ON inventory_movements(reference_type, reference_id);

CREATE TABLE cash_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id       UUID NOT NULL REFERENCES branches(id),
    user_id         UUID NOT NULL REFERENCES users(id),
    opened_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at       TIMESTAMPTZ,
    opening_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
    closing_amount  NUMERIC(12,2),
    expected_amount NUMERIC(12,2),
    difference      NUMERIC(12,2),
    status          session_status NOT NULL DEFAULT 'open',
    notes           TEXT
);
CREATE INDEX idx_sessions_tenant ON cash_sessions(tenant_id, status);
CREATE UNIQUE INDEX uq_one_open_session ON cash_sessions(branch_id, user_id) WHERE status = 'open';

CREATE TABLE sales (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id       UUID NOT NULL REFERENCES branches(id),
    cash_session_id UUID REFERENCES cash_sessions(id),
    user_id         UUID NOT NULL REFERENCES users(id),
    customer_id     UUID,
    invoice_number  VARCHAR(40) NOT NULL,
    status          sale_status NOT NULL DEFAULT 'completed',
    subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount_total  NUMERIC(12,2) NOT NULL DEFAULT 0,
    tax_total       NUMERIC(12,2) NOT NULL DEFAULT 0,
    grand_total     NUMERIC(12,2) NOT NULL DEFAULT 0,
    payment_method  payment_method NOT NULL DEFAULT 'cash',
    amount_paid     NUMERIC(12,2) NOT NULL DEFAULT 0,
    change_given    NUMERIC(12,2) NOT NULL DEFAULT 0,
    dte_type        VARCHAR(10),
    dte_uuid        UUID,
    dte_control_num VARCHAR(60),
    dte_seal        TEXT,
    dte_status      VARCHAR(20),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_invoice UNIQUE (tenant_id, branch_id, invoice_number)
);
CREATE INDEX idx_sales_tenant_date ON sales(tenant_id, created_at DESC);
CREATE INDEX idx_sales_session     ON sales(cash_session_id);

CREATE TABLE sale_items (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sale_id      UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id   UUID NOT NULL REFERENCES products(id),
    product_name VARCHAR(200) NOT NULL,
    product_sku  VARCHAR(60)  NOT NULL,
    quantity     NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
    unit_price   NUMERIC(12,4) NOT NULL,
    unit_cost    NUMERIC(12,4) NOT NULL DEFAULT 0,
    discount     NUMERIC(12,2) NOT NULL DEFAULT 0,
    tax_rate     NUMERIC(5,4)  NOT NULL DEFAULT 0,
    tax_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
    line_total   NUMERIC(12,2) NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_items_sale    ON sale_items(sale_id);
CREATE INDEX idx_items_product ON sale_items(tenant_id, product_id);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['tenants','branches','users','products','stock','sales']
    LOOP
        EXECUTE format(
          'CREATE TRIGGER trg_%s_updated BEFORE UPDATE ON %s
           FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t);
    END LOOP;
END $$;

CREATE VIEW v_low_stock AS
SELECT p.tenant_id, b.id AS branch_id, b.name AS branch_name,
       p.id AS product_id, p.sku, p.name, s.quantity, p.min_stock
FROM stock s
JOIN products p ON p.id = s.product_id
JOIN branches b ON b.id = s.branch_id
WHERE p.track_stock AND p.is_active AND s.quantity <= p.min_stock;
