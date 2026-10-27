CREATE OR REPLACE FUNCTION public.admin_student_accounts()
RETURNS TABLE (user_id uuid, email text, full_name text, avatar_url text, provider text, created_at timestamptz, last_sign_in_at timestamptz, email_confirmed_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;
  RETURN QUERY
    SELECT u.id, u.email::text,
      coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', '')::text,
      coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture', '')::text,
      coalesce(u.raw_app_meta_data ->> 'provider', 'email')::text,
      u.created_at, u.last_sign_in_at, u.email_confirmed_at
    FROM auth.users u
    WHERE NOT EXISTS (SELECT 1 FROM public.admin_emails a WHERE lower(a.email) = lower(u.email))
    ORDER BY u.created_at DESC;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_student_accounts() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_student_accounts() TO authenticated;