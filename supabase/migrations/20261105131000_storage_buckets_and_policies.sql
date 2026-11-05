-- Migration: 20261105131000_storage_buckets_and_policies.sql
-- Description: Ensure storage buckets and row-level security policies exist for KYC documents and brand uploads.

-- 1. Create merchant-documents bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'merchant-documents',
  'merchant-documents',
  false,
  5242880,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png'];

-- 2. Create uploads bucket (public, for banners)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'uploads',
  'uploads',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- 3. Create legacy kyc bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kyc',
  'kyc',
  false,
  5242880,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png'];

-- 4. Bucket read policies
DROP POLICY IF EXISTS buckets_authenticated_select ON storage.buckets;
CREATE POLICY buckets_authenticated_select ON storage.buckets FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS buckets_anon_select ON storage.buckets;
CREATE POLICY buckets_anon_select ON storage.buckets FOR SELECT TO anon
USING (public = true);

-- 5. Policies for merchant-documents
DROP POLICY IF EXISTS merchant_document_insert ON storage.objects;
CREATE POLICY merchant_document_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'merchant-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND public.is_account_active(auth.uid())
);

DROP POLICY IF EXISTS merchant_document_read ON storage.objects;
CREATE POLICY merchant_document_read ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'merchant-documents'
  AND public.is_account_active(auth.uid())
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_admin()
  )
);

-- 6. Policies for uploads bucket
DROP POLICY IF EXISTS uploads_insert ON storage.objects;
CREATE POLICY uploads_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'uploads'
  AND public.is_account_active(auth.uid())
);

DROP POLICY IF EXISTS uploads_update ON storage.objects;
CREATE POLICY uploads_update ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'uploads'
  AND public.is_account_active(auth.uid())
);

DROP POLICY IF EXISTS uploads_select ON storage.objects;
CREATE POLICY uploads_select ON storage.objects FOR SELECT TO public
USING (bucket_id = 'uploads');

-- 7. Ensure validate_merchant_document trigger is active on public.companies
DROP TRIGGER IF EXISTS validate_merchant_document ON public.companies;
CREATE TRIGGER validate_merchant_document
  BEFORE INSERT OR UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_merchant_document();

NOTIFY pgrst, 'reload schema';
