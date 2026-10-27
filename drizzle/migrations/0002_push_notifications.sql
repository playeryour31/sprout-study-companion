CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  lang text NOT NULL DEFAULT 'ar',
  time_zone text NOT NULL DEFAULT 'Africa/Cairo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own push subscriptions read" ON public.push_subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own push subscriptions delete" ON public.push_subscriptions FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.announcements ADD COLUMN event_id uuid REFERENCES public.events(id) ON DELETE CASCADE;
CREATE INDEX announcements_event_id_idx ON public.announcements(event_id);