-- log_status_change is an audit trigger — it must succeed regardless of
-- the invoking user's RLS on status_history / activity_log. Without
-- SECURITY DEFINER, a non-admin sub_order UPDATE fires this trigger,
-- the trigger tries to INSERT into status_history (no INSERT policy
-- exists for non-admin), and the whole UPDATE rolls back with
-- "new row violates row-level security policy for table status_history".
--
-- Symptom: sourcing/EU employees clicking status-change buttons saw
-- spinner-then-nothing — the UPDATE was failing silently and the
-- optimistic update reverted. Admin worked because the service-role
-- client bypasses RLS entirely.
--
-- Fix: SECURITY DEFINER + locked search_path so the trigger writes the
-- audit rows as its owner (postgres), unaffected by the caller's RLS.
CREATE OR REPLACE FUNCTION public.log_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO status_history (sub_order_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, NEW.status_changed_by);
    INSERT INTO activity_log (user_id, action, resource_type, resource_id, description)
    VALUES (NEW.status_changed_by, 'status_change', 'sub_order', NEW.id,
      format('Changed %s from %s to %s', NEW.sub_order_number, OLD.status, NEW.status));
  END IF;
  RETURN NEW;
END;
$function$;
