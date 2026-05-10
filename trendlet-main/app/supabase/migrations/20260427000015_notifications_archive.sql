-- Migration 15: Notifications archive
-- Keeps the live notifications table small. archive_old_notifications() is
-- called nightly by pg_cron (see migration 17).

CREATE TABLE notifications_archive (LIKE notifications INCLUDING ALL);

ALTER TABLE notifications_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY view_own_archived_notifications ON notifications_archive
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION archive_old_notifications()
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_count int;
BEGIN
  WITH moved AS (
    DELETE FROM notifications
    WHERE created_at < now() - interval '30 days'
    RETURNING *
  )
  INSERT INTO notifications_archive
  SELECT * FROM moved;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
