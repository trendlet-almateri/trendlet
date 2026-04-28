-- Migration 05: Pricing-isolation views (for non-admin reads)
-- Employees query through these views; pricing columns are revoked from
-- the `authenticated` role on the underlying tables (see 09_column_isolation).

CREATE VIEW v_orders_employee AS
SELECT
  id, store_id, shopify_order_id, shopify_order_number,
  customer_id, shipping_address, billing_address, notes,
  shopify_created_at, ingested_at, updated_at
FROM orders;

CREATE VIEW v_sub_orders_employee AS
SELECT
  id, order_id, sub_order_number, shopify_line_item_id,
  product_title, variant_title, sku, quantity, product_image_url,
  brand_id, brand_name_raw, assigned_employee_id, is_unassigned,
  status, status_changed_at, status_changed_by,
  sla_due_at, is_at_risk, is_delayed,
  created_at, updated_at
FROM sub_orders;

CREATE VIEW v_supplier_invoices_employee AS
SELECT
  id, uploaded_by, storage_path, original_filename, file_size_bytes,
  mime_type, source, ocr_state, ocr_model_used, ocr_extracted_at,
  supplier_name, invoice_date, notes,
  created_at, updated_at
FROM supplier_invoices;

CREATE VIEW v_supplier_invoice_items_employee AS
SELECT
  id, supplier_invoice_id, description, quantity, barcode,
  mapped_sub_order_id, mapped_at, mapped_by,
  ai_confidence, ai_match_score, ai_reasoning,
  created_at, updated_at
FROM supplier_invoice_items;

CREATE VIEW v_settings_employee AS
SELECT key, value, description, updated_at
FROM settings
WHERE key NOT LIKE 'pricing_%'
  AND key NOT LIKE 'markup_%'
  AND key NOT LIKE 'fx_%';
