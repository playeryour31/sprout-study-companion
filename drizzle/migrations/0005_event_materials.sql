CREATE TABLE public.event_materials (
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, material_id)
);
CREATE INDEX event_materials_material_id_idx ON public.event_materials(material_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_materials TO authenticated;
GRANT ALL ON public.event_materials TO service_role;
ALTER TABLE public.event_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "students read event materials" ON public.event_materials FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);
CREATE POLICY "admins write event materials" ON public.event_materials FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());