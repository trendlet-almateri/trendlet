-- Migration 20260429000003: extend role whitelist for arrived_in_ksa / delivered
--
-- Per Q7 locked 2026-04-29: there's no KSA driver employee yet. The
-- ksa_operator role is reserved for a future shipping-company integration.
-- Until then, warehouse (US) and fulfiller (EU) need to be able to mark
-- their own items as arrived in KSA and delivered, since they're the ones
-- driving the package end-to-end.
--
-- We ADD the two roles to the whitelist; we do NOT remove ksa_operator,
-- so the future integration can flip its rows without another migration.

UPDATE statuses
   SET allowed_from_roles = ARRAY['ksa_operator','warehouse','fulfiller','admin']::user_role[]
 WHERE key IN ('arrived_in_ksa', 'out_for_delivery', 'delivered');
