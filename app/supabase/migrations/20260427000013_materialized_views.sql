-- Migration 13: Materialized views for KPI dashboards
-- Refreshed every 5-15 min via pg_cron (see migration 17). Serves the
-- Dashboard, Reports page, Team load, and Top brands sections.

-- Dashboard KPIs (single row)
CREATE MATERIALIZED VIEW mv_dashboard_kpis AS
SELECT
  (SELECT COUNT(*)::int FROM orders WHERE shopify_created_at >= now() - interval '30 days') AS total_orders_30d,
  (SELECT COUNT(*)::int FROM sub_orders WHERE status NOT IN ('delivered', 'cancelled', 'returned', 'failed', 'out_of_stock')) AS active_count,
  (SELECT COUNT(*)::int FROM sub_orders WHERE is_delayed = true) AS delayed_count,
  (SELECT COUNT(*)::int FROM sub_orders WHERE is_at_risk = true AND is_delayed = false) AS at_risk_count,
  (SELECT COUNT(*)::int FROM sub_orders WHERE status = 'delivered' AND status_changed_at >= now() - interval '30 days') AS completed_30d,
  (SELECT
    ROUND(COUNT(*) FILTER (WHERE status_changed_at <= sla_due_at)::numeric * 100 / NULLIF(COUNT(*), 0), 1)
   FROM sub_orders
   WHERE status = 'delivered' AND status_changed_at >= now() - interval '30 days') AS on_time_pct;

CREATE UNIQUE INDEX idx_mv_dashboard_kpis ON mv_dashboard_kpis ((1));

-- Revenue per currency (no cross-currency aggregation)
CREATE MATERIALIZED VIEW mv_revenue_by_currency AS
SELECT
  o.currency,
  COUNT(DISTINCT o.id) FILTER (WHERE o.shopify_created_at >= now() - interval '30 days')::int AS order_count_30d,
  SUM(o.total) FILTER (WHERE o.shopify_created_at >= now() - interval '30 days') AS total_30d,
  COUNT(DISTINCT o.id) FILTER (
    WHERE o.shopify_created_at >= (now() - interval '60 days')
      AND o.shopify_created_at < (now() - interval '30 days')
  )::int AS prev_order_count,
  SUM(o.total) FILTER (
    WHERE o.shopify_created_at >= (now() - interval '60 days')
      AND o.shopify_created_at < (now() - interval '30 days')
  ) AS prev_total
FROM orders o
WHERE o.shopify_created_at >= (now() - interval '60 days')
GROUP BY o.currency;

CREATE UNIQUE INDEX idx_mv_revenue_by_currency ON mv_revenue_by_currency (currency);

-- Team load
CREATE MATERIALIZED VIEW mv_team_load AS
SELECT
  ur.role::text AS team,
  COUNT(DISTINCT ur.user_id)::int AS member_count,
  COUNT(DISTINCT so.id) FILTER (
    WHERE so.status NOT IN ('delivered', 'cancelled', 'returned', 'failed', 'out_of_stock')
  )::int AS active_items,
  COALESCE(ROUND(AVG(CASE
    WHEN so.is_delayed THEN 100
    WHEN so.is_at_risk THEN 75
    WHEN so.status NOT IN ('delivered', 'cancelled', 'returned') THEN 50
    ELSE 0
  END))::int, 0) AS load_percent
FROM user_roles ur
LEFT JOIN sub_orders so ON so.assigned_employee_id = ur.user_id
WHERE ur.role IN ('sourcing', 'warehouse', 'fulfiller', 'ksa_operator')
GROUP BY ur.role;

CREATE UNIQUE INDEX idx_mv_team_load_team ON mv_team_load (team);

-- Top brands by revenue (per currency)
CREATE MATERIALIZED VIEW mv_top_brands_30d AS
SELECT
  b.id AS brand_id,
  b.name AS brand_name,
  o.currency,
  COUNT(DISTINCT so.id)::int AS items_count,
  SUM(so.unit_price * so.quantity) AS revenue
FROM sub_orders so
JOIN orders o ON o.id = so.order_id
JOIN brands b ON b.id = so.brand_id
WHERE so.created_at >= now() - interval '30 days'
GROUP BY b.id, b.name, o.currency;

CREATE UNIQUE INDEX idx_mv_top_brands ON mv_top_brands_30d (brand_id, currency);

-- Team performance
CREATE MATERIALIZED VIEW mv_team_performance_30d AS
SELECT
  p.id AS employee_id,
  p.full_name,
  p.region,
  ur.role::text AS role,
  COUNT(DISTINCT so.id) FILTER (
    WHERE so.status_changed_at >= now() - interval '30 days'
      AND so.status IN ('delivered', 'shipped', 'preparing_for_shipment')
  )::int AS items_completed_30d,
  ROUND(
    COUNT(*) FILTER (
      WHERE so.status_changed_at >= now() - interval '30 days'
        AND so.status = 'delivered'
        AND so.status_changed_at <= so.sla_due_at
    )::numeric * 100 / NULLIF(COUNT(*) FILTER (
      WHERE so.status_changed_at >= now() - interval '30 days'
        AND so.status = 'delivered'
    ), 0),
    1
  ) AS on_time_pct
FROM profiles p
JOIN user_roles ur ON ur.user_id = p.id
LEFT JOIN sub_orders so ON so.assigned_employee_id = p.id
WHERE p.is_active = true
GROUP BY p.id, p.full_name, p.region, ur.role;

CREATE UNIQUE INDEX idx_mv_team_performance ON mv_team_performance_30d (employee_id, role);

-- Authenticated users can read these (admin-only stats are server-rendered)
GRANT SELECT ON mv_dashboard_kpis TO authenticated;
GRANT SELECT ON mv_revenue_by_currency TO authenticated;
GRANT SELECT ON mv_team_load TO authenticated;
GRANT SELECT ON mv_top_brands_30d TO authenticated;
GRANT SELECT ON mv_team_performance_30d TO authenticated;
