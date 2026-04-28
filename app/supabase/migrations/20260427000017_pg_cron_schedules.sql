-- Migration 17: pg_cron schedules
-- Refresh materialized views, archive old notifications, evaluate SLA, trim
-- activity log. pg_cron requires a connected role with access; on Supabase
-- it lives in the `cron` schema and is granted to postgres.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Refresh dashboard KPIs every 5 minutes
SELECT cron.schedule(
  'refresh-dashboard-kpis',
  '*/5 * * * *',
  $$
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_kpis;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_team_load;
  $$
);

-- Refresh analytics every 15 minutes
SELECT cron.schedule(
  'refresh-analytics-views',
  '*/15 * * * *',
  $$
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_revenue_by_currency;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_brands_30d;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_team_performance_30d;
  $$
);

-- Archive old notifications nightly
SELECT cron.schedule(
  'archive-old-notifications',
  '0 3 * * *',
  $$ SELECT archive_old_notifications(); $$
);

-- Evaluate SLA at-risk / delayed every 10 minutes
SELECT cron.schedule(
  'evaluate-sla-status',
  '*/10 * * * *',
  $$
    UPDATE sub_orders
    SET is_at_risk = true
    WHERE sla_due_at IS NOT NULL
      AND sla_due_at > now()
      AND sla_due_at < now() + (sla_due_at - created_at) * 0.25
      AND is_delayed = false
      AND status NOT IN ('delivered', 'cancelled', 'returned', 'failed');

    UPDATE sub_orders
    SET is_delayed = true, is_at_risk = false
    WHERE sla_due_at IS NOT NULL
      AND sla_due_at < now()
      AND status NOT IN ('delivered', 'cancelled', 'returned', 'failed');
  $$
);

-- Trim activity log older than 90 days nightly
SELECT cron.schedule(
  'trim-activity-log',
  '0 4 * * *',
  $$
    DELETE FROM activity_log
    WHERE created_at < now() - interval '90 days';
  $$
);
