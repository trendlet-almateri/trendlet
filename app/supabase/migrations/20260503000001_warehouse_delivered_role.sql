-- Migration 20260503000001: warehouse can mark delivered
--
-- Per role-flow spec finalised 2026-05-03:
-- Warehouse role's whitelist is exactly [delivered_to_warehouse, shipped,
-- delivered]. The client whitelist already had `delivered`, but migration
-- 20260430000001 removed warehouse from the DB allowed_from_roles for
-- `delivered` — so the button rendered but the DB trigger rejected the
-- update. This re-adds warehouse so the button actually works.
--
-- Other roles unchanged. Live data unchanged.

UPDATE statuses
   SET allowed_from_roles = ARRAY['ksa_operator','warehouse','fulfiller','admin']::user_role[]
 WHERE key = 'delivered';
