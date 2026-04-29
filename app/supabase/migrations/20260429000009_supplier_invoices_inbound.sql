-- Migration 20260429000009: allow inbound supplier_invoices without uploaded_by
--
-- Phase 5 introduces auto-imported supplier receipts that come from a
-- Zoho mailbox with no human uploader. The existing supplier_invoices
-- schema requires uploaded_by NOT NULL because Phase 4e was the only
-- entry point. Relaxing that, and adding a CHECK that keeps manual
-- uploads correctly attributed.

ALTER TABLE supplier_invoices
  ALTER COLUMN uploaded_by DROP NOT NULL;

ALTER TABLE supplier_invoices
  DROP CONSTRAINT IF EXISTS supplier_invoices_source_uploader_chk;

ALTER TABLE supplier_invoices
  ADD CONSTRAINT supplier_invoices_source_uploader_chk
  CHECK (
    -- Manual uploads (Phase 4e) MUST have a real uploader.
    -- Inbound auto-imports (Phase 5) MAY have no uploader.
    (source = 'manual' AND uploaded_by IS NOT NULL)
    OR (source <> 'manual')
  );

-- The supplier_invoices SELECT RLS still requires uploaded_by = auth.uid()
-- OR jwt_is_admin(); inbound rows (uploaded_by IS NULL) become admin-visible
-- only, which matches our policy: sourcers/fulfillers see their own uploads,
-- admins handle the auto-imported queue.

COMMENT ON COLUMN supplier_invoices.uploaded_by IS
  'NULL only when source != ''manual'' (e.g. ''inbound_email''). Manual uploads must be attributed to a real user.';
