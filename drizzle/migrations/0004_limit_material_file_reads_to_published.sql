DROP POLICY IF EXISTS "students read material files" ON storage.objects;
CREATE POLICY "students read material files" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'materials'
  AND (select auth.uid()) IS NOT NULL
  AND (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.materials m WHERE m.file_path = storage.objects.name)
  )
);