CREATE TABLE public.material_opens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  opened_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX material_opens_event_idx ON public.material_opens(event_id);
GRANT SELECT, INSERT ON public.material_opens TO authenticated;
GRANT ALL ON public.material_opens TO service_role;
ALTER TABLE public.material_opens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "students log own opens" ON public.material_opens FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.event_materials em WHERE em.event_id = material_opens.event_id AND em.material_id = material_opens.material_id)
  );
CREATE POLICY "own opens read" ON public.material_opens FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());

-- Admin-only: every signed-up student with name/email, for open-rate stats.
CREATE OR REPLACE FUNCTION public.admin_students()
RETURNS TABLE (user_id uuid, email text, full_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;
  RETURN QUERY
    SELECT u.id, u.email::text, coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', '')::text
    FROM auth.users u
    WHERE NOT EXISTS (SELECT 1 FROM public.admin_emails a WHERE lower(a.email) = lower(u.email))
    ORDER BY 3, 2;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_students() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_students() TO authenticated;