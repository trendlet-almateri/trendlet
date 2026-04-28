-- Migration 20260428000002: convert ALL remaining `is_admin()` policies to
-- the JWT-based `jwt_is_admin()` helper introduced in migration 12.
--
-- Migration 12 only patched the hot-path tables (orders, sub_orders,
-- customer_invoices, profiles SELECT, user_roles). This migration finishes
-- the job for the 22 admin-checked policies that still hit `is_admin()`,
-- which does a per-row DB lookup and tanks query plans on big tables.
--
-- Prerequisite: the Custom Access Token Hook in Supabase Dashboard MUST be
-- enabled and pointed at `public.custom_access_token_hook`. Without it,
-- `auth.jwt() -> 'user_roles'` is null and admins are locked out.

-- ── profiles (INSERT/DELETE) ──────────────────────────────────────────────
DROP POLICY IF EXISTS admin_insert_profiles ON profiles;
CREATE POLICY admin_insert_profiles ON profiles
  FOR INSERT TO authenticated WITH CHECK (jwt_is_admin());

DROP POLICY IF EXISTS admin_delete_profiles ON profiles;
CREATE POLICY admin_delete_profiles ON profiles
  FOR DELETE TO authenticated USING (jwt_is_admin());

-- ── brand_assignments ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS view_brand_assignments ON brand_assignments;
CREATE POLICY view_brand_assignments ON brand_assignments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR jwt_is_admin());

DROP POLICY IF EXISTS admin_write_brand_assignments ON brand_assignments;
CREATE POLICY admin_write_brand_assignments ON brand_assignments
  FOR ALL TO authenticated USING (jwt_is_admin()) WITH CHECK (jwt_is_admin());

-- ── stores ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS admin_stores ON stores;
CREATE POLICY admin_stores ON stores
  FOR ALL TO authenticated USING (jwt_is_admin()) WITH CHECK (jwt_is_admin());

-- ── customers ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS admin_customers ON customers;
CREATE POLICY admin_customers ON customers
  FOR ALL TO authenticated USING (jwt_is_admin()) WITH CHECK (jwt_is_admin());

-- ── statuses (write paths only — public_read stays open) ──────────────────
DROP POLICY IF EXISTS admin_write_statuses ON statuses;
CREATE POLICY admin_write_statuses ON statuses
  FOR INSERT TO authenticated WITH CHECK (jwt_is_admin());

DROP POLICY IF EXISTS admin_update_statuses ON statuses;
CREATE POLICY admin_update_statuses ON statuses
  FOR UPDATE TO authenticated USING (jwt_is_admin());

-- ── brands (write path only) ──────────────────────────────────────────────
DROP POLICY IF EXISTS admin_write_brands ON brands;
CREATE POLICY admin_write_brands ON brands
  FOR ALL TO authenticated USING (jwt_is_admin()) WITH CHECK (jwt_is_admin());

-- ── carriers (write path only) ────────────────────────────────────────────
DROP POLICY IF EXISTS admin_write_carriers ON carriers;
CREATE POLICY admin_write_carriers ON carriers
  FOR ALL TO authenticated USING (jwt_is_admin()) WITH CHECK (jwt_is_admin());

-- ── supplier_invoices ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS view_supplier_invoices ON supplier_invoices;
CREATE POLICY view_supplier_invoices ON supplier_invoices
  FOR SELECT TO authenticated
  USING (uploaded_by = auth.uid() OR jwt_is_admin());

DROP POLICY IF EXISTS insert_supplier_invoices ON supplier_invoices;
CREATE POLICY insert_supplier_invoices ON supplier_invoices
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() OR jwt_is_admin());

DROP POLICY IF EXISTS update_own_supplier_invoices ON supplier_invoices;
CREATE POLICY update_own_supplier_invoices ON supplier_invoices
  FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid() OR jwt_is_admin());

-- ── supplier_invoice_items ────────────────────────────────────────────────
DROP POLICY IF EXISTS view_supplier_invoice_items ON supplier_invoice_items;
CREATE POLICY view_supplier_invoice_items ON supplier_invoice_items
  FOR SELECT TO authenticated
  USING (
    jwt_is_admin()
    OR EXISTS (
      SELECT 1 FROM supplier_invoices si
      WHERE si.id = supplier_invoice_items.supplier_invoice_id
        AND si.uploaded_by = auth.uid()
    )
  );

-- ── invoice_corrections / ocr_corrections / invoice_sequences ─────────────
DROP POLICY IF EXISTS admin_invoice_corrections ON invoice_corrections;
CREATE POLICY admin_invoice_corrections ON invoice_corrections
  FOR ALL TO authenticated USING (jwt_is_admin()) WITH CHECK (jwt_is_admin());

DROP POLICY IF EXISTS admin_ocr_corrections ON ocr_corrections;
CREATE POLICY admin_ocr_corrections ON ocr_corrections
  FOR ALL TO authenticated USING (jwt_is_admin()) WITH CHECK (jwt_is_admin());

DROP POLICY IF EXISTS admin_invoice_sequences ON invoice_sequences;
CREATE POLICY admin_invoice_sequences ON invoice_sequences
  FOR ALL TO authenticated USING (jwt_is_admin()) WITH CHECK (jwt_is_admin());

DROP POLICY IF EXISTS admin_invoice_templates ON invoice_templates;
CREATE POLICY admin_invoice_templates ON invoice_templates
  FOR ALL TO authenticated USING (jwt_is_admin()) WITH CHECK (jwt_is_admin());

DROP POLICY IF EXISTS admin_correction_rules ON correction_rules;
CREATE POLICY admin_correction_rules ON correction_rules
  FOR ALL TO authenticated USING (jwt_is_admin()) WITH CHECK (jwt_is_admin());

DROP POLICY IF EXISTS admin_ai_models ON ai_models;
CREATE POLICY admin_ai_models ON ai_models
  FOR ALL TO authenticated USING (jwt_is_admin()) WITH CHECK (jwt_is_admin());

-- ── status_history (admin path) ───────────────────────────────────────────
DROP POLICY IF EXISTS view_status_history ON status_history;
CREATE POLICY view_status_history ON status_history
  FOR SELECT TO authenticated
  USING (
    jwt_is_admin()
    OR EXISTS (
      SELECT 1 FROM sub_orders so
      WHERE so.id = status_history.sub_order_id AND so.assigned_employee_id = auth.uid()
    )
  );

-- ── shipments / shipment_sub_orders ───────────────────────────────────────
DROP POLICY IF EXISTS view_shipments ON shipments;
CREATE POLICY view_shipments ON shipments
  FOR SELECT TO authenticated
  USING (
    jwt_is_admin()
    OR EXISTS (
      SELECT 1 FROM shipment_sub_orders sso
      JOIN sub_orders so ON so.id = sso.sub_order_id
      WHERE sso.shipment_id = shipments.id AND so.assigned_employee_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS admin_write_shipments ON shipments;
CREATE POLICY admin_write_shipments ON shipments
  FOR ALL TO authenticated USING (jwt_is_admin()) WITH CHECK (jwt_is_admin());

DROP POLICY IF EXISTS view_shipment_sub_orders ON shipment_sub_orders;
CREATE POLICY view_shipment_sub_orders ON shipment_sub_orders
  FOR SELECT TO authenticated
  USING (
    jwt_is_admin()
    OR EXISTS (
      SELECT 1 FROM sub_orders so
      WHERE so.id = shipment_sub_orders.sub_order_id AND so.assigned_employee_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS admin_write_shipment_sub_orders ON shipment_sub_orders;
CREATE POLICY admin_write_shipment_sub_orders ON shipment_sub_orders
  FOR ALL TO authenticated USING (jwt_is_admin()) WITH CHECK (jwt_is_admin());

-- ── hourly_rates / time_entries ───────────────────────────────────────────
DROP POLICY IF EXISTS admin_hourly_rates ON hourly_rates;
CREATE POLICY admin_hourly_rates ON hourly_rates
  FOR ALL TO authenticated USING (jwt_is_admin()) WITH CHECK (jwt_is_admin());

DROP POLICY IF EXISTS view_time_entries ON time_entries;
CREATE POLICY view_time_entries ON time_entries
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR jwt_is_admin());

DROP POLICY IF EXISTS admin_write_time_entries ON time_entries;
CREATE POLICY admin_write_time_entries ON time_entries
  FOR ALL TO authenticated USING (jwt_is_admin()) WITH CHECK (jwt_is_admin());

-- ── api_logs / settings ───────────────────────────────────────────────────
DROP POLICY IF EXISTS admin_api_logs ON api_logs;
CREATE POLICY admin_api_logs ON api_logs
  FOR ALL TO authenticated USING (jwt_is_admin()) WITH CHECK (jwt_is_admin());

DROP POLICY IF EXISTS admin_settings ON settings;
CREATE POLICY admin_settings ON settings
  FOR ALL TO authenticated USING (jwt_is_admin()) WITH CHECK (jwt_is_admin());

-- ── activity_log ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS view_activity_log ON activity_log;
CREATE POLICY view_activity_log ON activity_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR jwt_is_admin());

-- ── invitations ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS admin_invitations ON invitations;
CREATE POLICY admin_invitations ON invitations
  FOR ALL TO authenticated USING (jwt_is_admin()) WITH CHECK (jwt_is_admin());
