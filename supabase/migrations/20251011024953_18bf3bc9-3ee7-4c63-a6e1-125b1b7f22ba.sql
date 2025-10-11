-- Fix the admin user creation by ensuring all required auth.users columns are set

-- First, clean up any existing broken user
DELETE FROM public.users WHERE email = 'nwarder@esd2.com';
DELETE FROM public.user_roles WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'nwarder@esd2.com');
DELETE FROM auth.users WHERE email = 'nwarder@esd2.com';

-- Create admin user with all required fields properly set
DO $$
DECLARE
  new_user_id uuid;
BEGIN
  -- Create auth user with all required fields
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
    email_change,
    email_change_token_new,
    recovery_token,
    raw_user_meta_data,
    raw_app_meta_data
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
    '',
    '',
    '',
    '{"name": "Admin User"}'::jsonb,
    '{"provider": "email", "providers": ["email"]}'::jsonb
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