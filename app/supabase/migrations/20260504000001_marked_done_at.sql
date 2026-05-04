-- Adds an explicit "user clicked the final button" timestamp on sub_orders.
-- Role pages' Completed tab matches on (marked_done_at IS NOT NULL),
-- not on status. This decouples "row is at terminal status" from
-- "user explicitly marked it done", so a card can sit at status='delivered'
-- (e.g. backfilled from Shopify) and still appear in In Progress until
-- the user clicks the explicit final button.

ALTER TABLE sub_orders
  ADD COLUMN IF NOT EXISTS marked_done_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS sub_orders_marked_done_at_idx
  ON sub_orders (marked_done_at)
  WHERE marked_done_at IS NOT NULL;

-- Backfill: rows already at a terminal status keep their Completed-tab
-- placement. Use status_changed_at as the best-available approximation
-- of when the user "completed" the row.
UPDATE sub_orders
   SET marked_done_at = status_changed_at
 WHERE marked_done_at IS NULL
   AND status IN ('delivered', 'out_of_stock');
