-- Migration 20260429000006: ocr_model_id setting
--
-- Phase 4f: admin picks which AI model is used to extract data from
-- supplier-receipt PDFs. Choice stored as a settings row so we can
-- swap models without redeploying. Default value is the cheapest
-- vision-capable model in ai_models — change via /admin/invoice-settings.
--
-- The value is stored as a JSON string (the model_id text), so reads
-- are 'select value->>0 from settings where key=ocr_model_id'.

INSERT INTO settings (key, value, description)
VALUES (
  'ocr_model_id',
  to_jsonb('gpt-4o'::text),
  'AI model used to extract line items from supplier receipts. Set via /admin/invoice-settings. Must match a model_id in ai_models where is_active=true and use_case=''ocr''.'
)
ON CONFLICT (key) DO NOTHING;
