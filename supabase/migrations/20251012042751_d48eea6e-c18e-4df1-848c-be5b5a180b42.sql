-- Update RLS policy on users table to hide super_admin users from non-super-admins
DROP POLICY IF EXISTS "Users with manager role or higher can read all users" ON public.users;

CREATE POLICY "Users with manager role or higher can read all users"
ON public.users
FOR SELECT
USING (
  has_role_or_higher(auth.uid(), 'manager'::app_role)
  AND (
    -- If the viewer is a super_admin, they can see all users
    has_role(auth.uid(), 'super_admin'::app_role)
    OR
    -- Otherwise, they cannot see super_admin users
    NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = users.id
      AND user_roles.role = 'super_admin'::app_role
    )
  )
);

-- Update RLS policy on user_roles table to hide super_admin roles from non-super-admins
DROP POLICY IF EXISTS "Users with manager role or higher can view all roles" ON public.user_roles;

CREATE POLICY "Users with manager role or higher can view all roles"
ON public.user_roles
FOR SELECT
USING (
  has_role_or_higher(auth.uid(), 'manager'::app_role)
  AND (
    -- If the viewer is a super_admin, they can see all roles
    has_role(auth.uid(), 'super_admin'::app_role)
    OR
    -- Otherwise, they cannot see super_admin roles
    role <> 'super_admin'::app_role
  )
);