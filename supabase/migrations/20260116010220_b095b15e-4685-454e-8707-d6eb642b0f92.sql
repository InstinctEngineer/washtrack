-- Add RLS policy allowing users to update their own must_change_password flag
-- This fixes the infinite password change loop where employees couldn't clear their own flag

CREATE POLICY "Users can update their own password reset flag"
ON public.users
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);