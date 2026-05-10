-- Migration 03: Core tables (no inter-table FKs except to auth.users)
-- Order matters: referenced-before-referencing. Tables that depend on others
-- live in 04_dependent_tables.sql.

-- 3.1 stores
CREATE TABLE stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  shopify_domain text UNIQUE NOT NULL,
  shopify_admin_token text,
  shopify_webhook_secret text,
  default_currency currency_code NOT NULL DEFAULT 'SAR',
  is_active boolean NOT NULL DEFAULT true,
  region region_code,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE stores IS 'Shopify stores managed by Optify. Multi-store ready.';

-- 3.2 profiles (mirrors auth.users)
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email citext UNIQUE NOT NULL,
  full_name text NOT NULL,
  avatar_url text,
  region region_code,
  ship_from_address jsonb,
  is_active boolean NOT NULL DEFAULT true,
  preferences jsonb DEFAULT '{}'::jsonb,
  invited_by uuid REFERENCES profiles(id),
  invited_at timestamptz,
  joined_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE profiles IS 'User profiles. id = auth.users.id. Roles in user_roles junction table.';

-- 3.3 user_roles (many-to-many)
CREATE TABLE user_roles (
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  granted_by uuid REFERENCES profiles(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);
COMMENT ON TABLE user_roles IS 'Many-to-many: a user can have multiple roles simultaneously.';

-- 3.4 invitations
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

-- 3.5 brands
CREATE TABLE brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name citext NOT NULL UNIQUE,
  aliases citext[] DEFAULT '{}',
  region region_code,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_brands_aliases ON brands USING gin (aliases);
CREATE INDEX idx_brands_name_trgm ON brands USING gin ((name::text) gin_trgm_ops);

-- 3.6 brand_assignments
CREATE TABLE brand_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, user_id)
);
CREATE INDEX idx_brand_assignments_brand ON brand_assignments(brand_id) WHERE is_primary = true;

-- 3.7 customers
CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id),
  shopify_customer_id text,
  email citext,
  first_name text,
  last_name text,
  phone text,
  language_pref text,
  default_address jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, shopify_customer_id)
);
CREATE INDEX idx_customers_email ON customers(store_id, email);
CREATE INDEX idx_customers_phone ON customers(phone) WHERE phone IS NOT NULL;

-- 3.8 statuses
CREATE TABLE statuses (
  key text PRIMARY KEY,
  label_en text NOT NULL,
  label_ar text NOT NULL,
  category text NOT NULL,
  color_class text NOT NULL,
  notifies_customer boolean NOT NULL DEFAULT false,
  twilio_template_sid text,
  allowed_from_roles user_role[] NOT NULL,
  display_order integer NOT NULL,
  is_terminal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE statuses IS 'Editable enum of 15 statuses. notifies_customer triggers WhatsApp.';

-- 3.23 carriers (referenced by shipments later — placed here)
CREATE TABLE carriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  display_name text NOT NULL,
  region region_code,
  api_endpoint text,
  is_active boolean NOT NULL DEFAULT true,
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
