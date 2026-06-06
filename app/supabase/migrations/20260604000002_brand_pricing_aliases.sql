-- Migration: brand_pricing_aliases
-- Resolves an app brand name (brands.name, e.g. "Micheal Kors") to the brand
-- name(s) used in the pricing_rules table (e.g. "MK Boutique", "MK Outlet").
--
-- Why a dedicated table and NOT brands.aliases: brands.aliases is a citext[]
-- used in the OPPOSITE direction — Shopify vendor strings → app brand — by
-- match_brand_from_vendor(). Reusing it would corrupt Shopify ingest matching.
--
-- One app brand may map to MANY pricing brands (the Boutique vs Outlet split).
-- When a brand resolves to >1 pricing brand the tax-invoice UI asks the admin
-- which price list applies to that order (it varies per order — cannot be
-- decided globally).

CREATE TABLE IF NOT EXISTS brand_pricing_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_brand_name text NOT NULL,
  pricing_brand_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_brand_name, pricing_brand_name)
);

CREATE INDEX IF NOT EXISTS brand_pricing_aliases_app_brand_idx
  ON brand_pricing_aliases (lower(app_brand_name));

ALTER TABLE brand_pricing_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS brand_pricing_aliases_admin_all ON brand_pricing_aliases;
CREATE POLICY brand_pricing_aliases_admin_all ON brand_pricing_aliases
  FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Seed the known mappings (verified against live data 2026-06-04).
-- Brands whose name already matches a pricing brand exactly (e.g. DKNY,
-- Tory Burch) do not strictly need a row, but we add the multi-variant ones
-- so the Outlet alternative is offered.
INSERT INTO brand_pricing_aliases (app_brand_name, pricing_brand_name) VALUES
  ('Micheal Kors',       'MK Boutique'),
  ('Micheal Kors',       'MK Outlet'),
  ('Coach',              'Coach Boutique'),
  ('Coach',              'Coach Outlet'),
  ('Coach Outlet',       'Coach Boutique'),
  ('Coach Outlet',       'Coach Outlet'),
  ('Kate Spade',         'Kate Spade Boutique'),
  ('Kate Spade',         'Kate Spade Outlet'),
  ('Kate Spade Outlet',  'Kate Spade Boutique'),
  ('Kate Spade Outlet',  'Kate Spade Outlet'),
  ('Tory Burch',         'Tory Burch'),
  ('Tory Burch',         'Tory Burch Outlet'),
  ('Tory Burch Outlet',  'Tory Burch'),
  ('Tory Burch Outlet',  'Tory Burch Outlet')
ON CONFLICT (app_brand_name, pricing_brand_name) DO NOTHING;
