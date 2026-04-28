-- Migration 09: Column-level pricing isolation
-- Revoke pricing columns from `authenticated` role. Employees must read
-- through the v_*_employee views which omit those columns.
-- The service-role client (used server-side by admin server actions) bypasses
-- column-level grants because it connects as `service_role`.

REVOKE SELECT (subtotal, total, currency) ON orders FROM authenticated;
REVOKE SELECT (unit_price, currency) ON sub_orders FROM authenticated;
REVOKE SELECT (unit_price, line_total) ON supplier_invoice_items FROM authenticated;
REVOKE SELECT (invoice_total, currency) ON supplier_invoices FROM authenticated;

-- Grant the views to authenticated so they can use them
GRANT SELECT ON v_orders_employee TO authenticated;
GRANT SELECT ON v_sub_orders_employee TO authenticated;
GRANT SELECT ON v_supplier_invoices_employee TO authenticated;
GRANT SELECT ON v_supplier_invoice_items_employee TO authenticated;
GRANT SELECT ON v_settings_employee TO authenticated;
