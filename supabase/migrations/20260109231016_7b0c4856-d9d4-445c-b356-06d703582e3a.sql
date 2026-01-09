-- Create a security definer function to get user display info (id and name only)
-- This allows any authenticated user to see names for read receipts and replies
-- without exposing sensitive user data

CREATE OR REPLACE FUNCTION public.get_user_display_info(user_ids uuid[])
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.name
  FROM public.users u
  WHERE u.id = ANY(user_ids)
    AND u.is_active = true;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_display_info(uuid[]) TO authenticated;