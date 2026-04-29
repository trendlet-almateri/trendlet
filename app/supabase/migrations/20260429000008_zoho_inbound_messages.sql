-- Migration 20260429000008: zoho inbound message tracker
--
-- Phase 5: a daily cron polls the Zoho mailbox for new messages and
-- ingests any PDF attachments as supplier_invoices rows. We need a
-- dedupe key so the same email isn't processed twice if the cron
-- overlaps or is re-invoked manually.
--
-- Each row records: the Zoho-side message id, when we saw it, the
-- supplier_invoices row(s) we created from it, and a status flag for
-- whether processing finished cleanly.

CREATE TABLE IF NOT EXISTS zoho_inbound_messages (
  message_id text PRIMARY KEY,
  account_id text NOT NULL,
  from_address text,
  subject text,
  received_at timestamptz,
  attachment_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'queued',
  error_message text,
  processed_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE zoho_inbound_messages IS
  'Dedup tracker for Phase 5 Zoho inbound polling. message_id is the unique id Zoho assigns each message. status: queued|processed|skipped|failed.';

CREATE INDEX IF NOT EXISTS zoho_inbound_messages_status_idx
  ON zoho_inbound_messages (status, processed_at DESC);

ALTER TABLE zoho_inbound_messages ENABLE ROW LEVEL SECURITY;

-- Admin-only: this table is operational, not user-facing.
CREATE POLICY admin_zoho_inbound_messages
  ON zoho_inbound_messages
  FOR ALL
  TO authenticated
  USING (jwt_is_admin())
  WITH CHECK (jwt_is_admin());
