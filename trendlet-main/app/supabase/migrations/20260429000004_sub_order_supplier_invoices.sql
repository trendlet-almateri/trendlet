-- Migration 20260429000004: sub_order_supplier_invoices junction
--
-- Phase 4e introduces supplier-receipt PDF upload from a sub-order row.
-- A single supplier receipt (e.g. one Adidas store receipt) can cover
-- items belonging to MANY sub-orders, so this is a many-to-many link.
--
-- Why a junction table (not a column on sub_orders): in 4e the user
-- uploads the receipt while sitting on one sub-order's row. In 4f the
-- AI extraction step reads the PDF and the user maps additional line
-- items to other sub-orders, adding more rows to this junction. A
-- single FK on sub_orders couldn't model that fan-out without losing
-- the first-uploaded relationship.
--
-- The customer-facing link (customer_invoices.supplier_invoice_id)
-- already exists from earlier migrations. That link is born in 4f
-- when the AI generates customer invoice drafts from extracted line
-- items. This junction is the operational link that exists from the
-- moment of upload, before any AI runs.

CREATE TABLE IF NOT EXISTS sub_order_supplier_invoices (
  sub_order_id uuid NOT NULL REFERENCES sub_orders(id) ON DELETE CASCADE,
  supplier_invoice_id uuid NOT NULL REFERENCES supplier_invoices(id) ON DELETE CASCADE,
  linked_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  linked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sub_order_id, supplier_invoice_id)
);

CREATE INDEX IF NOT EXISTS sub_order_supplier_invoices_supplier_idx
  ON sub_order_supplier_invoices (supplier_invoice_id);

ALTER TABLE sub_order_supplier_invoices ENABLE ROW LEVEL SECURITY;

-- RLS mirrors supplier_invoices: a junction row is visible/insertable
-- only by the user who uploaded the underlying supplier_invoice
-- (linked_by = auth.uid()) or by an admin. Other sourcing/fulfiller
-- users can't see each other's links.

CREATE POLICY view_sub_order_supplier_invoices
  ON sub_order_supplier_invoices
  FOR SELECT
  TO authenticated
  USING (linked_by = auth.uid() OR jwt_is_admin());

CREATE POLICY insert_sub_order_supplier_invoices
  ON sub_order_supplier_invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (linked_by = auth.uid() OR jwt_is_admin());

CREATE POLICY delete_sub_order_supplier_invoices
  ON sub_order_supplier_invoices
  FOR DELETE
  TO authenticated
  USING (linked_by = auth.uid() OR jwt_is_admin());

COMMENT ON TABLE sub_order_supplier_invoices IS
  'Junction: which sub-orders are covered by which supplier receipt PDFs. Created by Phase 4e (upload from a single sub-order) and extended by Phase 4f (AI line-item mapping fans out to additional sub-orders).';
