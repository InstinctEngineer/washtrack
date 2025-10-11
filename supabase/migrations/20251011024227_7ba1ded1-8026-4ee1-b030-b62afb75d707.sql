-- Fix infinite recursion in RLS by using a separate roles table
-- This follows security best practices

-- 1. Create role enum
CREATE TYPE public.app_role AS ENUM ('employee', 'manager', 'finance', 'admin');

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Create security definer function to check roles (prevents recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- 4. Migrate existing roles from users table to user_roles table
INSERT INTO public.user_roles (user_id, role)
SELECT id, role::app_role FROM public.users WHERE role IS NOT NULL;

-- 5. Drop old RLS policies on users table
DROP POLICY IF EXISTS "Finance and admin can read all users" ON public.users;
DROP POLICY IF EXISTS "Users can read their own record" ON public.users;
DROP POLICY IF EXISTS "Admin can update users" ON public.users;
DROP POLICY IF EXISTS "Admin can insert users" ON public.users;

-- 6. Create new RLS policies using the security definer function
CREATE POLICY "Users can read their own record"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Finance and admin can read all users"
  ON public.users FOR SELECT
  USING (
    public.has_role(auth.uid(), 'finance'::app_role) OR 
    public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admin can update users"
  ON public.users FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can insert users"
  ON public.users FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 7. Create admin user with specified email
DO $$
DECLARE
  new_user_id uuid;
BEGIN
  -- Create auth user
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    confirmation_token,
    raw_user_meta_data
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'nwarder@esd2.com',
    crypt('Admin123!', gen_salt('bf')),
    now(),
    now(),
    now(),
    '',
    '{"name": "Admin User"}'::jsonb
  )
  RETURNING id INTO new_user_id;

  -- Create user profile
  INSERT INTO public.users (id, email, name, employee_id, role)
  VALUES (
    new_user_id,
    'nwarder@esd2.com',
    'Admin User',
    'ADMIN001',
    'admin'
  );

  -- Assign admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new_user_id, 'admin'::app_role);
  
END $$;