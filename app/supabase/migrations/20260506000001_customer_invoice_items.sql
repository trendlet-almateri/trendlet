-- Multi-sub-order, multi-line invoices.
--
-- customer_invoice_items: one row per invoice line. Replaces the assumption
--   that line items equal sub_orders 1:1.
-- customer_invoice_sub_orders: M2M junction. An invoice can bundle multiple
--   sub_orders, and the same sub_order can appear on multiple invoices.

CREATE TABLE customer_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_invoice_id uuid NOT NULL REFERENCES customer_invoices(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  title text NOT NULL,
  sku text,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  line_total numeric(12,2) NOT NULL DEFAULT 0,
  sub_order_id uuid REFERENCES sub_orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_customer_invoice_items_invoice
  ON customer_invoice_items(customer_invoice_id, position);
CREATE INDEX idx_customer_invoice_items_sub_order
  ON customer_invoice_items(sub_order_id) WHERE sub_order_id IS NOT NULL;

CREATE TABLE customer_invoice_sub_orders (
  customer_invoice_id uuid NOT NULL REFERENCES customer_invoices(id) ON DELETE CASCADE,
  sub_order_id uuid NOT NULL REFERENCES sub_orders(id) ON DELETE RESTRICT,
  PRIMARY KEY (customer_invoice_id, sub_order_id)
);
CREATE INDEX idx_customer_invoice_sub_orders_sub
  ON customer_invoice_sub_orders(sub_order_id);

ALTER TABLE customer_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_invoice_sub_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_all_invoice_items ON customer_invoice_items
  FOR ALL TO authenticated
  USING (jwt_is_admin())
  WITH CHECK (jwt_is_admin());

CREATE POLICY admin_all_invoice_sub_orders ON customer_invoice_sub_orders
  FOR ALL TO authenticated
  USING (jwt_is_admin())
  WITH CHECK (jwt_is_admin());

CREATE POLICY employee_read_own_invoice_items ON customer_invoice_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customer_invoices ci
      WHERE ci.id = customer_invoice_items.customer_invoice_id
        AND ci.generated_by = (auth.jwt() ->> 'sub')::uuid
    )
  );

CREATE POLICY employee_read_own_invoice_sub_orders ON customer_invoice_sub_orders
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customer_invoices ci
      WHERE ci.id = customer_invoice_sub_orders.customer_invoice_id
        AND ci.generated_by = (auth.jwt() ->> 'sub')::uuid
    )
  );

CREATE TRIGGER trg_customer_invoice_items_updated_at
  BEFORE UPDATE ON customer_invoice_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
