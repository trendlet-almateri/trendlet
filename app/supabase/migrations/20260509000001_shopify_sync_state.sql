-- Tracks polling progress for the Shopify auto-sync cron job. One row
-- per shop. The cron route reads last_polled_at, fetches orders updated
-- since then (with a small overlap to handle clock skew), ingests them,
-- and writes the new timestamp.
CREATE TABLE shopify_sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop text NOT NULL UNIQUE,
  last_polled_at timestamptz NOT NULL DEFAULT '2026-01-01T00:00:00Z',
  last_run_at timestamptz,
  last_run_summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shopify_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_all_shopify_sync_state ON shopify_sync_state
  FOR ALL TO authenticated
  USING (jwt_is_admin())
  WITH CHECK (jwt_is_admin());

CREATE TRIGGER trg_shopify_sync_state_updated_at
  BEFORE UPDATE ON shopify_sync_state
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
