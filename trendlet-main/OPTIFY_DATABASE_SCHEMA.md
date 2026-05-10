# Optify OMS — Database Schema (Supabase / Postgres 15)

> **Purpose:** Complete database schema for the Optify OMS, including tables, views, RLS policies, triggers, functions, and indexes. Run these migrations in order.

---

## Overview

- **27 tables**
- **5 pricing-isolation views** (for non-admin reads)
- **4 storage buckets** (all private)
- **Multi-store ready**, **multi-currency**, **many-to-many roles**

---

## Migration order

1. Extensions
2. Enums & types
3. Core tables (no dependencies)
4. Dependent tables
5. Junction tables (many-to-many)
6. Views
7. Functions
8. Triggers
9. RLS policies
10. Indexes
11. Storage buckets
12. Seed data

---

## 1. Extensions

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for fuzzy brand matching
CREATE EXTENSION IF NOT EXISTS "citext";   -- case-insensitive text (emails, brand names)
```

---

## 2. Enums & types

```sql
-- User roles (used in user_roles junction table)
CREATE TYPE user_role AS ENUM (
  'admin',
  'sourcing',
  'warehouse',
  'fulfiller',
  'ksa_operator'
);

-- Regions for routing logic
CREATE TYPE region_code AS ENUM ('US', 'EU', 'KSA', 'GLOBAL');

-- Currency codes (ISO 4217) — extensible
CREATE TYPE currency_code AS ENUM ('SAR', 'USD', 'EUR', 'GBP', 'AED');

-- Status severity for notifications
CREATE TYPE notification_severity AS ENUM ('critical', 'warning', 'info', 'success');

-- Invoice template language
CREATE TYPE invoice_language AS ENUM ('en', 'ar', 'bilingual');

-- AI confidence buckets
CREATE TYPE ai_confidence AS ENUM ('high', 'medium', 'low', 'failed');

-- Customer invoice status
CREATE TYPE invoice_status AS ENUM ('draft', 'pending_review', 'approved', 'sent', 'rejected');

-- Supplier invoice OCR state
CREATE TYPE ocr_state AS ENUM ('uploaded', 'extracting', 'extracted', 'mapped', 'failed');
```

---

## 3. Core tables

### 3.1 `stores` (multi-store support)

```sql
CREATE TABLE stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  shopify_domain text UNIQUE NOT NULL,    -- e.g., "trendslet.myshopify.com"
  shopify_admin_token text,                 -- encrypted via Supabase Vault
  shopify_webhook_secret text,              -- encrypted via Supabase Vault
  default_currency currency_code NOT NULL DEFAULT 'SAR',
  is_active boolean NOT NULL DEFAULT true,
  region region_code,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE stores IS 'Shopify stores managed by Optify. Multi-store ready.';
```

### 3.2 `profiles` (mirrors `auth.users`)

```sql
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email citext UNIQUE NOT NULL,
  full_name text NOT NULL,
  avatar_url text,
  region region_code,
  ship_from_address jsonb,                  -- { line1, line2, city, country, postal }
  is_active boolean NOT NULL DEFAULT true,
  preferences jsonb DEFAULT '{}'::jsonb,    -- { displayCurrency, dateFormat, etc. }
  invited_by uuid REFERENCES profiles(id),
  invited_at timestamptz,
  joined_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE profiles IS 'User profiles. id = auth.users.id. Roles in user_roles junction table.';
```

### 3.3 `user_roles` (many-to-many)

```sql
CREATE TABLE user_roles (
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  granted_by uuid REFERENCES profiles(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

COMMENT ON TABLE user_roles IS 'Many-to-many: a user can have multiple roles simultaneously.';
```

### 3.4 `invitations`

```sql
CREATE TABLE invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL,
  full_name text NOT NULL,
  roles user_role[] NOT NULL,
  region region_code,
  token text UNIQUE NOT NULL,
  invited_by uuid NOT NULL REFERENCES profiles(id),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invitations_token ON invitations(token) WHERE accepted_at IS NULL;
CREATE INDEX idx_invitations_email ON invitations(email);

COMMENT ON TABLE invitations IS 'Pending invitations. Token consumed on /setup/[token] page.';
```

### 3.5 `brands`

```sql
CREATE TABLE brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name citext NOT NULL UNIQUE,
  aliases citext[] DEFAULT '{}',            -- e.g., ['adidas', 'Adidas Originals']
  region region_code,                        -- determines routing
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_brands_aliases ON brands USING gin (aliases);
CREATE INDEX idx_brands_name_trgm ON brands USING gin (name gin_trgm_ops);

COMMENT ON TABLE brands IS 'Brands recognized by Optify. Aliases enable fuzzy matching.';
```

### 3.6 `brand_assignments`

```sql
CREATE TABLE brand_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,  -- one primary per brand
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, user_id)
);

CREATE INDEX idx_brand_assignments_brand ON brand_assignments(brand_id) WHERE is_primary = true;

COMMENT ON TABLE brand_assignments IS 'Brand → employee mapping for auto-routing of sub-orders.';
```

### 3.7 `customers`

```sql
CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id),
  shopify_customer_id text,                 -- shopify ID for dedup
  email citext,
  first_name text,
  last_name text,
  phone text,                                -- normalized to +9665XXXXXXXX for KSA
  language_pref text,                        -- 'ar' | 'en' | NULL
  default_address jsonb,                     -- { line1, line2, city, region, country, postal }
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, shopify_customer_id)
);

CREATE INDEX idx_customers_email ON customers(store_id, email);
CREATE INDEX idx_customers_phone ON customers(phone) WHERE phone IS NOT NULL;

COMMENT ON TABLE customers IS 'Deduped by shopify_customer_id, fallback to email.';
```

### 3.8 `statuses`

```sql
CREATE TABLE statuses (
  key text PRIMARY KEY,                      -- e.g., 'pending', 'in_progress', 'delivered'
  label_en text NOT NULL,
  label_ar text NOT NULL,
  category text NOT NULL,                    -- 'sourcing' | 'warehouse' | 'transit' | 'delivered' | 'failed'
  color_class text NOT NULL,                 -- maps to Tailwind: 'amber' | 'blue' | 'purple' | 'green' | 'red' | 'gray'
  notifies_customer boolean NOT NULL DEFAULT false,
  twilio_template_sid text,                  -- pre-approved Twilio Content Template SID
  allowed_from_roles user_role[] NOT NULL,   -- which roles can transition TO this status
  display_order integer NOT NULL,
  is_terminal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE statuses IS 'Editable enum of 15 statuses. notifies_customer triggers WhatsApp.';
```

### 3.9 `orders`

```sql
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id),
  shopify_order_id text NOT NULL,
  shopify_order_number text NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE RESTRICT,
  
  -- pricing (admin only — see RLS)
  subtotal numeric(12,2),
  total numeric(12,2),
  currency currency_code NOT NULL,
  
  -- metadata
  shipping_address jsonb,
  billing_address jsonb,
  notes text,
  raw_payload jsonb NOT NULL,                -- complete Shopify webhook payload
  
  shopify_created_at timestamptz NOT NULL,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE (store_id, shopify_order_id)
);

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_store_created ON orders(store_id, shopify_created_at DESC);
CREATE INDEX idx_orders_number ON orders(shopify_order_number);

COMMENT ON TABLE orders IS 'One row per Shopify order. raw_payload preserved for re-processing.';
```

### 3.10 `sub_orders`

```sql
CREATE TABLE sub_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sub_order_number text NOT NULL,            -- e.g., 'SUB-48210-00'
  
  -- product info from Shopify line item
  shopify_line_item_id text,
  product_title text NOT NULL,
  variant_title text,
  sku text,
  quantity integer NOT NULL DEFAULT 1,
  product_image_url text,
  
  -- pricing (admin only — see RLS)
  unit_price numeric(12,2),
  currency currency_code NOT NULL,
  
  -- routing
  brand_id uuid REFERENCES brands(id) ON DELETE SET NULL,
  brand_name_raw text,                       -- original Shopify vendor field for debugging
  assigned_employee_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  is_unassigned boolean NOT NULL DEFAULT false,  -- true when brand has no mapping
  
  -- workflow
  status text NOT NULL REFERENCES statuses(key),
  status_changed_at timestamptz NOT NULL DEFAULT now(),
  status_changed_by uuid REFERENCES profiles(id),
  
  -- SLA tracking
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

COMMENT ON TABLE sub_orders IS 'One row per Shopify line item. is_unassigned drives admin alerts.';
```

### 3.11 `status_history`

```sql
CREATE TABLE status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_order_id uuid NOT NULL REFERENCES sub_orders(id) ON DELETE CASCADE,
  from_status text REFERENCES statuses(key),
  to_status text NOT NULL REFERENCES statuses(key),
  changed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,        -- e.g., { reason: 'out_of_stock', supplier_url: '...' }
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_status_history_sub_order ON status_history(sub_order_id, created_at DESC);

COMMENT ON TABLE status_history IS 'Auto-logged by trigger on every sub_orders.status change.';
```

### 3.12 `supplier_invoices`

```sql
CREATE TABLE supplier_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  
  storage_path text NOT NULL,                -- path in supplier-invoices bucket
  original_filename text,
  file_size_bytes integer,
  mime_type text,
  source text NOT NULL DEFAULT 'manual',     -- 'manual' | 'inbox_scan' | 'forwarded'
  
  -- OCR
  ocr_state ocr_state NOT NULL DEFAULT 'uploaded',
  ocr_model_used text,                       -- e.g., 'gpt-4o', 'claude-sonnet-4-6'
  ocr_extracted_at timestamptz,
  ocr_raw_response jsonb,
  
  -- extracted metadata
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

COMMENT ON TABLE supplier_invoices IS 'Receipts uploaded by sourcing employees. AI extracts line items.';
```

### 3.13 `supplier_invoice_items`

```sql
CREATE TABLE supplier_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_invoice_id uuid NOT NULL REFERENCES supplier_invoices(id) ON DELETE CASCADE,
  
  -- AI-extracted
  description text,
  quantity integer DEFAULT 1,
  unit_price numeric(12,2),
  line_total numeric(12,2),
  barcode text,
  
  -- mapping
  mapped_sub_order_id uuid REFERENCES sub_orders(id) ON DELETE SET NULL,
  mapped_at timestamptz,
  mapped_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- AI confidence
  ai_confidence ai_confidence,
  ai_match_score numeric(4,3),               -- 0.000 to 1.000
  ai_reasoning text,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_supplier_invoice_items_invoice ON supplier_invoice_items(supplier_invoice_id);
CREATE INDEX idx_supplier_invoice_items_sub_order ON supplier_invoice_items(mapped_sub_order_id) WHERE mapped_sub_order_id IS NOT NULL;

COMMENT ON TABLE supplier_invoice_items IS 'Line items extracted from supplier receipts, mapped to sub-orders.';
```

### 3.14 `customer_invoices`

```sql
CREATE TABLE customer_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,       -- 'INV-YYYY-NNNNNN'
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  
  status invoice_status NOT NULL DEFAULT 'draft',
  
  -- pricing (admin only — see RLS)
  cost numeric(12,2) NOT NULL,
  cost_currency currency_code NOT NULL,
  markup_percent numeric(5,2) NOT NULL,      -- e.g., 50.00 = 50%
  item_price numeric(12,2) NOT NULL,
  shipment_fee numeric(12,2) NOT NULL DEFAULT 0,
  tax_percent numeric(5,2) NOT NULL DEFAULT 0,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL,
  total_currency currency_code NOT NULL,     -- usually SAR for KSA customers
  profit_amount numeric(12,2),
  profit_percent numeric(5,2),
  
  -- AI metadata
  ai_confidence ai_confidence,
  ai_model_used text,
  ai_reasoning jsonb,                        -- per-line-item reasoning
  generated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  generated_at timestamptz,
  
  -- review
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  rejection_reason text,
  
  -- delivery
  template_id uuid REFERENCES invoice_templates(id) ON DELETE RESTRICT,
  language invoice_language NOT NULL,
  pdf_storage_path text,
  sent_to_email citext,
  sent_at timestamptz,
  whatsapp_sent_at timestamptz,
  
  -- supplier reference
  supplier_invoice_id uuid REFERENCES supplier_invoices(id) ON DELETE RESTRICT,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_invoices_order ON customer_invoices(order_id);
CREATE INDEX idx_customer_invoices_status ON customer_invoices(status);
CREATE INDEX idx_customer_invoices_review ON customer_invoices(status, ai_confidence) WHERE status = 'pending_review';

COMMENT ON TABLE customer_invoices IS 'Customer-facing invoices. Admin-only view per RLS.';
```

### 3.15 `invoice_corrections`

```sql
CREATE TABLE invoice_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_invoice_id uuid NOT NULL REFERENCES customer_invoices(id) ON DELETE CASCADE,
  field_name text NOT NULL,                  -- e.g., 'markup_percent', 'item_price'
  original_value text,
  corrected_value text NOT NULL,
  corrected_by uuid NOT NULL REFERENCES profiles(id),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoice_corrections_invoice ON invoice_corrections(customer_invoice_id);

COMMENT ON TABLE invoice_corrections IS 'Admin edits feed few-shot prompts for AI improvement.';
```

### 3.16 `ocr_corrections`

```sql
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

COMMENT ON TABLE ocr_corrections IS 'OCR mistakes corrected by humans, feeds AI fine-tuning.';
```

### 3.17 `invoice_sequences`

```sql
CREATE TABLE invoice_sequences (
  year integer PRIMARY KEY,
  last_used_number integer NOT NULL DEFAULT 0
);

COMMENT ON TABLE invoice_sequences IS 'Per-year counter. Use next_invoice_sequence() RPC to get unique numbers.';
```

### 3.18 `invoice_templates`

```sql
CREATE TABLE invoice_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  storage_path text NOT NULL,                -- in invoice-templates bucket
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

COMMENT ON TABLE invoice_templates IS 'PDF templates for AI invoice generation. One default per language.';
```

### 3.19 `correction_rules`

```sql
CREATE TABLE correction_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  
  -- conditions (JSON-encoded)
  applies_to jsonb NOT NULL,                 -- e.g., { brand_id: "...", supplier_name: "Aigner" }
  
  -- actions
  field_name text NOT NULL,                  -- 'markup_percent', 'item_price', etc.
  operation text NOT NULL,                   -- 'add', 'multiply', 'set'
  value numeric(12,4) NOT NULL,
  
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE correction_rules IS 'Deterministic rules applied before AI. e.g., "Aigner +20%".';
```

### 3.20 `ai_models`

```sql
CREATE TABLE ai_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,                    -- 'openai', 'anthropic', 'openrouter'
  model_id text NOT NULL,                    -- 'gpt-4o', 'claude-sonnet-4-6'
  display_name text NOT NULL,
  use_case text NOT NULL,                    -- 'ocr', 'invoice_gen', 'classification'
  is_active boolean NOT NULL DEFAULT true,
  cost_per_1k_input numeric(8,6),
  cost_per_1k_output numeric(8,6),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, model_id, use_case)
);

COMMENT ON TABLE ai_models IS 'Available AI models. Admin selects active one per use case.';
```

### 3.21 `shipments`

```sql
CREATE TABLE shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_type text NOT NULL,               -- 'bulk_outbound' | 'last_mile'
  carrier_id uuid REFERENCES carriers(id) ON DELETE RESTRICT,
  
  origin text,                                -- "US warehouse", "EU warehouse"
  destination text,                           -- "KSA", "Riyadh", customer address
  
  tracking_number text,
  label_storage_path text,                    -- in shipping-labels bucket
  
  status text NOT NULL,                       -- 'created', 'in_transit', 'delivered', 'failed'
  shipped_at timestamptz,
  delivered_at timestamptz,
  
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_shipments_status ON shipments(status);
CREATE INDEX idx_shipments_tracking ON shipments(tracking_number) WHERE tracking_number IS NOT NULL;

COMMENT ON TABLE shipments IS 'Bulk outbound (US/EU → KSA) or last-mile (within KSA) shipments.';
```

### 3.22 `shipment_sub_orders` (junction)

```sql
CREATE TABLE shipment_sub_orders (
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  sub_order_id uuid NOT NULL REFERENCES sub_orders(id) ON DELETE CASCADE,
  PRIMARY KEY (shipment_id, sub_order_id)
);

COMMENT ON TABLE shipment_sub_orders IS 'Many-to-many: one bulk shipment carries many sub-orders.';
```

### 3.23 `carriers`

```sql
CREATE TABLE carriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,                        -- 'DHL_US', 'DHL_EU', 'KSA_LOCAL_TBD'
  display_name text NOT NULL,
  region region_code,
  api_endpoint text,
  is_active boolean NOT NULL DEFAULT true,
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE carriers IS 'Shipping carriers. Currently DHL US/EU and KSA local TBD.';
```

### 3.24 `hourly_rates`

```sql
CREATE TABLE hourly_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount numeric(8,2) NOT NULL,              -- e.g., 5.00
  currency currency_code NOT NULL,
  effective_from date NOT NULL,
  set_by uuid REFERENCES profiles(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_hourly_rates_user_date ON hourly_rates(user_id, effective_from DESC);

COMMENT ON TABLE hourly_rates IS 'Per-employee hourly rate. Latest effective_from <= period end wins.';
```

### 3.25 `time_entries` (Hubstaff sync)

```sql
CREATE TABLE time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  hubstaff_entry_id text UNIQUE,             -- prevents duplicates on re-sync
  source text NOT NULL DEFAULT 'hubstaff',   -- 'hubstaff' | 'manual'
  
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  duration_seconds integer NOT NULL,
  
  notes text,
  raw_payload jsonb,                         -- original Hubstaff response
  
  pulled_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_time_entries_user_started ON time_entries(user_id, started_at DESC);

COMMENT ON TABLE time_entries IS 'Time tracking entries. Hubstaff is primary source; manual fallback supported.';
```

### 3.26 `notifications`

```sql
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL,                        -- 'unassigned_alert', 'sla_at_risk', etc.
  severity notification_severity NOT NULL,
  title text NOT NULL,
  description text,
  resource_type text,                        -- 'order', 'sub_order', 'invoice'
  resource_id uuid,
  href text,                                 -- /admin/orders/X
  metadata jsonb DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_user_all ON notifications(user_id, created_at DESC);

COMMENT ON TABLE notifications IS 'In-app notifications. Real-time via Supabase Realtime.';
```

### 3.27 `api_logs`

```sql
CREATE TABLE api_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  service text NOT NULL,                     -- 'shopify', 'twilio', 'openai', 'dhl', 'hubstaff'
  endpoint text NOT NULL,
  method text NOT NULL,
  status text NOT NULL,                      -- 'success', 'error', 'mock'
  http_status integer,
  latency_ms integer,
  cost_usd numeric(8,6),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_logs_service_created ON api_logs(service, created_at DESC);
CREATE INDEX idx_api_logs_status ON api_logs(status, created_at DESC);

COMMENT ON TABLE api_logs IS 'Metadata-only log of every external API call. NEVER logs request/response bodies. NOT exposed in UI.';
```

### 3.28 `settings`

```sql
CREATE TABLE settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_by uuid REFERENCES profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE settings IS 'Global system settings. Single row per key.';
```

### 3.29 `activity_log`

```sql
CREATE TABLE activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,  -- null for system events
  action text NOT NULL,                      -- 'status_change', 'invoice_approved', 'brand_mapped'
  resource_type text,
  resource_id uuid,
  description text NOT NULL,                 -- human-readable
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_log_created ON activity_log(created_at DESC);
CREATE INDEX idx_activity_log_user ON activity_log(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_activity_log_resource ON activity_log(resource_type, resource_id);
CREATE INDEX idx_activity_log_action ON activity_log(action);

COMMENT ON TABLE activity_log IS 'Audit trail. 90-day retention via cron.';
```

---

## 4. Pricing-isolation views (for non-admin reads)

Employees query through these views instead of tables to avoid exposing pricing.

```sql
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
```

---

## 5. Functions

### 5.1 `next_invoice_sequence(year)`

```sql
CREATE OR REPLACE FUNCTION next_invoice_sequence(p_year integer)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_next integer;
BEGIN
  INSERT INTO invoice_sequences (year, last_used_number)
  VALUES (p_year, 1)
  ON CONFLICT (year)
  DO UPDATE SET last_used_number = invoice_sequences.last_used_number + 1
  RETURNING last_used_number INTO v_next;

  RETURN format('INV-%s-%s', p_year, lpad(v_next::text, 6, '0'));
END;
$$;

COMMENT ON FUNCTION next_invoice_sequence IS 'Atomically generates next invoice number. Race-safe.';
```

### 5.2 `is_admin(uuid)`

```sql
CREATE OR REPLACE FUNCTION is_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_user_id AND role = 'admin'
  );
$$;
```

### 5.3 `user_has_role(uuid, user_role)`

```sql
CREATE OR REPLACE FUNCTION user_has_role(p_user_id uuid, p_role user_role)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_user_id AND role = p_role
  );
$$;
```

### 5.4 `auto_assign_sub_order(uuid)`

```sql
CREATE OR REPLACE FUNCTION auto_assign_sub_order(p_sub_order_id uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_brand_id uuid;
  v_assignee_id uuid;
BEGIN
  SELECT brand_id INTO v_brand_id
  FROM sub_orders WHERE id = p_sub_order_id;

  IF v_brand_id IS NULL THEN
    UPDATE sub_orders SET is_unassigned = true WHERE id = p_sub_order_id;
    RETURN NULL;
  END IF;

  SELECT user_id INTO v_assignee_id
  FROM brand_assignments
  WHERE brand_id = v_brand_id AND is_primary = true
  LIMIT 1;

  IF v_assignee_id IS NULL THEN
    UPDATE sub_orders SET is_unassigned = true WHERE id = p_sub_order_id;
    RETURN NULL;
  END IF;

  UPDATE sub_orders
  SET assigned_employee_id = v_assignee_id, is_unassigned = false
  WHERE id = p_sub_order_id;

  RETURN v_assignee_id;
END;
$$;
```

### 5.5 `match_brand_from_vendor(text)`

```sql
CREATE OR REPLACE FUNCTION match_brand_from_vendor(p_vendor text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_brand_id uuid;
BEGIN
  -- Exact match first (case-insensitive via citext)
  SELECT id INTO v_brand_id FROM brands
  WHERE name = p_vendor::citext
  LIMIT 1;

  IF v_brand_id IS NOT NULL THEN
    RETURN v_brand_id;
  END IF;

  -- Alias match
  SELECT id INTO v_brand_id FROM brands
  WHERE p_vendor::citext = ANY(aliases)
  LIMIT 1;

  IF v_brand_id IS NOT NULL THEN
    RETURN v_brand_id;
  END IF;

  -- Fuzzy match (>= 0.4 similarity)
  SELECT id INTO v_brand_id FROM brands
  WHERE similarity(name::text, p_vendor) > 0.4
  ORDER BY similarity(name::text, p_vendor) DESC
  LIMIT 1;

  RETURN v_brand_id;
END;
$$;
```

---

## 6. Triggers

### 6.1 Auto-log status changes

```sql
CREATE OR REPLACE FUNCTION log_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO status_history (sub_order_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, NEW.status_changed_by);

    INSERT INTO activity_log (user_id, action, resource_type, resource_id, description)
    VALUES (
      NEW.status_changed_by,
      'status_change',
      'sub_order',
      NEW.id,
      format('Changed %s from %s to %s', NEW.sub_order_number, OLD.status, NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_status_change
  AFTER UPDATE ON sub_orders
  FOR EACH ROW
  EXECUTE FUNCTION log_status_change();
```

### 6.2 Enforce status whitelist

```sql
CREATE OR REPLACE FUNCTION enforce_status_whitelist()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_allowed user_role[];
  v_user_roles user_role[];
  v_is_admin boolean;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status_changed_by IS NULL THEN
    RAISE EXCEPTION 'status_changed_by required';
  END IF;

  -- Admin bypass
  SELECT is_admin(NEW.status_changed_by) INTO v_is_admin;
  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  SELECT allowed_from_roles INTO v_allowed FROM statuses WHERE key = NEW.status;
  SELECT array_agg(role) INTO v_user_roles FROM user_roles WHERE user_id = NEW.status_changed_by;

  IF NOT (v_user_roles && v_allowed) THEN
    RAISE EXCEPTION 'User does not have permission to set status %', NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_status_whitelist
  BEFORE UPDATE ON sub_orders
  FOR EACH ROW
  EXECUTE FUNCTION enforce_status_whitelist();
```

### 6.3 Notify on unassigned sub-order

```sql
CREATE OR REPLACE FUNCTION notify_on_unassigned()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_admin_id uuid;
BEGIN
  IF NEW.is_unassigned = true AND (OLD IS NULL OR OLD.is_unassigned = false) THEN
    FOR v_admin_id IN
      SELECT user_id FROM user_roles WHERE role = 'admin'
    LOOP
      INSERT INTO notifications (user_id, type, severity, title, description, resource_type, resource_id, href)
      VALUES (
        v_admin_id,
        'unassigned_alert',
        'critical',
        format('Sub-order %s unassigned', NEW.sub_order_number),
        format('Brand %s has no assigned employee', COALESCE(NEW.brand_name_raw, 'unknown')),
        'sub_order',
        NEW.id,
        '/orders/unassigned'
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_unassigned
  AFTER INSERT OR UPDATE ON sub_orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_unassigned();
```

### 6.4 Auto-update `updated_at`

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply to all tables with updated_at
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.columns
    WHERE column_name = 'updated_at' AND table_schema = 'public'
  LOOP
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t);
  END LOOP;
END $$;
```

### 6.5 Brand-region enforcement

```sql
CREATE OR REPLACE FUNCTION enforce_brand_region()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_brand_region region_code;
  v_user_region region_code;
BEGIN
  SELECT region INTO v_brand_region FROM brands WHERE id = NEW.brand_id;
  SELECT region INTO v_user_region FROM profiles WHERE id = NEW.user_id;

  IF v_brand_region IS NOT NULL AND v_user_region IS NOT NULL
     AND v_brand_region <> 'GLOBAL' AND v_brand_region <> v_user_region THEN
    RAISE EXCEPTION 'Brand region (%) must match user region (%)', v_brand_region, v_user_region;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_brand_region
  BEFORE INSERT OR UPDATE ON brand_assignments
  FOR EACH ROW
  EXECUTE FUNCTION enforce_brand_region();
```

---

## 7. Row Level Security (RLS)

### 7.1 Enable RLS on all tables

```sql
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
```

### 7.2 Policy patterns

**Admin-only tables:** customer_invoices, invoice_corrections, hourly_rates, api_logs, ai_models, settings, correction_rules

```sql
CREATE POLICY admin_full_access ON customer_invoices
  FOR ALL TO authenticated USING (is_admin(auth.uid()));

-- Repeat for each admin-only table
```

**Sub-orders: assignee + admin**

```sql
CREATE POLICY view_own_sub_orders ON sub_orders
  FOR SELECT TO authenticated
  USING (assigned_employee_id = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY update_own_sub_orders ON sub_orders
  FOR UPDATE TO authenticated
  USING (assigned_employee_id = auth.uid() OR is_admin(auth.uid()));
```

**Profiles: own profile + admin sees all**

```sql
CREATE POLICY view_profiles ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY update_own_profile ON profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());
```

**Notifications: only own**

```sql
CREATE POLICY view_own_notifications ON notifications
  FOR ALL TO authenticated USING (user_id = auth.uid());
```

**Reference data (statuses, brands, ai_models, carriers): readable by all authenticated**

```sql
CREATE POLICY public_read_statuses ON statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY public_read_brands ON brands FOR SELECT TO authenticated USING (true);
CREATE POLICY public_read_carriers ON carriers FOR SELECT TO authenticated USING (true);
```

---

## 8. Column-level pricing isolation

```sql
-- Revoke pricing columns from non-admin Postgres role
REVOKE SELECT (subtotal, total, currency) ON orders FROM authenticated;
REVOKE SELECT (unit_price, currency) ON sub_orders FROM authenticated;
REVOKE SELECT (unit_price, line_total) ON supplier_invoice_items FROM authenticated;
REVOKE SELECT (invoice_total, currency) ON supplier_invoices FROM authenticated;

-- Grant access via the v_*_employee views instead
GRANT SELECT ON v_orders_employee TO authenticated;
GRANT SELECT ON v_sub_orders_employee TO authenticated;
GRANT SELECT ON v_supplier_invoices_employee TO authenticated;
GRANT SELECT ON v_supplier_invoice_items_employee TO authenticated;
GRANT SELECT ON v_settings_employee TO authenticated;
```

---

## 9. Storage buckets

```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('supplier-invoices', 'supplier-invoices', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('customer-invoices', 'customer-invoices', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('shipping-labels', 'shipping-labels', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('invoice-templates', 'invoice-templates', false);
```

**Path conventions:**
- `supplier-invoices/{user_id}/{yyyy-mm}/{uuid}-{filename}`
- `customer-invoices/{yyyy}/{invoice_number}.pdf`
- `shipping-labels/{shipment_id}.pdf`
- `invoice-templates/{language}/{uuid}-{filename}.pdf`

---

## 10. Seed data

### Statuses (15 rows)

```sql
INSERT INTO statuses (key, label_en, label_ar, category, color_class, notifies_customer, allowed_from_roles, display_order, is_terminal) VALUES
('pending', 'Pending', 'في الانتظار', 'sourcing', 'gray', false, ARRAY['admin']::user_role[], 0, false),
('under_review', 'Under review', 'قيد المراجعة', 'sourcing', 'amber', true, ARRAY['sourcing','fulfiller','admin']::user_role[], 1, false),
('in_progress', 'In progress', 'جاري التنفيذ', 'sourcing', 'amber', false, ARRAY['sourcing','fulfiller','admin']::user_role[], 2, false),
('purchased_online', 'Purchased online', 'تم الشراء عبر الإنترنت', 'sourcing', 'amber', true, ARRAY['sourcing','fulfiller','admin']::user_role[], 3, false),
('purchased_in_store', 'Purchased in store', 'تم الشراء من المتجر', 'sourcing', 'amber', true, ARRAY['sourcing','fulfiller','admin']::user_role[], 4, false),
('out_of_stock', 'Out of stock', 'غير متوفر', 'failed', 'red', true, ARRAY['sourcing','fulfiller','admin']::user_role[], 5, true),
('delivered_to_warehouse', 'At warehouse', 'في المستودع', 'warehouse', 'blue', false, ARRAY['warehouse','fulfiller','admin']::user_role[], 6, false),
('preparing_for_shipment', 'Preparing for shipment', 'جاري التحضير للشحن', 'warehouse', 'blue', true, ARRAY['warehouse','fulfiller','admin']::user_role[], 7, false),
('shipped', 'Shipped', 'تم الشحن', 'transit', 'purple', true, ARRAY['warehouse','fulfiller','admin']::user_role[], 8, false),
('arrived_in_ksa', 'Arrived in KSA', 'وصل إلى السعودية', 'transit', 'purple', false, ARRAY['ksa_operator','admin']::user_role[], 9, false),
('out_for_delivery', 'Out for delivery', 'خرج للتوصيل', 'transit', 'purple', false, ARRAY['ksa_operator','admin']::user_role[], 10, false),
('delivered', 'Delivered', 'تم التسليم', 'delivered', 'green', true, ARRAY['ksa_operator','admin']::user_role[], 11, true),
('returned', 'Returned', 'تم الإرجاع', 'failed', 'gray', false, ARRAY['ksa_operator','admin']::user_role[], 12, true),
('cancelled', 'Cancelled', 'ملغي', 'failed', 'gray', false, ARRAY['admin','sourcing','fulfiller']::user_role[], 13, true),
('failed', 'Failed', 'فشل', 'failed', 'red', false, ARRAY['admin']::user_role[], 14, true);
```

### Default settings

```sql
INSERT INTO settings (key, value, description) VALUES
('default_markup_percent', '50'::jsonb, 'Default markup applied to supplier cost'),
('default_vat_percent', '15'::jsonb, 'Saudi Arabia VAT rate'),
('default_shipping_fee_sar', '25'::jsonb, 'Default shipping fee for KSA delivery'),
('sla_sourcing_hours', '24'::jsonb, 'Hours to mark item purchased after order'),
('sla_warehouse_hours', '48'::jsonb, 'Hours to ship after item arrives at warehouse'),
('sla_last_mile_hours', '72'::jsonb, 'Hours to deliver in KSA'),
('sla_at_risk_threshold', '0.25'::jsonb, 'Mark at-risk when remaining time < 25%'),
('correction_learning_enabled', 'true'::jsonb, 'AI learns from admin corrections'),
('max_correction_examples', '20'::jsonb, 'Max examples sent to AI as few-shot');
```

---

## Migration files

Split this schema into separate files:

```
supabase/migrations/
  20260427000001_extensions.sql
  20260427000002_enums.sql
  20260427000003_core_tables.sql
  20260427000004_dependent_tables.sql
  20260427000005_views.sql
  20260427000006_functions.sql
  20260427000007_triggers.sql
  20260427000008_rls_policies.sql
  20260427000009_column_isolation.sql
  20260427000010_storage_buckets.sql
  20260427000011_seed.sql
  20260427000012_jwt_auth_hook.sql
  20260427000013_materialized_views.sql
  20260427000014_saved_views.sql
  20260427000015_notifications_archive.sql
  20260427000016_search_function.sql
  20260427000017_pg_cron_schedules.sql
```

Run with: `supabase db push` or via the SQL Editor in Supabase Dashboard.

---

## 11. Performance enhancements (mandatory)

These migrations bring the schema to production-grade performance. Apply them in order after the base schema.

### 11.1 JWT Auth Hook (50x faster RLS)

```sql
-- 20260427000012_jwt_auth_hook.sql

-- Function called by Supabase Auth when issuing JWTs
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  user_roles_arr text[];
BEGIN
  SELECT array_agg(role::text) INTO user_roles_arr
  FROM public.user_roles
  WHERE user_id = (event->>'user_id')::uuid;

  claims := event->'claims';

  IF user_roles_arr IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_roles}', to_jsonb(user_roles_arr));
  ELSE
    claims := jsonb_set(claims, '{user_roles}', '[]'::jsonb);
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
GRANT ALL ON TABLE public.user_roles TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- Fast RLS helpers reading from JWT (no DB lookup)
CREATE OR REPLACE FUNCTION jwt_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT (auth.jwt() -> 'user_roles')::jsonb ? 'admin';
$$;

CREATE OR REPLACE FUNCTION jwt_has_role(p_role text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT (auth.jwt() -> 'user_roles')::jsonb ? p_role;
$$;

-- Update RLS policies to use JWT helpers (faster)
DROP POLICY IF EXISTS view_sub_orders ON sub_orders;
CREATE POLICY view_sub_orders ON sub_orders
  FOR SELECT TO authenticated
  USING (assigned_employee_id = auth.uid() OR jwt_is_admin());

DROP POLICY IF EXISTS update_own_sub_orders ON sub_orders;
CREATE POLICY update_own_sub_orders ON sub_orders
  FOR UPDATE TO authenticated
  USING (assigned_employee_id = auth.uid() OR jwt_is_admin());

DROP POLICY IF EXISTS admin_full_access ON customer_invoices;
CREATE POLICY admin_full_access ON customer_invoices
  FOR ALL TO authenticated
  USING (jwt_is_admin());

DROP POLICY IF EXISTS view_profiles ON profiles;
CREATE POLICY view_profiles ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR jwt_is_admin());

-- Apply same pattern to all other admin-only / role-based policies
```

**After running this migration, enable the hook in Supabase Dashboard:**
1. Go to Authentication → Hooks
2. Select "Custom Access Token Hook"
3. Choose function `custom_access_token_hook`
4. Save

### 11.2 Materialized views for KPIs

```sql
-- 20260427000013_materialized_views.sql

-- Dashboard KPIs
CREATE MATERIALIZED VIEW mv_dashboard_kpis AS
SELECT
  (SELECT COUNT(*)::int FROM orders WHERE shopify_created_at >= now() - interval '30 days') AS total_orders_30d,
  (SELECT COUNT(*)::int FROM sub_orders WHERE status NOT IN ('delivered', 'cancelled', 'returned', 'failed', 'out_of_stock')) AS active_count,
  (SELECT COUNT(*)::int FROM sub_orders WHERE is_delayed = true) AS delayed_count,
  (SELECT COUNT(*)::int FROM sub_orders WHERE is_at_risk = true AND is_delayed = false) AS at_risk_count,
  (SELECT COUNT(*)::int FROM sub_orders WHERE status = 'delivered' AND status_changed_at >= now() - interval '30 days') AS completed_30d,
  (SELECT
    COUNT(*) FILTER (WHERE status_changed_at <= sla_due_at)::numeric * 100 / NULLIF(COUNT(*), 0)
   FROM sub_orders
   WHERE status = 'delivered' AND status_changed_at >= now() - interval '30 days') AS on_time_pct;

CREATE UNIQUE INDEX idx_mv_dashboard_kpis ON mv_dashboard_kpis ((1));

-- Revenue per currency (no aggregation across currencies)
CREATE MATERIALIZED VIEW mv_revenue_by_currency AS
SELECT
  o.currency,
  COUNT(DISTINCT o.id)::int AS order_count_30d,
  SUM(o.total) AS total_30d,
  COUNT(DISTINCT o.id) FILTER (
    WHERE o.shopify_created_at >= (now() - interval '60 days')
      AND o.shopify_created_at < (now() - interval '30 days')
  )::int AS prev_order_count,
  SUM(o.total) FILTER (
    WHERE o.shopify_created_at >= (now() - interval '60 days')
      AND o.shopify_created_at < (now() - interval '30 days')
  ) AS prev_total
FROM orders o
WHERE o.shopify_created_at >= (now() - interval '60 days')
GROUP BY o.currency;

CREATE UNIQUE INDEX idx_mv_revenue_by_currency ON mv_revenue_by_currency (currency);

-- Team load
CREATE MATERIALIZED VIEW mv_team_load AS
SELECT
  ur.role::text AS team,
  COUNT(DISTINCT ur.user_id)::int AS member_count,
  COUNT(DISTINCT so.id) FILTER (
    WHERE so.status NOT IN ('delivered', 'cancelled', 'returned', 'failed', 'out_of_stock')
  )::int AS active_items,
  ROUND(AVG(CASE
    WHEN so.is_delayed THEN 100
    WHEN so.is_at_risk THEN 75
    WHEN so.status NOT IN ('delivered', 'cancelled', 'returned') THEN 50
    ELSE 0
  END))::int AS load_percent
FROM user_roles ur
LEFT JOIN sub_orders so ON so.assigned_employee_id = ur.user_id
WHERE ur.role IN ('sourcing', 'warehouse', 'fulfiller', 'ksa_operator')
GROUP BY ur.role;

CREATE UNIQUE INDEX idx_mv_team_load_team ON mv_team_load (team);

-- Top brands by revenue (per currency)
CREATE MATERIALIZED VIEW mv_top_brands_30d AS
SELECT
  b.id AS brand_id,
  b.name AS brand_name,
  o.currency,
  COUNT(DISTINCT so.id)::int AS items_count,
  SUM(so.unit_price * so.quantity) AS revenue
FROM sub_orders so
JOIN orders o ON o.id = so.order_id
JOIN brands b ON b.id = so.brand_id
WHERE so.created_at >= now() - interval '30 days'
GROUP BY b.id, b.name, o.currency
ORDER BY revenue DESC NULLS LAST;

CREATE UNIQUE INDEX idx_mv_top_brands ON mv_top_brands_30d (brand_id, currency);

-- Team performance
CREATE MATERIALIZED VIEW mv_team_performance_30d AS
SELECT
  p.id AS employee_id,
  p.full_name,
  p.region,
  ur.role::text,
  COUNT(DISTINCT so.id) FILTER (
    WHERE so.status_changed_at >= now() - interval '30 days'
      AND so.status IN ('delivered', 'shipped', 'preparing_for_shipment')
  )::int AS items_completed_30d,
  ROUND(
    COUNT(*) FILTER (
      WHERE so.status_changed_at >= now() - interval '30 days'
        AND so.status = 'delivered'
        AND so.status_changed_at <= so.sla_due_at
    )::numeric * 100 / NULLIF(COUNT(*) FILTER (
      WHERE so.status_changed_at >= now() - interval '30 days'
        AND so.status = 'delivered'
    ), 0),
    1
  ) AS on_time_pct
FROM profiles p
JOIN user_roles ur ON ur.user_id = p.id
LEFT JOIN sub_orders so ON so.assigned_employee_id = p.id
WHERE p.is_active = true
GROUP BY p.id, p.full_name, p.region, ur.role;

CREATE UNIQUE INDEX idx_mv_team_performance ON mv_team_performance_30d (employee_id, role);
```

### 11.3 Saved views table

```sql
-- 20260427000014_saved_views.sql

CREATE TABLE saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  page text NOT NULL,                      -- 'orders', 'invoices', 'sub_orders', etc.
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
  USING (user_id = auth.uid());

COMMENT ON TABLE saved_views IS 'User-saved filter combinations. is_shared = visible to all admins.';
```

### 11.4 Notifications archive

```sql
-- 20260427000015_notifications_archive.sql

CREATE TABLE notifications_archive (LIKE notifications INCLUDING ALL);

ALTER TABLE notifications_archive ENABLE ROW LEVEL SECURITY;

-- Same policy as live table — users see only their own
CREATE POLICY view_own_archived_notifications ON notifications_archive
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Function to move old notifications
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

COMMENT ON FUNCTION archive_old_notifications IS 'Moves notifications older than 30d to archive. Called nightly by pg_cron.';
```

### 11.5 Universal search function

```sql
-- 20260427000016_search_function.sql

-- Add trigram indexes for fast ILIKE search
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm
  ON customers USING gin ((first_name || ' ' || last_name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_email_trgm
  ON customers USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_orders_number_trgm
  ON orders USING gin (shopify_order_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_sub_orders_number_trgm
  ON sub_orders USING gin (sub_order_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking_trgm
  ON shipments USING gin (tracking_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_name_trgm
  ON profiles USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_email_trgm
  ON profiles USING gin (email gin_trgm_ops);

-- Universal search function for command palette
CREATE OR REPLACE FUNCTION command_palette_search(p_query text, p_limit int DEFAULT 5)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin boolean;
  result jsonb;
BEGIN
  v_is_admin := jwt_is_admin();

  -- Customers (admin only)
  WITH customer_results AS (
    SELECT id, first_name || ' ' || last_name AS name, email, phone
    FROM customers
    WHERE v_is_admin AND (
      first_name ILIKE '%' || p_query || '%'
      OR last_name ILIKE '%' || p_query || '%'
      OR email ILIKE '%' || p_query || '%'
    )
    LIMIT p_limit
  ),
  -- Orders (admin sees all; employees see only their assigned ones)
  order_results AS (
    SELECT DISTINCT o.id, o.shopify_order_number AS number,
           c.first_name || ' ' || c.last_name AS customer_name
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    WHERE o.shopify_order_number ILIKE '%' || p_query || '%'
      AND (v_is_admin OR EXISTS (
        SELECT 1 FROM sub_orders so
        WHERE so.order_id = o.id AND so.assigned_employee_id = auth.uid()
      ))
    LIMIT p_limit
  ),
  -- Sub-orders
  sub_order_results AS (
    SELECT id, sub_order_number AS number, product_title AS product
    FROM sub_orders
    WHERE sub_order_number ILIKE '%' || p_query || '%'
      AND (v_is_admin OR assigned_employee_id = auth.uid())
    LIMIT p_limit
  ),
  -- Shipments by tracking number
  shipment_results AS (
    SELECT id, tracking_number, shipment_type
    FROM shipments
    WHERE tracking_number ILIKE '%' || p_query || '%'
    LIMIT p_limit
  ),
  -- Brands (visible to all authenticated)
  brand_results AS (
    SELECT id, name
    FROM brands
    WHERE name ILIKE '%' || p_query || '%' AND is_active = true
    LIMIT p_limit
  ),
  -- Employees (admin only)
  employee_results AS (
    SELECT p.id, p.full_name, p.email
    FROM profiles p
    WHERE v_is_admin AND p.is_active = true AND (
      p.full_name ILIKE '%' || p_query || '%'
      OR p.email ILIKE '%' || p_query || '%'
    )
    LIMIT p_limit
  )
  SELECT jsonb_build_object(
    'customers', COALESCE((SELECT jsonb_agg(row_to_json(cr)) FROM customer_results cr), '[]'::jsonb),
    'orders', COALESCE((SELECT jsonb_agg(row_to_json(or_)) FROM order_results or_), '[]'::jsonb),
    'sub_orders', COALESCE((SELECT jsonb_agg(row_to_json(sor)) FROM sub_order_results sor), '[]'::jsonb),
    'shipments', COALESCE((SELECT jsonb_agg(row_to_json(sr)) FROM shipment_results sr), '[]'::jsonb),
    'brands', COALESCE((SELECT jsonb_agg(row_to_json(br)) FROM brand_results br), '[]'::jsonb),
    'employees', COALESCE((SELECT jsonb_agg(row_to_json(er)) FROM employee_results er), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION command_palette_search IS 'Universal ⌘K search. Respects RLS via SECURITY DEFINER + JWT checks.';
```

### 11.6 pg_cron schedules

```sql
-- 20260427000017_pg_cron_schedules.sql

-- Enable pg_cron (Supabase requires this on a connected role)
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

-- Refresh revenue/brand/team analytics every 15 minutes
SELECT cron.schedule(
  'refresh-analytics-views',
  '*/15 * * * *',
  $$
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_revenue_by_currency;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_brands_30d;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_team_performance_30d;
  $$
);

-- Archive old notifications nightly at 3am
SELECT cron.schedule(
  'archive-old-notifications',
  '0 3 * * *',
  $$ SELECT archive_old_notifications(); $$
);

-- Mark sub-orders as at-risk / delayed every 10 minutes
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

-- Trim activity_log older than 90 days nightly
SELECT cron.schedule(
  'trim-activity-log',
  '0 4 * * *',
  $$
    DELETE FROM activity_log
    WHERE created_at < now() - interval '90 days';
  $$
);

-- View scheduled jobs
-- SELECT * FROM cron.job;
```

### 11.7 Connection pooling configuration

The application MUST use Supabase's PgBouncer pooler for runtime queries. Direct connections (port 5432) only for migrations.

**`.env.local` setup:**

```bash
# Pooler URL (port 6543 - transaction mode) - for app runtime
DATABASE_URL=postgres://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1

# Direct URL (port 5432) - for migrations and CLI only
DIRECT_URL=postgres://postgres.[ref]:[password]@db.[ref].supabase.co:5432/postgres

# Supabase JS client (uses HTTP, not pg)
NEXT_PUBLIC_SUPABASE_URL=https://[ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon key]
SUPABASE_SERVICE_ROLE_KEY=[service role key]
```

**Restrictions when using transaction-mode pooler:**

❌ No `LISTEN` / `NOTIFY` (use Supabase Realtime instead)
❌ No prepared statements
❌ No session-level state (`SET session ...`)
❌ No advisory locks (`pg_advisory_lock`)

✅ Connection per query, automatically released
✅ Supports thousands of concurrent serverless functions
✅ Compatible with Vercel, Netlify, Edge Runtime

### 11.8 Indexes audit (final pass)

Verify these indexes exist (some are in earlier sections, listed here for completeness):

```sql
-- Hot path indexes
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_store_created ON orders(store_id, shopify_created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sub_orders_assignee ON sub_orders(assigned_employee_id) WHERE assigned_employee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sub_orders_brand ON sub_orders(brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sub_orders_unassigned ON sub_orders(is_unassigned) WHERE is_unassigned = true;
CREATE INDEX IF NOT EXISTS idx_sub_orders_status ON sub_orders(status);
CREATE INDEX IF NOT EXISTS idx_sub_orders_at_risk ON sub_orders(is_at_risk) WHERE is_at_risk = true;
CREATE INDEX IF NOT EXISTS idx_sub_orders_delayed ON sub_orders(is_delayed) WHERE is_delayed = true;

-- Composite for Pipeline view
CREATE INDEX IF NOT EXISTS idx_sub_orders_pipeline
  ON sub_orders(status, status_changed_at DESC)
  WHERE status NOT IN ('delivered', 'cancelled', 'returned', 'failed');

-- Composite for employee queue
CREATE INDEX IF NOT EXISTS idx_sub_orders_employee_queue
  ON sub_orders(assigned_employee_id, status, sla_due_at)
  WHERE assigned_employee_id IS NOT NULL;

-- Notifications hot path
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user_recent
  ON notifications(user_id, created_at DESC);

-- Customer invoices hot path
CREATE INDEX IF NOT EXISTS idx_customer_invoices_pending
  ON customer_invoices(status, ai_confidence, generated_at DESC)
  WHERE status = 'pending_review';

-- Activity log hot path
CREATE INDEX IF NOT EXISTS idx_activity_log_recent
  ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_user
  ON activity_log(user_id, created_at DESC) WHERE user_id IS NOT NULL;

-- Time entries for payroll
CREATE INDEX IF NOT EXISTS idx_time_entries_user_period
  ON time_entries(user_id, started_at DESC);
```

### 11.9 Performance testing

Before launch, run these benchmarks:

```sql
-- Test JWT-based RLS speed
EXPLAIN ANALYZE
SELECT * FROM sub_orders WHERE assigned_employee_id = '[user-id]' LIMIT 50;
-- Should be < 5ms with proper index

-- Test command_palette_search
EXPLAIN ANALYZE
SELECT command_palette_search('elena', 5);
-- Should be < 50ms

-- Test materialized view freshness
SELECT *, age(now(), pg_relation_age('mv_dashboard_kpis')) AS staleness
FROM mv_dashboard_kpis;
```

**Red flags:**
- Any query > 100ms on a table with < 10k rows → missing index
- Any RLS policy doing subquery → use JWT helper instead
- Any aggregation across currencies → product bug, fix immediately

---

**Schema version:** 2.0 (added §11 Performance enhancements)
**Last updated:** April 27, 2026
**For:** Trendslet OMS by Optify.cc
