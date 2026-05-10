-- Migration 14: Saved views (per-user filter combinations)
-- Used by Orders, Invoices, and other list pages. is_shared = true makes a
-- view visible to all admins.

CREATE TABLE saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  page text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_shared boolean NOT NULL DEFAULT false,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, page, name)
);

CREATE INDEX idx_saved_views_user_page ON saved_views(user_id, page, display_order);
CREATE INDEX idx_saved_views_shared ON saved_views(page) WHERE is_shared = true;

ALTER TABLE saved_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY saved_views_own_or_shared ON saved_views
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (is_shared = true AND jwt_is_admin())
  );

CREATE POLICY saved_views_own_modify ON saved_views
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- updated_at trigger (created_at column already has default)
CREATE TRIGGER trg_saved_views_updated_at
  BEFORE UPDATE ON saved_views
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
