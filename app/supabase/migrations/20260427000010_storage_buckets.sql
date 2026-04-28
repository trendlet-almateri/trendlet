-- Migration 10: Storage buckets (all private)

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('supplier-invoices', 'supplier-invoices', false),
  ('customer-invoices', 'customer-invoices', false),
  ('shipping-labels', 'shipping-labels', false),
  ('invoice-templates', 'invoice-templates', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS — only authenticated users may access; admin can read everything
-- Per-bucket folder convention is enforced in app code, not DB:
--   supplier-invoices/{user_id}/{yyyy-mm}/{uuid}-{filename}
--   customer-invoices/{yyyy}/{invoice_number}.pdf
--   shipping-labels/{shipment_id}.pdf
--   invoice-templates/{language}/{uuid}-{filename}.pdf

CREATE POLICY "auth users read own supplier invoices"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'supplier-invoices'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin(auth.uid()))
  );

CREATE POLICY "auth users upload supplier invoices to own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'supplier-invoices'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "admin read customer invoices"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'customer-invoices' AND public.is_admin(auth.uid()));

CREATE POLICY "admin write customer invoices"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'customer-invoices' AND public.is_admin(auth.uid()));

CREATE POLICY "auth read shipping labels"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'shipping-labels');

CREATE POLICY "admin write shipping labels"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'shipping-labels' AND public.is_admin(auth.uid()));

CREATE POLICY "auth read invoice templates"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'invoice-templates');

CREATE POLICY "admin write invoice templates"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'invoice-templates' AND public.is_admin(auth.uid()));
