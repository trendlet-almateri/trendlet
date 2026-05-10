-- Migration 04: Tables that depend on core tables (orders, sub_orders, invoices, etc.)
-- The customer_invoices table forward-references invoice_templates so that
-- table is created before customer_invoices via DEFERRABLE workaround:
-- we create invoice_templates first, then customer_invoices, then add the FK.

-- 3.18 invoice_templates (created early so customer_invoices can reference it)
CREATE TABLE invoice_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  storage_path text NOT NULL,
  language invoice_language NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  preview_url text,
  uploaded_by uuid NOT NULL REFERENCES profiles(id),
  usage_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_invoice_templates_default
  ON invoice_templates(language, is_default)
  WHERE is_default = true;

-- 3.9 orders
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id),
  shopify_order_id text NOT NULL,
  shopify_order_number text NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE RESTRICT,
  subtotal numeric(12,2),
  total numeric(12,2),
  currency currency_code NOT NULL,
  shipping_address jsonb,
  billing_address jsonb,
  notes text,
  raw_payload jsonb NOT NULL,
  shopify_created_at timestamptz NOT NULL,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, shopify_order_id)
);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_store_created ON orders(store_id, shopify_created_at DESC);
CREATE INDEX idx_orders_number ON orders(shopify_order_number);

-- 3.10 sub_orders
CREATE TABLE sub_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sub_order_number text NOT NULL,
  shopify_line_item_id text,
  product_title text NOT NULL,
  variant_title text,
  sku text,
  quantity integer NOT NULL DEFAULT 1,
  product_image_url text,
  unit_price numeric(12,2),
  currency currency_code NOT NULL,
  brand_id uuid REFERENCES brands(id) ON DELETE SET NULL,
  brand_name_raw text,
  assigned_employee_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  is_unassigned boolean NOT NULL DEFAULT false,
  status text NOT NULL REFERENCES statuses(key),
  status_changed_at timestamptz NOT NULL DEFAULT now(),
  status_changed_by uuid REFERENCES profiles(id),
  sla_due_at timestamptz,
  is_at_risk boolean NOT NULL DEFAULT false,
  is_delayed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, sub_order_number)
);
CREATE INDEX idx_sub_orders_order ON sub_orders(order_id);
CREATE INDEX idx_sub_orders_assignee ON sub_orders(assigned_employee_id) WHERE assigned_employee_id IS NOT NULL;
CREATE INDEX idx_sub_orders_brand ON sub_orders(brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX idx_sub_orders_unassigned ON sub_orders(is_unassigned) WHERE is_unassigned = true;
CREATE INDEX idx_sub_orders_status ON sub_orders(status);
CREATE INDEX idx_sub_orders_at_risk ON sub_orders(is_at_risk) WHERE is_at_risk = true;
CREATE INDEX idx_sub_orders_delayed ON sub_orders(is_delayed) WHERE is_delayed = true;
CREATE INDEX idx_sub_orders_pipeline
  ON sub_orders(status, status_changed_at DESC)
  WHERE status NOT IN ('delivered', 'cancelled', 'returned', 'failed');
CREATE INDEX idx_sub_orders_employee_queue
  ON sub_orders(assigned_employee_id, status, sla_due_at)
  WHERE assigned_employee_id IS NOT NULL;

-- 3.11 status_history
CREATE TABLE status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_order_id uuid NOT NULL REFERENCES sub_orders(id) ON DELETE CASCADE,
  from_status text REFERENCES statuses(key),
  to_status text NOT NULL REFERENCES statuses(key),
  changed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_status_history_sub_order ON status_history(sub_order_id, created_at DESC);

-- 3.12 supplier_invoices
CREATE TABLE supplier_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  storage_path text NOT NULL,
  original_filename text,
  file_size_bytes integer,
  mime_type text,
  source text NOT NULL DEFAULT 'manual',
  ocr_state ocr_state NOT NULL DEFAULT 'uploaded',
  ocr_model_used text,
  ocr_extracted_at timestamptz,
  ocr_raw_response jsonb,
  supplier_name text,
  invoice_date date,
  invoice_total numeric(12,2),
  currency currency_code,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_supplier_invoices_uploader ON supplier_invoices(uploaded_by);
CREATE INDEX idx_supplier_invoices_state ON supplier_invoices(ocr_state);

-- 3.13 supplier_invoice_items
CREATE TABLE supplier_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_invoice_id uuid NOT NULL REFERENCES supplier_invoices(id) ON DELETE CASCADE,
  description text,
  quantity integer DEFAULT 1,
  unit_price numeric(12,2),
  line_total numeric(12,2),
  barcode text,
  mapped_sub_order_id uuid REFERENCES sub_orders(id) ON DELETE SET NULL,
  mapped_at timestamptz,
  mapped_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ai_confidence ai_confidence,
  ai_match_score numeric(4,3),
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_supplier_invoice_items_invoice ON supplier_invoice_items(supplier_invoice_id);
CREATE INDEX idx_supplier_invoice_items_sub_order
  ON supplier_invoice_items(mapped_sub_order_id) WHERE mapped_sub_order_id IS NOT NULL;

-- 3.14 customer_invoices
CREATE TABLE customer_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  status invoice_status NOT NULL DEFAULT 'draft',
  cost numeric(12,2) NOT NULL,
  cost_currency currency_code NOT NULL,
  markup_percent numeric(5,2) NOT NULL,
  item_price numeric(12,2) NOT NULL,
  shipment_fee numeric(12,2) NOT NULL DEFAULT 0,
  tax_percent numeric(5,2) NOT NULL DEFAULT 0,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL,
  total_currency currency_code NOT NULL,
  profit_amount numeric(12,2),
  profit_percent numeric(5,2),
  ai_confidence ai_confidence,
  ai_model_used text,
  ai_reasoning jsonb,
  generated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  generated_at timestamptz,
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  rejection_reason text,
  template_id uuid REFERENCES invoice_templates(id) ON DELETE RESTRICT,
  language invoice_language NOT NULL,
  pdf_storage_path text,
  sent_to_email citext,
  sent_at timestamptz,
  whatsapp_sent_at timestamptz,
  supplier_invoice_id uuid REFERENCES supplier_invoices(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_customer_invoices_order ON customer_invoices(order_id);
CREATE INDEX idx_customer_invoices_status ON customer_invoices(status);
CREATE INDEX idx_customer_invoices_pending
  ON customer_invoices(status, ai_confidence, generated_at DESC)
  WHERE status = 'pending_review';

-- 3.15 invoice_corrections
CREATE TABLE invoice_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_invoice_id uuid NOT NULL REFERENCES customer_invoices(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  original_value text,
  corrected_value text NOT NULL,
  corrected_by uuid NOT NULL REFERENCES profiles(id),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoice_corrections_invoice ON invoice_corrections(customer_invoice_id);

-- 3.16 ocr_corrections
CREATE TABLE ocr_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_invoice_item_id uuid NOT NULL REFERENCES supplier_invoice_items(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  original_value text,
  corrected_value text NOT NULL,
  corrected_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ocr_corrections_item ON ocr_corrections(supplier_invoice_item_id);

-- 3.17 invoice_sequences
CREATE TABLE invoice_sequences (
  year integer PRIMARY KEY,
  last_used_number integer NOT NULL DEFAULT 0
);

-- 3.19 correction_rules
CREATE TABLE correction_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  applies_to jsonb NOT NULL,
  field_name text NOT NULL,
  operation text NOT NULL,
  value numeric(12,4) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3.20 ai_models
CREATE TABLE ai_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  model_id text NOT NULL,
  display_name text NOT NULL,
  use_case text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  cost_per_1k_input numeric(8,6),
  cost_per_1k_output numeric(8,6),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, model_id, use_case)
);

-- 3.21 shipments
CREATE TABLE shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_type text NOT NULL,
  carrier_id uuid REFERENCES carriers(id) ON DELETE RESTRICT,
  origin text,
  destination text,
  tracking_number text,
  label_storage_path text,
  status text NOT NULL,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_shipments_status ON shipments(status);
CREATE INDEX idx_shipments_tracking ON shipments(tracking_number) WHERE tracking_number IS NOT NULL;

-- 3.22 shipment_sub_orders (junction)
CREATE TABLE shipment_sub_orders (
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  sub_order_id uuid NOT NULL REFERENCES sub_orders(id) ON DELETE CASCADE,
  PRIMARY KEY (shipment_id, sub_order_id)
);

-- 3.24 hourly_rates
CREATE TABLE hourly_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount numeric(8,2) NOT NULL,
  currency currency_code NOT NULL,
  effective_from date NOT NULL,
  set_by uuid REFERENCES profiles(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_hourly_rates_user_date ON hourly_rates(user_id, effective_from DESC);

-- 3.25 time_entries
CREATE TABLE time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  hubstaff_entry_id text UNIQUE,
  source text NOT NULL DEFAULT 'hubstaff',
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  duration_seconds integer NOT NULL,
  notes text,
  raw_payload jsonb,
  pulled_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_time_entries_user_started ON time_entries(user_id, started_at DESC);

-- 3.26 notifications
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  severity notification_severity NOT NULL,
  title text NOT NULL,
  description text,
  resource_type text,
  resource_id uuid,
  href text,
  metadata jsonb DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_unread
  ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_user_recent ON notifications(user_id, created_at DESC);

-- 3.27 api_logs (no UI; metadata only)
CREATE TABLE api_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  service text NOT NULL,
  endpoint text NOT NULL,
  method text NOT NULL,
  status text NOT NULL,
  http_status integer,
  latency_ms integer,
  cost_usd numeric(8,6),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_logs_service_created ON api_logs(service, created_at DESC);
CREATE INDEX idx_api_logs_status ON api_logs(status, created_at DESC);

-- 3.28 settings
CREATE TABLE settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_by uuid REFERENCES profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.29 activity_log
CREATE TABLE activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text,
  resource_id uuid,
  description text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_log_recent ON activity_log(created_at DESC);
CREATE INDEX idx_activity_log_user ON activity_log(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_activity_log_resource ON activity_log(resource_type, resource_id);
CREATE INDEX idx_activity_log_action ON activity_log(action);
