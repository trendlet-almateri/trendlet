-- Migration 11: Seed data
-- 15 statuses, default settings, AI model registry, default carriers,
-- and the Trendslet store record.

-- Statuses
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
('failed', 'Failed', 'فشل', 'failed', 'red', false, ARRAY['admin']::user_role[], 14, true)
ON CONFLICT (key) DO NOTHING;

-- Settings
INSERT INTO settings (key, value, description) VALUES
('default_markup_percent', '50'::jsonb, 'Default markup applied to supplier cost'),
('default_vat_percent', '15'::jsonb, 'Saudi Arabia VAT rate'),
('default_shipping_fee_sar', '25'::jsonb, 'Default shipping fee for KSA delivery'),
('sla_sourcing_hours', '24'::jsonb, 'Hours to mark item purchased after order'),
('sla_warehouse_hours', '48'::jsonb, 'Hours to ship after item arrives at warehouse'),
('sla_last_mile_hours', '72'::jsonb, 'Hours to deliver in KSA'),
('sla_at_risk_threshold', '0.25'::jsonb, 'Mark at-risk when remaining time < 25%'),
('correction_learning_enabled', 'true'::jsonb, 'AI learns from admin corrections'),
('max_correction_examples', '20'::jsonb, 'Max examples sent to AI as few-shot')
ON CONFLICT (key) DO NOTHING;

-- AI models registry (mock today; admin selects active in /invoices > settings)
INSERT INTO ai_models (provider, model_id, display_name, use_case, is_active, cost_per_1k_input, cost_per_1k_output) VALUES
('openai', 'gpt-4o', 'GPT-4o (vision)', 'ocr', true, 0.0025, 0.010),
('openai', 'gpt-4o-mini', 'GPT-4o mini', 'classification', false, 0.00015, 0.0006),
('anthropic', 'claude-sonnet-4-6', 'Claude Sonnet 4.6', 'invoice_gen', true, 0.003, 0.015),
('anthropic', 'claude-haiku-4-5', 'Claude Haiku 4.5', 'classification', true, 0.0008, 0.004),
('openrouter', 'openai/gpt-4o', 'GPT-4o (via OpenRouter)', 'ocr', false, 0.0025, 0.010)
ON CONFLICT (provider, model_id, use_case) DO NOTHING;

-- Default carriers
INSERT INTO carriers (name, display_name, region, is_active) VALUES
('DHL_US', 'DHL Express (US)', 'US', true),
('DHL_EU', 'DHL Express (EU)', 'EU', true),
('KSA_LOCAL_TBD', 'KSA local courier', 'KSA', true)
ON CONFLICT DO NOTHING;

-- Default Trendslet store
INSERT INTO stores (name, shopify_domain, default_currency, region, is_active)
VALUES ('Trendslet', '1jtyqy-0w.myshopify.com', 'SAR', 'KSA', true)
ON CONFLICT (shopify_domain) DO NOTHING;
