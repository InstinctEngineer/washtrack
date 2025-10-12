-- Drop the old check constraint on users.role
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- Add a new check constraint that matches the app_role enum values
-- The users table stores the role as text, but it should match the app_role enum
ALTER TABLE public.users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('employee', 'manager', 'finance', 'admin', 'super_admin'));