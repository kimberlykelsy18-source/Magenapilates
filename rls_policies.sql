-- ============================================================
-- Magena Pilates — Row-Level Security Policies
-- Run this in Supabase SQL Editor after running schema.sql
-- Safe to re-run: uses DROP IF EXISTS before each CREATE
-- ============================================================
-- Architecture:
--   anon key  → only public read (products, settings)
--   service_role key → bypasses RLS entirely (all backend writes)
-- ============================================================

-- ── PRODUCTS ────────────────────────────────────────────────
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to allow clean re-run
DROP POLICY IF EXISTS "products_public_read"   ON products;
DROP POLICY IF EXISTS "products_no_anon_write" ON products;

-- Anyone (anon) can read the product catalog
CREATE POLICY "products_public_read"
  ON products FOR SELECT
  USING (true);

-- Anon cannot insert / update / delete products
-- (service_role bypasses RLS; all admin writes go through service_role)
CREATE POLICY "products_no_anon_insert"
  ON products FOR INSERT
  WITH CHECK (false);

CREATE POLICY "products_no_anon_update"
  ON products FOR UPDATE
  USING (false);

CREATE POLICY "products_no_anon_delete"
  ON products FOR DELETE
  USING (false);


-- ── PRE_ORDERS ──────────────────────────────────────────────
ALTER TABLE pre_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pre_orders_service_only"  ON pre_orders;
DROP POLICY IF EXISTS "pre_orders_no_anon_select" ON pre_orders;
DROP POLICY IF EXISTS "pre_orders_no_anon_insert" ON pre_orders;
DROP POLICY IF EXISTS "pre_orders_no_anon_update" ON pre_orders;
DROP POLICY IF EXISTS "pre_orders_no_anon_delete" ON pre_orders;

-- Block all anon access — the backend uses service_role for all order operations
CREATE POLICY "pre_orders_no_anon_select"
  ON pre_orders FOR SELECT
  USING (false);

CREATE POLICY "pre_orders_no_anon_insert"
  ON pre_orders FOR INSERT
  WITH CHECK (false);

CREATE POLICY "pre_orders_no_anon_update"
  ON pre_orders FOR UPDATE
  USING (false);

CREATE POLICY "pre_orders_no_anon_delete"
  ON pre_orders FOR DELETE
  USING (false);


-- ── PAYMENTS ────────────────────────────────────────────────
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_service_only"   ON payments;
DROP POLICY IF EXISTS "payments_no_anon_select" ON payments;
DROP POLICY IF EXISTS "payments_no_anon_insert" ON payments;
DROP POLICY IF EXISTS "payments_no_anon_update" ON payments;
DROP POLICY IF EXISTS "payments_no_anon_delete" ON payments;

-- Block all anon access — payment data must never be exposed publicly
CREATE POLICY "payments_no_anon_select"
  ON payments FOR SELECT
  USING (false);

CREATE POLICY "payments_no_anon_insert"
  ON payments FOR INSERT
  WITH CHECK (false);

CREATE POLICY "payments_no_anon_update"
  ON payments FOR UPDATE
  USING (false);

CREATE POLICY "payments_no_anon_delete"
  ON payments FOR DELETE
  USING (false);


-- ── SITE_SETTINGS ────────────────────────────────────────────
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_public_read"    ON site_settings;
DROP POLICY IF EXISTS "settings_no_anon_write"  ON site_settings;
DROP POLICY IF EXISTS "settings_no_anon_insert" ON site_settings;
DROP POLICY IF EXISTS "settings_no_anon_update" ON site_settings;
DROP POLICY IF EXISTS "settings_no_anon_delete" ON site_settings;

-- Anyone (anon) can read public settings (terms, engraving price, etc.)
CREATE POLICY "settings_public_read"
  ON site_settings FOR SELECT
  USING (true);

-- Only service_role can change settings
CREATE POLICY "settings_no_anon_insert"
  ON site_settings FOR INSERT
  WITH CHECK (false);

CREATE POLICY "settings_no_anon_update"
  ON site_settings FOR UPDATE
  USING (false);

CREATE POLICY "settings_no_anon_delete"
  ON site_settings FOR DELETE
  USING (false);


-- ── VERIFICATION QUERY ───────────────────────────────────────
-- Run this to confirm all policies are in place:
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
