-- Migration 20260429000007: replace is_admin() with jwt_is_admin() in storage policies
--
-- Project rule: is_admin(uuid) is banned because it does a DB lookup on
-- every RLS evaluation. jwt_is_admin() reads from the JWT app_metadata
-- claim populated by the auth hook and is effectively free.
--
-- The storage-bucket policies were the last hold-outs (most other policies
-- were swapped in 20260428000002_rls_jwt_admin_full). This migration drops
-- and recreates each one without changing semantics.

DROP POLICY IF EXISTS "admin read customer invoices" ON storage.objects;
CREATE POLICY "admin read customer invoices"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'customer-invoices' AND jwt_is_admin());

DROP POLICY IF EXISTS "admin write customer invoices" ON storage.objects;
CREATE POLICY "admin write customer invoices"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'customer-invoices' AND jwt_is_admin());

DROP POLICY IF EXISTS "admin write invoice templates" ON storage.objects;
CREATE POLICY "admin write invoice templates"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'invoice-templates' AND jwt_is_admin());

DROP POLICY IF EXISTS "admin write shipping labels" ON storage.objects;
CREATE POLICY "admin write shipping labels"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'shipping-labels' AND jwt_is_admin());

DROP POLICY IF EXISTS "auth users read own supplier invoices" ON storage.objects;
CREATE POLICY "auth users read own supplier invoices"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'supplier-invoices'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR jwt_is_admin()
    )
  );
