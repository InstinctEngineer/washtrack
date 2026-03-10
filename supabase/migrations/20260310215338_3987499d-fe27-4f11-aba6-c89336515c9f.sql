
-- Create storage bucket for error report screenshots
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('error-reports', 'error-reports', false, 5242880, ARRAY['image/png', 'image/jpeg']);

-- Allow authenticated users to upload to error-reports bucket
CREATE POLICY "Authenticated users can upload error reports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'error-reports');

-- Allow super admins to view error report screenshots
CREATE POLICY "Super admins can view error reports"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'error-reports' AND public.is_super_admin(auth.uid()));

-- Allow the uploading user to view their own screenshots
CREATE POLICY "Users can view their own error report screenshots"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'error-reports' AND (storage.foldername(name))[1] = auth.uid()::text);
