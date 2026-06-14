-- Migration: abandoned_checkouts
-- Captures Shopify abandoned checkouts (customer reached checkout but didn't pay).
-- Fed by the checkouts/create + checkouts/update webhooks. Admin-only view at
-- /abandoned-carts. recovery_url is Shopify's ready-made link back to the cart.

CREATE TABLE IF NOT EXISTS abandoned_checkouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_checkout_id text NOT NULL UNIQUE,
  shopify_checkout_token text,
  email text,
  phone text,
  customer_name text,
  currency text,
  total numeric NOT NULL DEFAULT 0,
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  recovery_url text,
  abandoned_at timestamptz,
  recovered boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS abandoned_checkouts_abandoned_at_idx
  ON abandoned_checkouts (abandoned_at DESC);

DROP TRIGGER IF EXISTS abandoned_checkouts_set_updated_at ON abandoned_checkouts;
CREATE TRIGGER abandoned_checkouts_set_updated_at
  BEFORE UPDATE ON abandoned_checkouts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE abandoned_checkouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS abandoned_checkouts_admin_all ON abandoned_checkouts;
CREATE POLICY abandoned_checkouts_admin_all ON abandoned_checkouts
  FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
