-- Migration 08: RLS — initial pass using is_admin() (slow). Replaced by JWT
-- helpers in 12_jwt_auth_hook.sql. We start with the slower-but-correct
-- policies so the system is safe even if the JWT hook isn't enabled yet.

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE correction_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_sub_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE carriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE hourly_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Profiles: own + admin
CREATE POLICY view_profiles ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR is_admin(auth.uid()));
CREATE POLICY update_own_profile ON profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY admin_insert_profiles ON profiles
  FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY admin_delete_profiles ON profiles
  FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- user_roles: admin only
CREATE POLICY admin_user_roles ON user_roles
  FOR ALL TO authenticated USING (is_admin(auth.uid()));

-- Reference data (read by all authenticated)
CREATE POLICY public_read_statuses ON statuses
  FOR SELECT TO authenticated USING (true);
CREATE POLICY admin_write_statuses ON statuses
  FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY admin_update_statuses ON statuses
  FOR UPDATE TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY public_read_brands ON brands
  FOR SELECT TO authenticated USING (true);
CREATE POLICY admin_write_brands ON brands
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY public_read_carriers ON carriers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY admin_write_carriers ON carriers
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Brand assignments: admin manages, employees read their own
CREATE POLICY view_brand_assignments ON brand_assignments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin(auth.uid()));
CREATE POLICY admin_write_brand_assignments ON brand_assignments
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Stores: admin only (employees don't need to see store config)
CREATE POLICY admin_stores ON stores
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Customers: admin only
CREATE POLICY admin_customers ON customers
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Orders: admin sees all; employees see orders that contain their sub-orders
CREATE POLICY view_orders ON orders
  FOR SELECT TO authenticated
  USING (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM sub_orders so
      WHERE so.order_id = orders.id AND so.assigned_employee_id = auth.uid()
    )
  );
CREATE POLICY admin_write_orders ON orders
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Sub-orders: assignee + admin
CREATE POLICY view_sub_orders ON sub_orders
  FOR SELECT TO authenticated
  USING (assigned_employee_id = auth.uid() OR is_admin(auth.uid()));
CREATE POLICY update_own_sub_orders ON sub_orders
  FOR UPDATE TO authenticated
  USING (assigned_employee_id = auth.uid() OR is_admin(auth.uid()));
CREATE POLICY admin_insert_sub_orders ON sub_orders
  FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));

-- Status history: visible to anyone who can view the sub-order
CREATE POLICY view_status_history ON status_history
  FOR SELECT TO authenticated
  USING (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM sub_orders so
      WHERE so.id = status_history.sub_order_id AND so.assigned_employee_id = auth.uid()
    )
  );

-- Supplier invoices: uploader + admin
CREATE POLICY view_supplier_invoices ON supplier_invoices
  FOR SELECT TO authenticated
  USING (uploaded_by = auth.uid() OR is_admin(auth.uid()));
CREATE POLICY insert_supplier_invoices ON supplier_invoices
  FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid() OR is_admin(auth.uid()));
CREATE POLICY update_own_supplier_invoices ON supplier_invoices
  FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY view_supplier_invoice_items ON supplier_invoice_items
  FOR SELECT TO authenticated
  USING (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM supplier_invoices si
      WHERE si.id = supplier_invoice_items.supplier_invoice_id
        AND si.uploaded_by = auth.uid()
    )
  );

-- Customer invoices: admin only
CREATE POLICY admin_customer_invoices ON customer_invoices
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY admin_invoice_corrections ON invoice_corrections
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY admin_ocr_corrections ON ocr_corrections
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY admin_invoice_sequences ON invoice_sequences
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY admin_invoice_templates ON invoice_templates
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY admin_correction_rules ON correction_rules
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY admin_ai_models ON ai_models
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Shipments: admin manages; employees read shipments containing their sub-orders
CREATE POLICY view_shipments ON shipments
  FOR SELECT TO authenticated
  USING (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM shipment_sub_orders sso
      JOIN sub_orders so ON so.id = sso.sub_order_id
      WHERE sso.shipment_id = shipments.id AND so.assigned_employee_id = auth.uid()
    )
  );
CREATE POLICY admin_write_shipments ON shipments
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY view_shipment_sub_orders ON shipment_sub_orders
  FOR SELECT TO authenticated
  USING (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM sub_orders so
      WHERE so.id = shipment_sub_orders.sub_order_id AND so.assigned_employee_id = auth.uid()
    )
  );
CREATE POLICY admin_write_shipment_sub_orders ON shipment_sub_orders
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Hourly rates: admin only
CREATE POLICY admin_hourly_rates ON hourly_rates
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Time entries: own + admin
CREATE POLICY view_time_entries ON time_entries
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin(auth.uid()));
CREATE POLICY admin_write_time_entries ON time_entries
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Notifications: own only
CREATE POLICY view_own_notifications ON notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY update_own_notifications ON notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
-- INSERT happens via triggers/edge functions, not direct user inserts.

-- API logs: admin only
CREATE POLICY admin_api_logs ON api_logs
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Settings: admin write; employees read non-pricing keys via v_settings_employee
CREATE POLICY admin_settings ON settings
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Activity log: admin sees all; employees see their own actions
CREATE POLICY view_activity_log ON activity_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin(auth.uid()));
-- INSERTs come from triggers (status_change, etc.) — no user-facing INSERT policy.

-- Invitations: admin only
CREATE POLICY admin_invitations ON invitations
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
