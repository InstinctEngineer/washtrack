-- ================================================================
-- Expand Finance Role Permissions
-- Allows finance users to manage Users, Clients, Locations, 
-- Work Types, Rate Cards, and Work Items with role hierarchy restrictions
-- ================================================================

-- ================================================================
-- 1. USERS TABLE - Finance can manage non-admin users
-- ================================================================

-- Finance can read all users (except super_admins unless they are super_admin)
CREATE POLICY "Finance can read users"
ON public.users FOR SELECT
USING (
  has_role_or_higher(auth.uid(), 'finance'::app_role)
  AND (has_role(auth.uid(), 'super_admin'::app_role) OR role NOT IN ('super_admin'))
);

-- Finance can insert users (but only with roles at or below finance)
CREATE POLICY "Finance can insert users"
ON public.users FOR INSERT
WITH CHECK (
  has_role_or_higher(auth.uid(), 'finance'::app_role)
  AND role NOT IN ('admin', 'super_admin')
);

-- Finance can update users (but not admin/super_admin users)
CREATE POLICY "Finance can update lower-role users"
ON public.users FOR UPDATE
USING (
  has_role_or_higher(auth.uid(), 'finance'::app_role)
  AND role NOT IN ('admin', 'super_admin')
);

-- ================================================================
-- 2. USER_ROLES TABLE - Finance can manage roles up to finance level
-- ================================================================

-- Finance can insert roles (up to their own level)
CREATE POLICY "Finance can insert roles up to finance"
ON public.user_roles FOR INSERT
WITH CHECK (
  has_role_or_higher(auth.uid(), 'finance'::app_role)
  AND role NOT IN ('admin'::app_role, 'super_admin'::app_role)
);

-- Finance can update roles (but not admin/super_admin roles)
CREATE POLICY "Finance can update lower roles"
ON public.user_roles FOR UPDATE
USING (
  has_role_or_higher(auth.uid(), 'finance'::app_role)
  AND role NOT IN ('admin'::app_role, 'super_admin'::app_role)
);

-- Finance can delete roles (but not admin/super_admin roles)
CREATE POLICY "Finance can delete lower roles"
ON public.user_roles FOR DELETE
USING (
  has_role_or_higher(auth.uid(), 'finance'::app_role)
  AND role NOT IN ('admin'::app_role, 'super_admin'::app_role)
);

-- ================================================================
-- 3. USER_LOCATIONS TABLE - Finance can manage location assignments
-- ================================================================

-- Drop existing admin-only policy and create one that includes finance
DROP POLICY IF EXISTS "Admins can manage location assignments" ON public.user_locations;

CREATE POLICY "Finance and admins can manage location assignments"
ON public.user_locations FOR ALL
USING (has_role_or_higher(auth.uid(), 'finance'::app_role))
WITH CHECK (has_role_or_higher(auth.uid(), 'finance'::app_role));

-- ================================================================
-- 4. CLIENTS TABLE - Finance can manage clients
-- ================================================================

-- Drop existing admin-only policy
DROP POLICY IF EXISTS "Admins can manage clients" ON public.clients;

-- Finance can manage clients (all operations)
CREATE POLICY "Finance and admins can manage clients"
ON public.clients FOR ALL
USING (has_role_or_higher(auth.uid(), 'finance'::app_role))
WITH CHECK (has_role_or_higher(auth.uid(), 'finance'::app_role));

-- ================================================================
-- 5. LOCATIONS TABLE - Finance can manage locations
-- ================================================================

-- Drop existing admin-only policy
DROP POLICY IF EXISTS "Admins can manage locations" ON public.locations;

-- Finance can manage locations (all operations)
CREATE POLICY "Finance and admins can manage locations"
ON public.locations FOR ALL
USING (has_role_or_higher(auth.uid(), 'finance'::app_role))
WITH CHECK (has_role_or_higher(auth.uid(), 'finance'::app_role));

-- ================================================================
-- 6. WORK_TYPES TABLE - Finance can manage work types
-- ================================================================

-- Drop existing admin-only policy
DROP POLICY IF EXISTS "Admins can manage work_types" ON public.work_types;

-- Finance can manage work_types (all operations)
CREATE POLICY "Finance and admins can manage work_types"
ON public.work_types FOR ALL
USING (has_role_or_higher(auth.uid(), 'finance'::app_role))
WITH CHECK (has_role_or_higher(auth.uid(), 'finance'::app_role));

-- ================================================================
-- 7. WORK_ITEMS TABLE - Finance can manage work items
-- ================================================================

-- Drop existing admin-only policy
DROP POLICY IF EXISTS "Admins can manage work_items" ON public.work_items;

-- Finance can manage work_items (all operations)
CREATE POLICY "Finance and admins can manage work_items"
ON public.work_items FOR ALL
USING (has_role_or_higher(auth.uid(), 'finance'::app_role))
WITH CHECK (has_role_or_higher(auth.uid(), 'finance'::app_role));

-- ================================================================
-- 8. RATE_CONFIGS TABLE - Finance can fully manage rate configs
-- ================================================================

-- Drop existing admin-only policy
DROP POLICY IF EXISTS "Admins can manage rate_configs" ON public.rate_configs;

-- Finance can manage rate_configs (all operations)
CREATE POLICY "Finance and admins can manage rate_configs"
ON public.rate_configs FOR ALL
USING (has_role_or_higher(auth.uid(), 'finance'::app_role))
WITH CHECK (has_role_or_higher(auth.uid(), 'finance'::app_role));