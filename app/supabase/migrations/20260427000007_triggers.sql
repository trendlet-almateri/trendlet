-- Migration 07: Triggers
-- Auto-log status changes, enforce role whitelist, notify on unassigned,
-- enforce brand-region, auto-update updated_at.

-- 6.1 Auto-log status changes
CREATE OR REPLACE FUNCTION log_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO status_history (sub_order_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, NEW.status_changed_by);

    INSERT INTO activity_log (user_id, action, resource_type, resource_id, description)
    VALUES (
      NEW.status_changed_by,
      'status_change',
      'sub_order',
      NEW.id,
      format('Changed %s from %s to %s', NEW.sub_order_number, OLD.status, NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_status_change
  AFTER UPDATE ON sub_orders
  FOR EACH ROW EXECUTE FUNCTION log_status_change();

-- 6.2 Enforce status whitelist
CREATE OR REPLACE FUNCTION enforce_status_whitelist()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_allowed user_role[];
  v_user_roles user_role[];
  v_is_admin boolean;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status_changed_by IS NULL THEN
    RAISE EXCEPTION 'status_changed_by required';
  END IF;

  SELECT is_admin(NEW.status_changed_by) INTO v_is_admin;
  IF v_is_admin THEN RETURN NEW; END IF;

  SELECT allowed_from_roles INTO v_allowed FROM statuses WHERE key = NEW.status;
  SELECT array_agg(role) INTO v_user_roles FROM user_roles WHERE user_id = NEW.status_changed_by;

  IF NOT (v_user_roles && v_allowed) THEN
    RAISE EXCEPTION 'User does not have permission to set status %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_status_whitelist
  BEFORE UPDATE ON sub_orders
  FOR EACH ROW EXECUTE FUNCTION enforce_status_whitelist();

-- 6.3 Notify on unassigned
CREATE OR REPLACE FUNCTION notify_on_unassigned()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_admin_id uuid;
BEGIN
  IF NEW.is_unassigned = true AND (TG_OP = 'INSERT' OR OLD.is_unassigned = false) THEN
    FOR v_admin_id IN
      SELECT user_id FROM user_roles WHERE role = 'admin'
    LOOP
      INSERT INTO notifications (user_id, type, severity, title, description, resource_type, resource_id, href)
      VALUES (
        v_admin_id,
        'unassigned_alert',
        'critical',
        format('Sub-order %s unassigned', NEW.sub_order_number),
        format('Brand %s has no assigned employee', COALESCE(NEW.brand_name_raw, 'unknown')),
        'sub_order',
        NEW.id,
        '/orders/unassigned'
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_unassigned
  AFTER INSERT OR UPDATE ON sub_orders
  FOR EACH ROW EXECUTE FUNCTION notify_on_unassigned();

-- 6.5 Enforce brand-region match
CREATE OR REPLACE FUNCTION enforce_brand_region()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_brand_region region_code;
  v_user_region region_code;
BEGIN
  SELECT region INTO v_brand_region FROM brands WHERE id = NEW.brand_id;
  SELECT region INTO v_user_region FROM profiles WHERE id = NEW.user_id;

  IF v_brand_region IS NOT NULL AND v_user_region IS NOT NULL
     AND v_brand_region <> 'GLOBAL' AND v_brand_region <> v_user_region THEN
    RAISE EXCEPTION 'Brand region (%) must match user region (%)', v_brand_region, v_user_region;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_brand_region
  BEFORE INSERT OR UPDATE ON brand_assignments
  FOR EACH ROW EXECUTE FUNCTION enforce_brand_region();

-- 6.4 updated_at on every BASE TABLE that has the column
-- (filter to relkind='r' so we skip views, which inherit updated_at from
-- their underlying tables and can't have row-level triggers)
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN pg_class cls ON cls.relname = c.table_name
    JOIN pg_namespace n ON n.oid = cls.relnamespace
    WHERE c.column_name = 'updated_at'
      AND c.table_schema = 'public'
      AND n.nspname = 'public'
      AND cls.relkind = 'r'
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
      t, t
    );
  END LOOP;
END $$;
