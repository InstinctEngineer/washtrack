-- ================================================================
-- Fix Finance RLS Policies to use user_roles table
-- ================================================================

-- Drop the incorrectly implemented policies
DROP POLICY IF EXISTS "Finance can read users" ON public.users;
DROP POLICY IF EXISTS "Finance can insert users" ON public.users;
DROP POLICY IF EXISTS "Finance can update lower-role users" ON public.users;

-- Recreate with proper user_roles lookup

-- Finance can read all users (except super_admins unless they are super_admin)
CREATE POLICY "Finance can read users"
ON public.users FOR SELECT
USING (
  has_role_or_higher(auth.uid(), 'finance'::app_role)
  AND (
    has_role(auth.uid(), 'super_admin'::app_role) 
    OR NOT EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = users.id 
      AND ur.role = 'super_admin'
    )
  )
);

-- Finance can insert users (role column check is still valid for INSERT)
CREATE POLICY "Finance can insert users"
ON public.users FOR INSERT
WITH CHECK (
  has_role_or_higher(auth.uid(), 'finance'::app_role)
  AND role NOT IN ('admin', 'super_admin')
);

-- Finance can update users who don't have admin/super_admin roles
CREATE POLICY "Finance can update lower-role users"
ON public.users FOR UPDATE
USING (
  has_role_or_higher(auth.uid(), 'finance'::app_role)
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = users.id 
    AND ur.role IN ('admin', 'super_admin')
  )
);