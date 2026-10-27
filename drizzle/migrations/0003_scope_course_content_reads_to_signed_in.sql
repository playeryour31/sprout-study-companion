ALTER POLICY "students read subjects" ON public.subjects USING ((select auth.uid()) IS NOT NULL);
ALTER POLICY "students read lessons" ON public.lessons USING ((select auth.uid()) IS NOT NULL);
ALTER POLICY "students read materials" ON public.materials USING ((select auth.uid()) IS NOT NULL);
ALTER POLICY "students read quizzes" ON public.quizzes USING ((select auth.uid()) IS NOT NULL);
ALTER POLICY "students read events" ON public.events USING ((select auth.uid()) IS NOT NULL);
ALTER POLICY "students read announcements" ON public.announcements USING ((select auth.uid()) IS NOT NULL);