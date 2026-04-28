-- Migration 06: Functions
-- Pure DB functions used by triggers and the app. RLS-fast JWT helpers live
-- in 12_jwt_auth_hook.sql so they can replace the slow is_admin() lookups.

-- 5.1 next_invoice_sequence
CREATE OR REPLACE FUNCTION next_invoice_sequence(p_year integer)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_next integer;
BEGIN
  INSERT INTO invoice_sequences (year, last_used_number)
  VALUES (p_year, 1)
  ON CONFLICT (year)
  DO UPDATE SET last_used_number = invoice_sequences.last_used_number + 1
  RETURNING last_used_number INTO v_next;

  RETURN format('INV-%s-%s', p_year, lpad(v_next::text, 6, '0'));
END;
$$;
COMMENT ON FUNCTION next_invoice_sequence IS 'Atomic invoice number generator. Race-safe via ON CONFLICT.';

-- 5.2 is_admin (legacy; kept as fallback. Prefer jwt_is_admin from §11.1.)
CREATE OR REPLACE FUNCTION is_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_user_id AND role = 'admin'
  );
$$;

-- 5.3 user_has_role
CREATE OR REPLACE FUNCTION user_has_role(p_user_id uuid, p_role user_role)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_user_id AND role = p_role
  );
$$;

-- 5.4 auto_assign_sub_order
CREATE OR REPLACE FUNCTION auto_assign_sub_order(p_sub_order_id uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_brand_id uuid;
  v_assignee_id uuid;
BEGIN
  SELECT brand_id INTO v_brand_id FROM sub_orders WHERE id = p_sub_order_id;
  IF v_brand_id IS NULL THEN
    UPDATE sub_orders SET is_unassigned = true WHERE id = p_sub_order_id;
    RETURN NULL;
  END IF;

  SELECT user_id INTO v_assignee_id
  FROM brand_assignments
  WHERE brand_id = v_brand_id AND is_primary = true
  LIMIT 1;

  IF v_assignee_id IS NULL THEN
    UPDATE sub_orders SET is_unassigned = true WHERE id = p_sub_order_id;
    RETURN NULL;
  END IF;

  UPDATE sub_orders
  SET assigned_employee_id = v_assignee_id, is_unassigned = false
  WHERE id = p_sub_order_id;
  RETURN v_assignee_id;
END;
$$;

-- 5.5 match_brand_from_vendor
CREATE OR REPLACE FUNCTION match_brand_from_vendor(p_vendor text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_brand_id uuid;
BEGIN
  -- Exact (case-insensitive via citext)
  SELECT id INTO v_brand_id FROM brands
  WHERE name = p_vendor::citext
  LIMIT 1;
  IF v_brand_id IS NOT NULL THEN RETURN v_brand_id; END IF;

  -- Alias
  SELECT id INTO v_brand_id FROM brands
  WHERE p_vendor::citext = ANY(aliases)
  LIMIT 1;
  IF v_brand_id IS NOT NULL THEN RETURN v_brand_id; END IF;

  -- Fuzzy (>= 0.4 similarity)
  SELECT id INTO v_brand_id FROM brands
  WHERE similarity(name::text, p_vendor) > 0.4
  ORDER BY similarity(name::text, p_vendor) DESC
  LIMIT 1;

  RETURN v_brand_id;
END;
$$;

-- Generic updated_at trigger function (used by 07_triggers.sql)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
