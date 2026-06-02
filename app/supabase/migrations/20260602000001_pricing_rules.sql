-- ── Pricing rules ─────────────────────────────────────────────────────────────
-- Per-brand, per-category extra fees charged on each sub-order.
-- Source: تفصيل_الرسوم_للمبرمج.xlsx (seeded via scripts/seed-pricing-rules.mjs)
-- Match key: brand_name + category_ar (+ optional gender preference)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pricing_rules (
  id                   uuid         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Match dimensions
  brand_name           text         NOT NULL,  -- e.g. "Louis Vuitton"
  category_ar          text         NOT NULL,  -- e.g. "شنط كتف" (Arabic, from spreadsheet)
  gender               text         CHECK (gender IN ('نسائي', 'رجالي', 'أطفال')),

  -- Fee columns (SAR)
  service_fee_with_vat numeric(8,2) NOT NULL,  -- 100.00 or 50.00 (incl. 15% VAT)
  service_fee_net      numeric(8,2) NOT NULL,  -- net pre-tax (86.96 or 43.48)
  service_fee_vat      numeric(8,2) NOT NULL,  -- VAT portion (13.04 or 6.52)
  shipping_customs_fee numeric(8,2) NOT NULL,  -- shipping + customs; the main variable
  total_fee            numeric(8,2) GENERATED ALWAYS AS
                         (service_fee_with_vat + shipping_customs_fee) STORED,

  -- Shopify product_type alias — populated when Shopify's product_type value
  -- differs from the Arabic category_ar stored in this row.
  shopify_product_type_alias text,

  -- Traceability back to source spreadsheet row
  source_row           int,

  created_at           timestamptz  DEFAULT now(),
  updated_at           timestamptz  DEFAULT now()
);

-- ── Unique constraint ─────────────────────────────────────────────────────────
ALTER TABLE pricing_rules
  ADD CONSTRAINT pricing_rules_unique_rule
  UNIQUE (brand_name, category_ar, gender);

-- ── Indexes ───────────────────────────────────────────────────────────────────
-- Primary lookup path: brand + exact category_ar (= sub_orders.product_type)
CREATE INDEX pricing_rules_brand_category
  ON pricing_rules (brand_name, category_ar);

-- Alias lookup: when Shopify product_type string differs from category_ar
CREATE INDEX pricing_rules_alias
  ON pricing_rules (brand_name, shopify_product_type_alias)
  WHERE shopify_product_type_alias IS NOT NULL;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read pricing_rules"
  ON pricing_rules FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

-- Service role (webhooks, server actions) bypasses RLS automatically.
