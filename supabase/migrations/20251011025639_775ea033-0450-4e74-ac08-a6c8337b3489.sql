-- Create test accounts for all roles

DO $$
DECLARE
  manager_id uuid;
  finance_id uuid;
  employee_id uuid;
BEGIN
  -- Create Manager test user
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
    'manager@test.com',
    crypt('Manager123!', gen_salt('bf')),
    now(),
    now(),
    now(),
    '',
    '',
    '',
    '',
    '{"name": "Test Manager"}'::jsonb,
    '{"provider": "email", "providers": ["email"]}'::jsonb
  )
  RETURNING id INTO manager_id;

  INSERT INTO public.users (id, email, name, employee_id, role)
  VALUES (manager_id, 'manager@test.com', 'Test Manager', 'MGR001', 'manager');

  INSERT INTO public.user_roles (user_id, role)
  VALUES (manager_id, 'manager'::app_role);

  -- Create Finance test user
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
    'finance@test.com',
    crypt('Finance123!', gen_salt('bf')),
    now(),
    now(),
    now(),
    '',
    '',
    '',
    '',
    '{"name": "Test Finance"}'::jsonb,
    '{"provider": "email", "providers": ["email"]}'::jsonb
  )
  RETURNING id INTO finance_id;

  INSERT INTO public.users (id, email, name, employee_id, role)
  VALUES (finance_id, 'finance@test.com', 'Test Finance', 'FIN001', 'finance');

  INSERT INTO public.user_roles (user_id, role)
  VALUES (finance_id, 'finance'::app_role);

  -- Create Employee test user
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
    'employee@test.com',
    crypt('Employee123!', gen_salt('bf')),
    now(),
    now(),
    now(),
    '',
    '',
    '',
    '',
    '{"name": "Test Employee"}'::jsonb,
    '{"provider": "email", "providers": ["email"]}'::jsonb
  )
  RETURNING id INTO employee_id;

  INSERT INTO public.users (id, email, name, employee_id, role)
  VALUES (employee_id, 'employee@test.com', 'Test Employee', 'EMP001', 'employee');

  INSERT INTO public.user_roles (user_id, role)
  VALUES (employee_id, 'employee'::app_role);
  
END $$;