CREATE OR REPLACE FUNCTION public.get_user_display_info(user_ids uuid[])
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.name
  FROM public.users u
  WHERE u.id = ANY(user_ids);
$$;