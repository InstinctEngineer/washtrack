CREATE OR REPLACE FUNCTION public.get_portal_users_email_auth()
RETURNS TABLE(portal_user_id uuid, has_email_provider boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cpu.id AS portal_user_id,
    EXISTS (
      SELECT 1
      FROM auth.identities i
      WHERE i.user_id = cpu.auth_user_id
        AND i.provider = 'email'
    ) AS has_email_provider
  FROM public.client_portal_users cpu
  WHERE public.has_role_or_higher(auth.uid(), 'finance'::app_role);
$$;

GRANT EXECUTE ON FUNCTION public.get_portal_users_email_auth() TO authenticated;