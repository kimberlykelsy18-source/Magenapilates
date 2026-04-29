-- ============================================================
-- Magena Pilates — Supabase Database Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- PRODUCTS
CREATE TABLE IF NOT EXISTS products (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name              TEXT NOT NULL,
  description       TEXT,
  image_url         TEXT,
  purchase_price    NUMERIC(10,2),
  rental_price      NUMERIC(10,2),
  rental_deposit    NUMERIC(10,2),
  usd_price         NUMERIC(10,2),
  has_height_sizing BOOLEAN DEFAULT false,
  leather_finishes  TEXT[],
  wood_finishes     TEXT[],
  status            TEXT DEFAULT 'available' CHECK (status IN ('available', 'coming-soon')),
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- PRE-ORDERS
CREATE TABLE IF NOT EXISTS pre_orders (
  id                          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number                BIGINT GENERATED ALWAYS AS IDENTITY,
  product_id                  UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name                TEXT NOT NULL,
  order_type                  TEXT NOT NULL CHECK (order_type IN ('purchase', 'rental')),
  quantity                    INTEGER DEFAULT 1 CHECK (quantity > 0),
  wants_engraving             BOOLEAN DEFAULT false,
  engraving_text              TEXT CHECK (char_length(engraving_text) <= 30),
  leather_finish              TEXT,
  wood_finish                 TEXT,
  height_range                TEXT,
  context_of_use              TEXT,
  business_name               TEXT,
  business_email              TEXT,
  business_type               TEXT,
  business_registration_number TEXT,
  business_address            TEXT,
  kra_pin                     TEXT,
  rental_agreement_signed     BOOLEAN DEFAULT false,
  rental_agreement_name       TEXT,
  customer_name               TEXT NOT NULL,
  customer_email              TEXT NOT NULL,
  customer_phone              TEXT NOT NULL,
  customer_address            TEXT,
  city_town                   TEXT,
  whatsapp_number             TEXT,
  customer_country            TEXT,
  currency                    TEXT DEFAULT 'KES',
  notes                       TEXT,
  total_amount                NUMERIC(10,2) NOT NULL,
  deposit_amount              NUMERIC(10,2) DEFAULT 0,
  payment_method              TEXT DEFAULT 'card' CHECK (payment_method IN ('card', 'mpesa')),
  payment_reference           TEXT,
  shipping_status             TEXT DEFAULT 'pending',
  status                      TEXT DEFAULT 'pending_payment' CHECK (
                                status IN ('pending_payment', 'payment_verification_pending', 'confirmed', 'completed', 'cancelled', 'failed')
                              ),
  created_at                  TIMESTAMPTZ DEFAULT now()
);

-- PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id             UUID REFERENCES pre_orders(id) ON DELETE CASCADE,
  checkout_request_id  TEXT,
  amount               NUMERIC(10,2) NOT NULL,
  payment_method       TEXT DEFAULT 'card',
  payment_reference    TEXT,
  status               TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  failure_reason       TEXT,
  flw_plan_id          TEXT,
  created_at           TIMESTAMPTZ DEFAULT now()
);

-- WAITLIST
CREATE TABLE IF NOT EXISTS waitlist (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name               TEXT NOT NULL,
  email              TEXT NOT NULL,
  phone              TEXT,
  country            TEXT,
  city_town          TEXT,
  equipment_interest TEXT NOT NULL,
  context_of_use     TEXT,
  units_needed       TEXT,
  buy_or_rent        TEXT,
  business_name      TEXT,
  business_email     TEXT,
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT now()
);

-- COUNTRY SETTINGS
CREATE TABLE IF NOT EXISTS country_settings (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  country_name     TEXT NOT NULL,
  country_code     TEXT NOT NULL UNIQUE,
  vat_rate         NUMERIC(5,2) DEFAULT 0,
  tax_label        TEXT DEFAULT 'VAT',
  delivery_timeline TEXT,
  currency_code    TEXT,
  currency_name    TEXT,
  rental_available BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- SITE SETTINGS (single row, id=1)
CREATE TABLE IF NOT EXISTS site_settings (
  id                     INTEGER PRIMARY KEY DEFAULT 1,
  terms                  TEXT[] DEFAULT ARRAY[
    'This is a pre-order. Equipment will be delivered once production is complete.',
    'Full payment is required to confirm your pre-order.',
    'Rental agreements are for commercial use only (studios, gyms, clinics, corporate).',
    'Rental requires a minimum fixed period of 5 months.',
    'Refundable deposit will be returned upon equipment return in good condition.',
    'FREE logo engraving is available for purchase orders placed during the pre-order period.',
    'Delivery timelines will be communicated via email after order confirmation.'
  ],
  engraving_price        NUMERIC(10,2) DEFAULT 3500,
  rental_fixed_months    INTEGER DEFAULT 5,
  rental_deposit_formula TEXT,
  exchange_rate          NUMERIC(10,4) DEFAULT 130,
  instagram_url          TEXT,
  pinterest_url          TEXT,
  whatsapp_number        TEXT,
  footer_disclaimer      TEXT,
  post_order_message     TEXT,
  waitlist_message       TEXT DEFAULT 'Thank you for joining our waitlist! We will notify you as soon as the equipment becomes available.',
  leather_finishes       TEXT[] DEFAULT ARRAY['Black', 'Tan', 'Cream', 'Olive', 'Custom'],
  wood_finishes          TEXT[] DEFAULT ARRAY['Natural Oil', 'Dark Walnut Stain', 'Ebony', 'Custom'],
  leather_finish_images  JSONB DEFAULT '{}',
  wood_finish_images     JSONB DEFAULT '{}',
  updated_at             TIMESTAMPTZ DEFAULT now()
);

INSERT INTO site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Row-Level Security
-- ============================================================
ALTER TABLE products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pre_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist        ENABLE ROW LEVEL SECURITY;
ALTER TABLE country_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_public_read"        ON products        FOR SELECT USING (true);
CREATE POLICY "pre_orders_service_only"     ON pre_orders      FOR ALL    USING (false);
CREATE POLICY "payments_service_only"       ON payments        FOR ALL    USING (false);
CREATE POLICY "settings_public_read"        ON site_settings   FOR SELECT USING (true);
CREATE POLICY "waitlist_service_only"       ON waitlist        FOR ALL    USING (false);
CREATE POLICY "country_settings_public_read" ON country_settings FOR SELECT USING (true);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_pre_orders_status      ON pre_orders(status);
CREATE INDEX IF NOT EXISTS idx_pre_orders_email       ON pre_orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_pre_orders_created_at  ON pre_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_checkout_id   ON payments(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id      ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_email         ON waitlist(email);
CREATE INDEX IF NOT EXISTS idx_country_code           ON country_settings(country_code);


-- ============================================================
-- MIGRATION SCRIPT
-- Run these ALTER TABLE statements if upgrading an EXISTING database
-- (skip if running the schema fresh)
-- ============================================================

-- pre_orders: new columns from prototype update
ALTER TABLE pre_orders
  ADD COLUMN IF NOT EXISTS business_type               TEXT,
  ADD COLUMN IF NOT EXISTS business_registration_number TEXT,
  ADD COLUMN IF NOT EXISTS business_address             TEXT,
  ADD COLUMN IF NOT EXISTS city_town                    TEXT;

-- site_settings: rental deposit formula + finish images
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS rental_deposit_formula  TEXT,
  ADD COLUMN IF NOT EXISTS leather_finish_images   JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS wood_finish_images      JSONB DEFAULT '{}';

-- waitlist: units, buy/rent intent, city, notes
ALTER TABLE waitlist
  ADD COLUMN IF NOT EXISTS units_needed  TEXT,
  ADD COLUMN IF NOT EXISTS buy_or_rent   TEXT,
  ADD COLUMN IF NOT EXISTS city_town     TEXT,
  ADD COLUMN IF NOT EXISTS notes         TEXT;

-- Earlier migrations (keep for reference if database was created before April 2026)
/*
ALTER TABLE pre_orders
  ADD COLUMN IF NOT EXISTS engraving_text          TEXT CHECK (char_length(engraving_text) <= 30),
  ADD COLUMN IF NOT EXISTS leather_finish          TEXT,
  ADD COLUMN IF NOT EXISTS wood_finish             TEXT,
  ADD COLUMN IF NOT EXISTS height_range            TEXT,
  ADD COLUMN IF NOT EXISTS context_of_use          TEXT,
  ADD COLUMN IF NOT EXISTS business_name           TEXT,
  ADD COLUMN IF NOT EXISTS business_email          TEXT,
  ADD COLUMN IF NOT EXISTS kra_pin                 TEXT,
  ADD COLUMN IF NOT EXISTS rental_agreement_signed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS rental_agreement_name   TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_number         TEXT,
  ADD COLUMN IF NOT EXISTS customer_country        TEXT,
  ADD COLUMN IF NOT EXISTS currency                TEXT DEFAULT 'KES',
  ADD COLUMN IF NOT EXISTS payment_reference       TEXT,
  ADD COLUMN IF NOT EXISTS shipping_status         TEXT DEFAULT 'pending';

ALTER TABLE pre_orders DROP CONSTRAINT IF EXISTS pre_orders_status_check;
ALTER TABLE pre_orders ADD CONSTRAINT pre_orders_status_check CHECK (
  status IN ('pending_payment', 'payment_verification_pending', 'confirmed', 'completed', 'cancelled', 'failed')
);

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS usd_price         NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS has_height_sizing BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS leather_finishes  TEXT[],
  ADD COLUMN IF NOT EXISTS wood_finishes     TEXT[];

ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS exchange_rate      NUMERIC(10,4) DEFAULT 130,
  ADD COLUMN IF NOT EXISTS instagram_url      TEXT,
  ADD COLUMN IF NOT EXISTS pinterest_url      TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_number    TEXT,
  ADD COLUMN IF NOT EXISTS footer_disclaimer  TEXT,
  ADD COLUMN IF NOT EXISTS post_order_message TEXT,
  ADD COLUMN IF NOT EXISTS waitlist_message   TEXT DEFAULT 'Thank you for joining our waitlist!',
  ADD COLUMN IF NOT EXISTS leather_finishes   TEXT[] DEFAULT ARRAY['Black', 'Tan', 'Cream', 'Olive', 'Custom'],
  ADD COLUMN IF NOT EXISTS wood_finishes      TEXT[] DEFAULT ARRAY['Natural Oil', 'Dark Walnut Stain', 'Ebony', 'Custom'];
*/
