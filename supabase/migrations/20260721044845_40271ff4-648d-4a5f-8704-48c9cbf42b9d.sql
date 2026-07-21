REVOKE ALL ON public.user_message_views FROM PUBLIC;
REVOKE ALL ON public.user_message_views FROM anon;

GRANT SELECT, INSERT, UPDATE ON public.user_message_views TO authenticated;
GRANT ALL ON public.user_message_views TO service_role;