ALTER TABLE public.user_message_views
  DROP CONSTRAINT IF EXISTS user_message_views_user_id_fkey;

GRANT SELECT, INSERT, UPDATE ON public.user_message_views TO authenticated;
GRANT ALL ON public.user_message_views TO service_role;