-- Migration 20260430000001: sourcing can hand off + warehouse role trim
--
-- Sourcing now owns the full pre-warehouse arc, including the
-- "delivered to warehouse" hand-off transition. Previously sourcing's
-- whitelist stopped at purchased_*, so a sourcer with a purchased
-- sub-order had no way to mark the hand-off — the row showed "No actions"
-- in the queue.
--
-- Warehouse is trimmed back to the three statuses they actually drive:
-- preparing_for_shipment, shipped, arrived_in_ksa. delivered_to_warehouse
-- stays writable by warehouse (they confirm receipt), but out_for_delivery
-- and delivered are KSA-side actions and now belong to fulfiller / admin
-- only (ksa_operator is the future shipping-company integration).

UPDATE statuses
   SET allowed_from_roles = ARRAY['sourcing','warehouse','fulfiller','admin']::user_role[]
 WHERE key = 'delivered_to_warehouse';

UPDATE statuses
   SET allowed_from_roles = ARRAY['ksa_operator','fulfiller','admin']::user_role[]
 WHERE key IN ('out_for_delivery', 'delivered');
