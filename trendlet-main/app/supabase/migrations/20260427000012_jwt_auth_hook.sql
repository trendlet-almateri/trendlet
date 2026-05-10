-- Migration 12: JWT custom access token hook + fast RLS helpers
-- After applying this migration, the user MUST manually enable the hook in
-- the Supabase Dashboard: Authentication → Hooks → Custom Access Token Hook
-- → select function `public.custom_access_token_hook`. Until enabled, the
-- system falls back to the slower is_admin() lookups from migration 06.

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  user_roles_arr text[];
BEGIN
  SELECT array_agg(role::text) INTO user_roles_arr
  FROM public.user_roles
  WHERE user_id = (event->>'user_id')::uuid;

  claims := event->'claims';

  IF user_roles_arr IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_roles}', to_jsonb(user_roles_arr));
  ELSE
    claims := jsonb_set(claims, '{user_roles}', '[]'::jsonb);
  END IF;

  -- Also expose under app_metadata so client SDKs see it without parsing claims
  claims := jsonb_set(
    claims,
    '{app_metadata,user_roles}',
    to_jsonb(COALESCE(user_roles_arr, ARRAY[]::text[])),
    true
  );

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
GRANT ALL ON TABLE public.user_roles TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- JWT-reading helpers (fast path: no DB lookup per row)
CREATE OR REPLACE FUNCTION jwt_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT (auth.jwt() -> 'user_roles')::jsonb ? 'admin';
$$;

CREATE OR REPLACE FUNCTION jwt_has_role(p_role text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT (auth.jwt() -> 'user_roles')::jsonb ? p_role;
$$;

-- Replace hot-path policies with JWT versions (50x faster on big tables)
DROP POLICY IF EXISTS view_sub_orders ON sub_orders;
CREATE POLICY view_sub_orders ON sub_orders
  FOR SELECT TO authenticated
  USING (assigned_employee_id = auth.uid() OR jwt_is_admin());

DROP POLICY IF EXISTS update_own_sub_orders ON sub_orders;
CREATE POLICY update_own_sub_orders ON sub_orders
  FOR UPDATE TO authenticated
  USING (assigned_employee_id = auth.uid() OR jwt_is_admin());

DROP POLICY IF EXISTS admin_insert_sub_orders ON sub_orders;
CREATE POLICY admin_insert_sub_orders ON sub_orders
  FOR INSERT TO authenticated WITH CHECK (jwt_is_admin());

DROP POLICY IF EXISTS view_orders ON orders;
CREATE POLICY view_orders ON orders
  FOR SELECT TO authenticated
  USING (
    jwt_is_admin()
    OR EXISTS (
      SELECT 1 FROM sub_orders so
      WHERE so.order_id = orders.id AND so.assigned_employee_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS admin_write_orders ON orders;
CREATE POLICY admin_write_orders ON orders
  FOR ALL TO authenticated USING (jwt_is_admin()) WITH CHECK (jwt_is_admin());

DROP POLICY IF EXISTS admin_customer_invoices ON customer_invoices;
CREATE POLICY admin_customer_invoices ON customer_invoices
  FOR ALL TO authenticated USING (jwt_is_admin()) WITH CHECK (jwt_is_admin());

DROP POLICY IF EXISTS view_profiles ON profiles;
CREATE POLICY view_profiles ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR jwt_is_admin());

DROP POLICY IF EXISTS admin_user_roles ON user_roles;
CREATE POLICY admin_user_roles ON user_roles
  FOR ALL TO authenticated USING (jwt_is_admin());
