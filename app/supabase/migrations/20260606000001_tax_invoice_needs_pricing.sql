-- Migration: add 'needs_pricing' status to tax_invoices
-- Auto-generation (Shopify orders/create) creates an issued invoice when the
-- pricing resolves unambiguously, otherwise a 'needs_pricing' draft an admin
-- finishes by hand on /tax-invoices/new. 'needs_pricing' rows have no fees yet.

ALTER TABLE tax_invoices DROP CONSTRAINT IF EXISTS tax_invoices_status_check;
ALTER TABLE tax_invoices
  ADD CONSTRAINT tax_invoices_status_check
  CHECK (status IN ('draft', 'issued', 'needs_pricing'));

-- An order should get at most one auto-generated tax invoice. Enforce one
-- invoice per order so a duplicate webhook delivery can't create a second.
-- (Manual creation already targets a specific order; this also guards that.)
CREATE UNIQUE INDEX IF NOT EXISTS tax_invoices_order_id_unique
  ON tax_invoices (order_id);
