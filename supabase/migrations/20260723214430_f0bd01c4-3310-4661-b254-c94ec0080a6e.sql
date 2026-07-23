
-- 1) Add is_test columns (additive, safe defaults)
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.clients   ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

-- 2) Update reporting RPCs to exclude test data
CREATE OR REPLACE FUNCTION public.get_report_data(
  p_start_date date,
  p_end_date date,
  p_client_ids text[] DEFAULT NULL::text[],
  p_location_ids text[] DEFAULT NULL::text[],
  p_work_type_ids text[] DEFAULT NULL::text[]
)
RETURNS TABLE(
  client_id text, client_name text, client_email text, client_terms text,
  client_class text, client_is_taxable boolean, client_tax_jurisdiction text,
  client_tax_rate numeric, client_parent_company text,
  location_id text, location_name text,
  work_type_id text, work_type_name text, work_type_rate_type text,
  frequency text, rate numeric, total_quantity numeric, work_date text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    c.id::TEXT, c.name, c.contact_email, c.default_terms, c.default_class,
    c.is_taxable, c.tax_jurisdiction, c.tax_rate, c.parent_company,
    l.id::TEXT, l.name,
    wt.id::TEXT, wt.name, wt.rate_type::TEXT,
    rc.frequency, rc.rate,
    SUM(wl.quantity) AS total_quantity,
    wl.work_date::TEXT
  FROM work_logs wl
  LEFT JOIN work_items wi ON wl.work_item_id = wi.id
  JOIN rate_configs rc ON (wi.rate_config_id = rc.id OR wl.rate_config_id = rc.id)
  JOIN work_types wt ON rc.work_type_id = wt.id
  JOIN locations l ON rc.location_id = l.id
  JOIN clients c ON rc.client_id = c.id
  WHERE wl.work_date BETWEEN p_start_date AND p_end_date
    AND l.is_test = false
    AND c.is_test = false
    AND (p_client_ids IS NULL OR c.id::TEXT = ANY(p_client_ids))
    AND (p_location_ids IS NULL OR l.id::TEXT = ANY(p_location_ids))
    AND (p_work_type_ids IS NULL OR wt.id::TEXT = ANY(p_work_type_ids))
  GROUP BY
    c.id, c.name, c.contact_email, c.default_terms, c.default_class,
    c.is_taxable, c.tax_jurisdiction, c.tax_rate, c.parent_company,
    l.id, l.name,
    wt.id, wt.name, wt.rate_type,
    rc.frequency, rc.rate,
    wl.work_date;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_dealership_report_data(
  p_start_date date,
  p_end_date date,
  p_client_ids text[] DEFAULT NULL::text[],
  p_location_ids text[] DEFAULT NULL::text[]
)
RETURNS TABLE(
  client_id text, client_name text, client_email text, client_terms text,
  client_parent_company text, location_id text, location_name text,
  work_date text, vehicle_count bigint, rate_applied numeric, total_amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role_or_higher(auth.uid(), 'finance'::app_role) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  RETURN QUERY
  SELECT
    c.id::TEXT, c.name, c.contact_email, c.default_terms, c.parent_company,
    l.id::TEXT, l.name, b.work_date::TEXT,
    SUM(b.vehicle_count)::BIGINT,
    b.rate_applied,
    SUM(b.vehicle_count * b.rate_applied)::NUMERIC
  FROM public.dealership_wash_batches b
  JOIN public.clients c ON c.id = b.client_id
  JOIN public.locations l ON l.id = b.location_id
  WHERE b.work_date BETWEEN p_start_date AND p_end_date
    AND c.business_type = 'dealership'
    AND l.is_test = false
    AND c.is_test = false
    AND (p_client_ids IS NULL OR c.id::TEXT = ANY(p_client_ids))
    AND (p_location_ids IS NULL OR l.id::TEXT = ANY(p_location_ids))
  GROUP BY c.id, c.name, c.contact_email, c.default_terms, c.parent_company,
           l.id, l.name, b.work_date, b.rate_applied;
END;
$function$;

-- 3) Seed test client + location + rate + work items
DO $seed$
DECLARE
  v_client_id uuid;
  v_location_id uuid;
  v_rate_id uuid;
  v_cars_washed_type uuid := '78c087a6-a6a7-4b7b-bfb3-b281f9069dc2';
BEGIN
  SELECT id INTO v_client_id FROM public.clients
    WHERE name = 'ZZ TEST — App Review (do not bill)' AND is_test = true LIMIT 1;

  IF v_client_id IS NULL THEN
    INSERT INTO public.clients (name, is_test, business_type, is_active, contact_name, contact_email)
    VALUES ('ZZ TEST — App Review (do not bill)', true, 'fedex', true, 'App Review', 'appreview@washtracking.com')
    RETURNING id INTO v_client_id;
  END IF;

  SELECT id INTO v_location_id FROM public.locations
    WHERE name = 'ZZ TEST — App Review (do not bill)' AND is_test = true LIMIT 1;

  IF v_location_id IS NULL THEN
    INSERT INTO public.locations (name, client_id, is_test, is_active, latitude, longitude)
    VALUES ('ZZ TEST — App Review (do not bill)', v_client_id, true, true, NULL, NULL)
    RETURNING id INTO v_location_id;
  END IF;

  SELECT id INTO v_rate_id FROM public.rate_configs
    WHERE location_id = v_location_id AND work_type_id = v_cars_washed_type LIMIT 1;

  IF v_rate_id IS NULL THEN
    INSERT INTO public.rate_configs (client_id, location_id, work_type_id, frequency, rate, is_active, needs_rate_review)
    VALUES (v_client_id, v_location_id, v_cars_washed_type, 'hourly', 0, true, false)
    RETURNING id INTO v_rate_id;
  END IF;

  INSERT INTO public.work_items (rate_config_id, identifier, is_active)
  SELECT v_rate_id, x, true
  FROM (VALUES ('TEST-001'), ('TEST-002'), ('TEST-003')) AS t(x)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.work_items wi WHERE wi.rate_config_id = v_rate_id AND wi.identifier = t.x
  );
END
$seed$;

-- 4) Create reviewer auth user + profile + role + location assignment
DO $usr$
DECLARE
  v_user_id uuid;
  v_location_id uuid;
  v_employee_id text;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'appreview@washtracking.com' LIMIT 1;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
      'appreview@washtracking.com', crypt('WashTest2026!', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('name', 'App Review Tester'),
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(), v_user_id, v_user_id::text,
      jsonb_build_object('sub', v_user_id::text, 'email', 'appreview@washtracking.com', 'email_verified', true),
      'email', now(), now(), now()
    );
  END IF;

  SELECT employee_id INTO v_employee_id FROM public.users WHERE id = v_user_id;
  IF v_employee_id IS NULL THEN
    v_employee_id := 'APPREV001';
    INSERT INTO public.users (id, email, name, employee_id, role, is_active, must_change_password)
    VALUES (v_user_id, 'appreview@washtracking.com', 'App Review Tester', v_employee_id, 'employee', true, false)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'employee'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  SELECT id INTO v_location_id FROM public.locations
    WHERE name = 'ZZ TEST — App Review (do not bill)' AND is_test = true LIMIT 1;

  IF v_location_id IS NOT NULL THEN
    -- Remove any accidental other-location assignments first, then insert the single scope
    DELETE FROM public.user_locations WHERE user_id = v_user_id AND location_id <> v_location_id;
    INSERT INTO public.user_locations (user_id, location_id, is_primary)
    VALUES (v_user_id, v_location_id, true)
    ON CONFLICT (user_id, location_id) DO NOTHING;
  END IF;
END
$usr$;
