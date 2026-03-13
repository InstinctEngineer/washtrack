CREATE OR REPLACE FUNCTION public.get_super_admin_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM public.user_roles 
  WHERE role = 'super_admin'::app_role LIMIT 1;
$$;