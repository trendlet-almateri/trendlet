-- Migration: tax_invoices
-- A VAT / service-fee invoice, distinct from customer_invoices (the reseller
-- cost+markup invoice). Fees are LOOKED UP from pricing_rules (keyed by
-- brand_name + category_ar) rather than computed. We snapshot the resolved fee
-- amounts onto each row so later edits to pricing_rules never mutate an issued
-- invoice.
--
-- Numbering mirrors the existing invoice_sequences / next_invoice_sequence
-- pattern in 20260427000006_functions.sql so it is race-safe.
--
-- PDF storage convention (private bucket, created out-of-band):
--   bucket: tax-invoices   path: {yyyy}/{invoice_number}.pdf

-- ── sequence table + atomic generator ──────────────────────────────────
CREATE TABLE IF NOT EXISTS tax_invoice_sequences (
  year integer PRIMARY KEY,
  last_used_number integer NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION next_tax_invoice_sequence(p_year integer)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_next integer;
BEGIN
  INSERT INTO tax_invoice_sequences (year, last_used_number)
  VALUES (p_year, 1)
  ON CONFLICT (year)
  DO UPDATE SET last_used_number = tax_invoice_sequences.last_used_number + 1
  RETURNING last_used_number INTO v_next;

  RETURN format('TAX-%s-%s', p_year, lpad(v_next::text, 4, '0'));
END;
$$;
COMMENT ON FUNCTION next_tax_invoice_sequence IS 'Atomic tax-invoice number generator. Race-safe via ON CONFLICT.';

-- ── tax_invoices ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tax_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued')),

  -- Snapshotted matching keys (for display + audit; null on manual entry).
  brand_name text,
  category_ar text,

  -- Snapshotted fee amounts. service_fee_* keep the KSA VAT split.
  service_fee_net numeric NOT NULL DEFAULT 0,
  service_fee_vat numeric NOT NULL DEFAULT 0,
  service_fee_with_vat numeric NOT NULL DEFAULT 0,
  shipping_customs_fee numeric NOT NULL DEFAULT 0,
  total_fee numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',

  -- The pricing rule this invoice was matched to. Null when the admin entered
  -- fees manually because nothing matched.
  pricing_rule_id uuid REFERENCES pricing_rules(id) ON DELETE SET NULL,

  pdf_storage_path text,
  generated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  generated_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tax_invoices_order_id_idx ON tax_invoices(order_id);
CREATE INDEX IF NOT EXISTS tax_invoices_status_idx ON tax_invoices(status);

-- updated_at trigger (set_updated_at lives in 20260427000006_functions.sql)
DROP TRIGGER IF EXISTS tax_invoices_set_updated_at ON tax_invoices;
CREATE TRIGGER tax_invoices_set_updated_at
  BEFORE UPDATE ON tax_invoices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS: admin-only (server actions use service-role + re-check auth) ───
ALTER TABLE tax_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tax_invoices_admin_all ON tax_invoices;
CREATE POLICY tax_invoices_admin_all ON tax_invoices
  FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
