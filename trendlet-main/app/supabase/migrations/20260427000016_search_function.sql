-- Migration 16: Universal search function for command palette ⌘K
-- SECURITY DEFINER + JWT checks so a single RPC can serve admin and employee
-- callers without leaking out-of-scope rows.

CREATE INDEX IF NOT EXISTS idx_customers_name_trgm
  ON customers USING gin ((COALESCE(first_name,'') || ' ' || COALESCE(last_name,'')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_email_trgm
  ON customers USING gin ((email::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_orders_number_trgm
  ON orders USING gin (shopify_order_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_sub_orders_number_trgm
  ON sub_orders USING gin (sub_order_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking_trgm
  ON shipments USING gin (tracking_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_name_trgm
  ON profiles USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_email_trgm
  ON profiles USING gin ((email::text) gin_trgm_ops);

CREATE OR REPLACE FUNCTION command_palette_search(p_query text, p_limit int DEFAULT 5)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := jwt_is_admin();
  v_uid uuid := auth.uid();
  result jsonb;
BEGIN
  WITH customer_results AS (
    SELECT id, COALESCE(first_name,'') || ' ' || COALESCE(last_name,'') AS name, email::text AS email, phone
    FROM customers
    WHERE v_is_admin AND (
      first_name ILIKE '%' || p_query || '%'
      OR last_name ILIKE '%' || p_query || '%'
      OR email::text ILIKE '%' || p_query || '%'
    )
    LIMIT p_limit
  ),
  order_results AS (
    SELECT DISTINCT o.id, o.shopify_order_number AS number,
           COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'') AS customer_name
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    WHERE o.shopify_order_number ILIKE '%' || p_query || '%'
      AND (v_is_admin OR EXISTS (
        SELECT 1 FROM sub_orders so
        WHERE so.order_id = o.id AND so.assigned_employee_id = v_uid
      ))
    LIMIT p_limit
  ),
  sub_order_results AS (
    SELECT id, sub_order_number AS number, product_title AS product
    FROM sub_orders
    WHERE sub_order_number ILIKE '%' || p_query || '%'
      AND (v_is_admin OR assigned_employee_id = v_uid)
    LIMIT p_limit
  ),
  shipment_results AS (
    SELECT id, tracking_number, shipment_type
    FROM shipments
    WHERE tracking_number ILIKE '%' || p_query || '%'
    LIMIT p_limit
  ),
  brand_results AS (
    SELECT id, name::text AS name
    FROM brands
    WHERE name::text ILIKE '%' || p_query || '%' AND is_active = true
    LIMIT p_limit
  ),
  employee_results AS (
    SELECT p.id, p.full_name, p.email::text AS email
    FROM profiles p
    WHERE v_is_admin AND p.is_active = true AND (
      p.full_name ILIKE '%' || p_query || '%'
      OR p.email::text ILIKE '%' || p_query || '%'
    )
    LIMIT p_limit
  )
  SELECT jsonb_build_object(
    'customers', COALESCE((SELECT jsonb_agg(row_to_json(cr)) FROM customer_results cr), '[]'::jsonb),
    'orders', COALESCE((SELECT jsonb_agg(row_to_json(ord)) FROM order_results ord), '[]'::jsonb),
    'sub_orders', COALESCE((SELECT jsonb_agg(row_to_json(sor)) FROM sub_order_results sor), '[]'::jsonb),
    'shipments', COALESCE((SELECT jsonb_agg(row_to_json(sr)) FROM shipment_results sr), '[]'::jsonb),
    'brands', COALESCE((SELECT jsonb_agg(row_to_json(br)) FROM brand_results br), '[]'::jsonb),
    'employees', COALESCE((SELECT jsonb_agg(row_to_json(er)) FROM employee_results er), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION command_palette_search(text, int) TO authenticated;
