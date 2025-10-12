-- Assign super_admin role to nwarder@esd2.com
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::app_role
FROM auth.users
WHERE email = 'nwarder@esd2.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Update has_role_or_higher function to include super_admin
CREATE OR REPLACE FUNCTION public.has_role_or_higher(_user_id uuid, _required_role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
    AND (
      -- Super admin has access to everything
      (ur.role = 'super_admin') OR
      -- If required role is employee, all roles have access
      (_required_role = 'employee') OR
      -- If required role is manager, manager, finance, and admin have access
      (_required_role = 'manager' AND ur.role IN ('manager', 'finance', 'admin')) OR
      -- If required role is finance, finance and admin have access
      (_required_role = 'finance' AND ur.role IN ('finance', 'admin')) OR
      -- If required role is admin, only admin and super_admin have access
      (_required_role = 'admin' AND ur.role IN ('admin', 'super_admin')) OR
      -- If required role is super_admin, only super_admin has access
      (_required_role = 'super_admin' AND ur.role = 'super_admin')
    )
  );
$$;

-- Prevent non-super-admins from editing super-admin users
CREATE POLICY "Prevent editing super admin users by non-super-admins"
ON public.user_roles
FOR UPDATE
USING (
  role != 'super_admin' OR has_role(auth.uid(), 'super_admin')
);

CREATE POLICY "Prevent deleting super admin roles by non-super-admins"
ON public.user_roles
FOR DELETE
USING (
  role != 'super_admin' OR has_role(auth.uid(), 'super_admin')
);