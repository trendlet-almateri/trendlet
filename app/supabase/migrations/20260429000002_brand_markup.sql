-- Migration 20260429000002: brand markup percent
--
-- Per Q1 (locked 2026-04-29): markup is per-brand, applied uniformly
-- to every customer. Snapshotted onto `customer_invoices.markup_percent`
-- at draft time so future markup changes don't retroactively change
-- already-issued invoices.
--
-- Defaults to 0 — existing brands stay at 0% markup until admin sets a
-- value via the new /admin/brands page. Admin must populate this before
-- the sourcing/warehouse/fulfiller views can produce real customer
-- invoices.

ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS markup_percent numeric(5,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN brands.markup_percent IS
  'Default markup applied to all customers buying this brand. 50.00 = 50%. Snapshotted onto customer_invoices.markup_percent at draft time.';
