-- Create a security definer function to check if a user is a super admin
-- This bypasses RLS to properly filter super admin users
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
    AND role = 'super_admin'::app_role
  );
$$;

-- Update RLS policy on users table to properly hide super_admin users
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
    -- Otherwise, they cannot see super_admin users (using security definer function)
    NOT public.is_super_admin(users.id)
  )
);

-- Keep the user_roles policy as is (it's already correct)
-- This ensures admins can't see super_admin role assignments even if they somehow access the table