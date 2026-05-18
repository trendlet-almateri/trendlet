-- Cancellation is now an admin-only action.
--
-- Context: the UI exposes a "Cancel order" affordance to admins on any
-- non-terminal sub-order status. The matching security boundary is the
-- enforce_status_whitelist trigger, which checks statuses.allowed_from_roles
-- for non-admins (admins bypass it via jwt_is_admin()).
--
-- Live prod value (verified 2026-05-18) was {fulfiller,admin} — `sourcing`
-- was already excluded. Removing `fulfiller` makes cancellation truly
-- admin-only at the DB layer so the new "cancel from any status" power
-- cannot be exercised by non-admins via a forged request.
--
-- Idempotent. Touches only `allowed_from_roles` (the live `statuses` table
-- has no `label`/`stage` columns — do not reference them here).

UPDATE public.statuses
SET allowed_from_roles = ARRAY['admin']::user_role[]
WHERE key = 'cancelled'
  AND allowed_from_roles IS DISTINCT FROM ARRAY['admin']::user_role[];
