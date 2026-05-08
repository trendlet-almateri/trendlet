-- Stores Shopify expiring offline tokens for service-to-service calls.
-- One row per shop. The token-manager helper (lib/shopify/token-manager.ts)
-- reads, refreshes, and overwrites this row. Refresh tokens are one-time
-- use per Shopify's spec, so we always replace both columns on refresh.
CREATE TABLE shopify_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop text NOT NULL UNIQUE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  refresh_token_expires_at timestamptz NOT NULL,
  scope text,
  client_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_shopify_tokens_expires_at ON shopify_tokens(expires_at);

ALTER TABLE shopify_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_all_shopify_tokens ON shopify_tokens
  FOR ALL TO authenticated
  USING (jwt_is_admin())
  WITH CHECK (jwt_is_admin());

CREATE TRIGGER trg_shopify_tokens_updated_at
  BEFORE UPDATE ON shopify_tokens
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
