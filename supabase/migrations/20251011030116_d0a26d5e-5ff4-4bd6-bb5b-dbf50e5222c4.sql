-- Create hierarchical role access system
-- Admin > Finance > Manager > Employee

-- Create a function to check if a user has a specific role or higher in the hierarchy
CREATE OR REPLACE FUNCTION public.has_role_or_higher(_user_id uuid, _required_role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
    AND (
      -- If required role is employee, all roles have access
      (_required_role = 'employee') OR
      -- If required role is manager, manager, finance, and admin have access
      (_required_role = 'manager' AND ur.role IN ('manager', 'finance', 'admin')) OR
      -- If required role is finance, finance and admin have access
      (_required_role = 'finance' AND ur.role IN ('finance', 'admin')) OR
      -- If required role is admin, only admin has access
      (_required_role = 'admin' AND ur.role = 'admin')
    )
  );
$$;

-- Drop existing policies on users table
DROP POLICY IF EXISTS "Finance and admin can read all users" ON public.users;
DROP POLICY IF EXISTS "Users can read their own record" ON public.users;
DROP POLICY IF EXISTS "Admin can insert users" ON public.users;
DROP POLICY IF EXISTS "Admin can update users" ON public.users;

-- Create new hierarchical policies for users table
CREATE POLICY "Users with manager role or higher can read all users"
ON public.users
FOR SELECT
USING (
  public.has_role_or_higher(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Employees can read their own record"
ON public.users
FOR SELECT
USING (
  auth.uid() = id AND public.has_role(auth.uid(), 'employee'::app_role)
);

CREATE POLICY "Admin can insert users"
ON public.users
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admin can update users"
ON public.users
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
);

-- Drop and recreate policies for locations table
DROP POLICY IF EXISTS "All authenticated users can read locations" ON public.locations;
DROP POLICY IF EXISTS "Admin can insert locations" ON public.locations;
DROP POLICY IF EXISTS "Admin can update locations" ON public.locations;

CREATE POLICY "All authenticated users can read locations"
ON public.locations
FOR SELECT
USING (true);

CREATE POLICY "Admin can insert locations"
ON public.locations
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admin can update locations"
ON public.locations
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
);

-- Update user_roles policies to use hierarchy
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Users with manager role or higher can view all roles"
ON public.user_roles
FOR SELECT
USING (
  public.has_role_or_higher(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Employees can view their own roles"
ON public.user_roles
FOR SELECT
USING (
  auth.uid() = user_id AND public.has_role(auth.uid(), 'employee'::app_role)
);