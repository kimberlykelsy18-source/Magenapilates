-- ============================================================
-- Magena Pilates — Supabase Database Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- PRODUCTS
CREATE TABLE IF NOT EXISTS products (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT,
  image_url     TEXT,
  purchase_price  NUMERIC(10,2),
  rental_price    NUMERIC(10,2),        -- monthly rental rate
  rental_deposit  NUMERIC(10,2),        -- refundable deposit
  status        TEXT DEFAULT 'available' CHECK (status IN ('available', 'coming-soon')),
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- PRE-ORDERS
CREATE TABLE IF NOT EXISTS pre_orders (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number    BIGINT GENERATED ALWAYS AS IDENTITY,   -- for short human-readable IDs (PRE-A001)
  product_id      UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name    TEXT NOT NULL,
  order_type      TEXT NOT NULL CHECK (order_type IN ('purchase', 'rental')),
  quantity        INTEGER DEFAULT 1 CHECK (quantity > 0),
  wants_engraving BOOLEAN DEFAULT false,
  customer_name   TEXT NOT NULL,
  customer_email  TEXT NOT NULL,
  customer_phone  TEXT NOT NULL,
  customer_address TEXT,
  notes           TEXT,
  total_amount    NUMERIC(10,2) NOT NULL,
  deposit_amount  NUMERIC(10,2) DEFAULT 0,     -- rental deposit (0 for purchases)
  payment_method  TEXT DEFAULT 'card' CHECK (payment_method IN ('card', 'mpesa')),
  status          TEXT DEFAULT 'pending_payment' CHECK (
                    status IN ('pending_payment', 'confirmed', 'completed', 'cancelled')
                  ),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id             UUID REFERENCES pre_orders(id) ON DELETE CASCADE,
  checkout_request_id  TEXT,              -- PesaPal OrderTrackingId / M-Pesa CheckoutRequestID
  amount               NUMERIC(10,2) NOT NULL,
  payment_method       TEXT DEFAULT 'card',
  payment_reference    TEXT,              -- PesaPal confirmation code or M-Pesa receipt
  status               TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  failure_reason       TEXT,
  created_at           TIMESTAMPTZ DEFAULT now()
);

-- SITE SETTINGS (single row, id=1)
CREATE TABLE IF NOT EXISTS site_settings (
  id                   INTEGER PRIMARY KEY DEFAULT 1,
  terms                TEXT[] DEFAULT ARRAY[
    'This is a pre-order. Equipment will be delivered once production is complete.',
    'Full payment is required to confirm your pre-order.',
    'Rental agreements are for a minimum fixed period of 5 months.',
    'Refundable deposit will be returned upon equipment return in good condition.',
    'FREE logo engraving is available for purchase orders placed during the pre-order period.',
    'Delivery timelines will be communicated via email after order confirmation.'
  ],
  engraving_price      NUMERIC(10,2) DEFAULT 3500,
  rental_fixed_months  INTEGER DEFAULT 5,
  updated_at           TIMESTAMPTZ DEFAULT now()
);

-- Insert default settings row
INSERT INTO site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Row-Level Security (RLS)
-- ============================================================

ALTER TABLE products    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pre_orders  ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Products: public read, no direct client writes
CREATE POLICY "products_public_read" ON products
  FOR SELECT USING (true);

-- Pre-orders: no direct client access (backend uses service role)
CREATE POLICY "pre_orders_service_only" ON pre_orders
  FOR ALL USING (false);

-- Payments: no direct client access
CREATE POLICY "payments_service_only" ON payments
  FOR ALL USING (false);

-- Site settings: public read
CREATE POLICY "settings_public_read" ON site_settings
  FOR SELECT USING (true);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_pre_orders_status     ON pre_orders(status);
CREATE INDEX IF NOT EXISTS idx_pre_orders_email      ON pre_orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_pre_orders_created_at ON pre_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_checkout_id  ON payments(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id     ON payments(order_id);
