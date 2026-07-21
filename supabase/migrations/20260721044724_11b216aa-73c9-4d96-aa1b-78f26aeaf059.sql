ALTER TABLE public.user_message_views
  DROP CONSTRAINT IF EXISTS user_message_views_user_id_fkey;

ALTER TABLE public.user_message_views
  ADD CONSTRAINT user_message_views_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

GRANT SELECT, INSERT, UPDATE ON public.user_message_views TO authenticated;
GRANT ALL ON public.user_message_views TO service_role;

DROP POLICY IF EXISTS "Users can update their own message view record" ON public.user_message_views;
CREATE POLICY "Users can update their own message view record"
ON public.user_message_views
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own message view record" ON public.user_message_views;
CREATE POLICY "Users can insert their own message view record"
ON public.user_message_views
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own message view record" ON public.user_message_views;
CREATE POLICY "Users can view their own message view record"
ON public.user_message_views
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);