-- Migration 20260429000005: fix enforce_status_whitelist
--
-- Two production bugs in the existing trigger:
--
--  1. It REQUIRED the caller to pre-populate status_changed_by, but no
--     server action does this. Every click on a status button silently
--     errored (status_changed_by NULL on every test sub-order in prod).
--
--  2. It used is_admin() — banned per project rules in favour of the
--     JWT-claim-based jwt_is_admin() which doesn't hit the DB.
--
-- Fix: auto-populate status_changed_by from auth.uid() when null, and
-- swap is_admin() for jwt_is_admin(). Service-role calls (cron, webhook
-- ingestion) bypass auth.uid() — they need to set status_changed_by
-- explicitly, which they were already doing.

CREATE OR REPLACE FUNCTION public.enforce_status_whitelist()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_allowed     user_role[];
  v_user_roles  user_role[];
BEGIN
  -- No-op if status didn't change.
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Auto-fill status_changed_by from the JWT when the caller didn't set it.
  -- Service-role contexts (no JWT) must continue to set it explicitly;
  -- if they don't, we fall through to the explicit error below.
  IF NEW.status_changed_by IS NULL THEN
    NEW.status_changed_by := auth.uid();
  END IF;

  IF NEW.status_changed_by IS NULL THEN
    RAISE EXCEPTION 'status_changed_by required (no auth.uid() and not set explicitly)';
  END IF;

  -- Admins skip the role-whitelist check.
  IF jwt_is_admin() THEN
    RETURN NEW;
  END IF;

  SELECT allowed_from_roles INTO v_allowed
  FROM statuses
  WHERE key = NEW.status;

  SELECT array_agg(role) INTO v_user_roles
  FROM user_roles
  WHERE user_id = NEW.status_changed_by;

  IF NOT (v_user_roles && v_allowed) THEN
    RAISE EXCEPTION 'User does not have permission to set status %', NEW.status;
  END IF;

  RETURN NEW;
END;
$function$;
