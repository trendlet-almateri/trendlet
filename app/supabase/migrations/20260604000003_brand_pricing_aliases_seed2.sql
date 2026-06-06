-- Migration: brand_pricing_aliases — second seed batch
-- Adds aliases for brands identified from the website brand list that have a
-- name mismatch with pricing_rules. Brands whose name already matches a pricing
-- brand (Aigner, Calvin Klein, DKNY, Fendi, Gucci, Guess, Kurt Geiger, Louis
-- Vuitton, New Balance, On Running, Prada, Saint Laurent, Sam Edelman, Tommy
-- Hilfiger, Carolina Herrera, Charles & Keith) need NO alias — resolvePricingBrands
-- falls back to the literal name and the pricing query is case-insensitive.
--
-- The app brands table currently stores "Micheal Kors" (misspelled); the website
-- uses "Michael Kors". We seed BOTH spellings → same MK targets so matching works
-- whether ingest writes the old or corrected spelling. Costs nothing (idempotent).
--
-- Brands with NO pricing rows yet (Asics, Cole Haan) are intentionally omitted —
-- they use manual fee entry until pricing rows are added.

INSERT INTO brand_pricing_aliases (app_brand_name, pricing_brand_name) VALUES
  -- Michael Kors: app misspelling + website spelling, each variant explicit
  ('Michael Kors',         'MK Boutique'),
  ('Michael Kors',         'MK Outlet'),
  ('Michael Kors Outlet',  'MK Outlet'),
  ('Micheal Kors Outlet',  'MK Outlet'),
  -- Armani Exchange A|X → Armani Exchange
  ('Armani Exchange A|X',  'Armani Exchange'),
  ('Armani Exchange',      'Armani Exchange'),
  -- Macy's → Macy's / Nordstrom
  ('Macy''s',              'Macy''s / Nordstrom'),
  ('Macy''s / Nordstrom',  'Macy''s / Nordstrom')
ON CONFLICT (app_brand_name, pricing_brand_name) DO NOTHING;
