-- Add product_type to sub_orders.
-- Shopify order webhooks do NOT include product_type (it lives only on the
-- Product resource), so this is populated by an outgoing Admin API call during
-- order ingestion (lib/shopify/ingest-order.ts) and by the backfill script.
-- For internal/reporting use; not surfaced in the app UI.
ALTER TABLE sub_orders ADD COLUMN IF NOT EXISTS product_type text;
