-- Migration 20260428000003: webhook delivery dedup table
--
-- Shopify includes `X-Shopify-Webhook-Id` on every webhook. The same id is
-- used across retries/replays. We record it on first receipt so a replayed
-- payload (network-induced retry, or attacker-replayed valid signature) is
-- a no-op rather than a re-import.
--
-- We also keep this table service-role-only — webhooks run as service role,
-- and there's no user-facing reason to read it.

CREATE TABLE webhook_deliveries (
  webhook_id text PRIMARY KEY,
  source text NOT NULL,                           -- 'shopify', future: 'stripe', etc.
  topic text,                                     -- e.g. 'orders/create'
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX webhook_deliveries_received_at_idx
  ON webhook_deliveries (received_at DESC);

ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
-- No policies = service-role-only access. Authenticated/anon get nothing.

-- Optional janitor: delete entries older than 30 days. Hooked into pg_cron
-- if the project uses it; otherwise call manually.
CREATE OR REPLACE FUNCTION prune_webhook_deliveries()
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM webhook_deliveries WHERE received_at < now() - interval '30 days';
$$;
