-- ============================================================================
-- WashTrack Complete Database Schema Migration
-- Generated: 2025-11-01
-- 
-- This file contains the complete database schema for WashTrack including:
-- - Enum types
-- - All tables with constraints
-- - Database functions
-- - RLS policies
-- - Triggers
-- - Initial system settings
--
-- Usage:
-- 1. Create a new Supabase project
-- 2. Run this SQL file in the SQL Editor
-- 3. Configure authentication settings (enable auto-confirm for dev/staging)
-- 4. Deploy edge functions from supabase/functions/
-- 5. Export/import data from existing database
-- 6. Update environment variables in your app
-- ============================================================================

-- ============================================================================
-- CLEANUP (Optional - uncomment if reinstalling)
-- ============================================================================
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- DROP TRIGGER IF EXISTS audit_wash_entries_trigger ON wash_entries;
-- DROP TRIGGER IF EXISTS log_system_setting_change_trigger ON system_settings;
-- DROP TABLE IF EXISTS audit_log CASCADE;
-- DROP TABLE IF EXISTS manager_approval_requests CASCADE;
-- DROP TABLE IF EXISTS wash_entries CASCADE;
-- DROP TABLE IF EXISTS vehicles CASCADE;
-- DROP TABLE IF EXISTS client_vehicle_rates CASCADE;
-- DROP TABLE IF EXISTS client_notes CASCADE;
-- DROP TABLE IF EXISTS client_contacts CASCADE;
-- DROP TABLE IF EXISTS client_locations CASCADE;
-- DROP TABLE IF EXISTS clients CASCADE;
-- DROP TABLE IF EXISTS vehicle_types CASCADE;
-- DROP TABLE IF EXISTS user_locations CASCADE;
-- DROP TABLE IF EXISTS locations CASCADE;
-- DROP TABLE IF EXISTS system_settings_audit CASCADE;
-- DROP TABLE IF EXISTS system_settings CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;
-- DROP TABLE IF EXISTS user_roles CASCADE;
-- DROP FUNCTION IF EXISTS audit_wash_entries CASCADE;
-- DROP FUNCTION IF EXISTS log_system_setting_change CASCADE;
-- DROP FUNCTION IF EXISTS auto_update_cutoff_date CASCADE;
-- DROP FUNCTION IF EXISTS get_last_sunday CASCADE;
-- DROP FUNCTION IF EXISTS get_next_saturday CASCADE;
-- DROP FUNCTION IF EXISTS has_role_or_higher CASCADE;
-- DROP FUNCTION IF EXISTS has_role CASCADE;
-- DROP FUNCTION IF EXISTS is_super_admin CASCADE;
-- DROP TYPE IF EXISTS app_role CASCADE;

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE public.app_role AS ENUM (
  'employee',
  'manager',
  'finance',
  'admin',
  'super_admin'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- User Roles Table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Users Table
CREATE TABLE public.users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  employee_id text NOT NULL UNIQUE,
  role text NOT NULL,
  location_id uuid,
  manager_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  assigned_clients uuid[],
  hire_date date,
  termination_date date,
  date_of_birth date,
  certification_expiry_dates jsonb,
  last_training_date date,
  performance_rating numeric,
  total_washes_completed integer DEFAULT 0,
  total_revenue_generated numeric DEFAULT 0,
  average_wash_time_minutes integer,
  quality_score_average numeric,
  max_daily_washes integer,
  on_vacation boolean DEFAULT false,
  vacation_until date,
  pay_rate numeric,
  commission_percentage numeric,
  last_login_at timestamp with time zone,
  failed_login_attempts integer DEFAULT 0,
  account_locked_until timestamp with time zone,
  must_change_password boolean DEFAULT false,
  password_changed_at timestamp with time zone,
  two_factor_enabled boolean DEFAULT false,
  bio text,
  preferred_language text DEFAULT 'en',
  notes text,
  tags text[],
  client_access_level text DEFAULT 'all',
  phone_number text,
  emergency_contact_name text,
  emergency_contact_phone text,
  certifications text[],
  training_completed text[],
  default_shift text,
  available_days text[],
  pay_type text,
  last_login_ip text,
  profile_photo_url text
);

-- Locations Table
CREATE TABLE public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  manager_user_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  max_clients_serviced integer DEFAULT 20,
  current_clients_count integer DEFAULT 0,
  operating_hours jsonb,
  max_daily_capacity integer,
  current_capacity_used integer DEFAULT 0,
  has_covered_area boolean DEFAULT false,
  has_pressure_washer boolean DEFAULT false,
  has_detail_bay boolean DEFAULT false,
  latitude numeric,
  longitude numeric,
  tax_rate numeric,
  total_washes_completed integer DEFAULT 0,
  average_washes_per_day numeric,
  total_revenue numeric DEFAULT 0,
  city text,
  state text,
  zip_code text,
  country text DEFAULT 'USA',
  billing_address text,
  billing_contact text,
  notes text,
  photo_url text,
  phone_number text,
  email text,
  contact_person text,
  timezone text DEFAULT 'America/New_York',
  closed_on text[],
  equipment_list text[]
);

-- User Locations Table (Many-to-Many)
CREATE TABLE public.user_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  location_id uuid NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, location_id)
);

-- Clients Table
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_code text NOT NULL UNIQUE,
  client_name text NOT NULL,
  legal_business_name text,
  industry text,
  primary_contact_name text,
  primary_contact_email text,
  primary_contact_phone text,
  billing_contact_name text,
  billing_contact_email text,
  billing_contact_phone text,
  billing_address text,
  billing_city text,
  billing_state text,
  billing_zip text,
  billing_country text DEFAULT 'USA',
  tax_id text,
  payment_terms text DEFAULT 'net_30',
  credit_limit numeric,
  current_balance numeric DEFAULT 0,
  contract_number text,
  contract_start_date date,
  contract_end_date date,
  auto_renew boolean DEFAULT true,
  account_status text DEFAULT 'active',
  is_active boolean DEFAULT true,
  requires_po_number boolean DEFAULT false,
  discount_percentage numeric DEFAULT 0,
  invoice_frequency text DEFAULT 'monthly',
  notes text,
  tags text[],
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid,
  deleted_at timestamp with time zone,
  deleted_by uuid
);

-- Client Locations Table (Many-to-Many)
CREATE TABLE public.client_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  location_id uuid NOT NULL,
  is_primary_location boolean DEFAULT false,
  rate_multiplier numeric DEFAULT 1.0,
  is_active boolean DEFAULT true,
  priority_level text DEFAULT 'standard',
  activated_at timestamp with time zone DEFAULT now(),
  deactivated_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  UNIQUE (client_id, location_id)
);

-- Client Contacts Table
CREATE TABLE public.client_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  contact_name text NOT NULL,
  contact_type text,
  contact_title text,
  contact_email text,
  contact_phone text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Client Notes Table
CREATE TABLE public.client_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  note_text text NOT NULL,
  note_type text DEFAULT 'general',
  is_pinned boolean DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Client Vehicle Rates Table
CREATE TABLE public.client_vehicle_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  vehicle_type_id uuid NOT NULL,
  custom_rate numeric NOT NULL,
  effective_date date NOT NULL,
  expiration_date date,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid
);

-- Vehicle Types Table
CREATE TABLE public.vehicle_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_name text NOT NULL UNIQUE,
  description text,
  rate_per_wash numeric NOT NULL,
  estimated_wash_time_minutes integer,
  requires_special_training boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  icon_name text,
  category text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Vehicles Table
CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_number text NOT NULL UNIQUE,
  vehicle_type_id uuid NOT NULL,
  client_id uuid,
  home_location_id uuid,
  last_seen_location_id uuid,
  last_seen_date date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  client_vehicle_number text,
  make text,
  model text,
  year integer,
  color text,
  license_plate text,
  vin text,
  length_feet numeric,
  width_feet numeric,
  height_feet numeric,
  weight_tons numeric,
  current_condition text,
  current_odometer integer,
  last_maintenance_date date,
  next_maintenance_due_date date,
  maintenance_notes text,
  assigned_driver_id uuid,
  owner_name text,
  owner_contact text,
  fleet_number text,
  requires_special_equipment boolean DEFAULT false,
  special_equipment_notes text,
  estimated_wash_time_minutes integer,
  wash_frequency_days integer,
  custom_rate numeric,
  billing_code text,
  contract_number text,
  last_wash_quality_rating integer,
  total_washes_completed integer DEFAULT 0,
  last_wash_employee_id uuid,
  photo_url text,
  photo_thumbnail_url text,
  notes text,
  tags text[],
  flagged boolean DEFAULT false,
  flag_reason text
);

-- Wash Entries Table
CREATE TABLE public.wash_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  vehicle_id uuid NOT NULL,
  wash_date date NOT NULL,
  actual_location_id uuid NOT NULL,
  client_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  time_started timestamp with time zone,
  time_completed timestamp with time zone,
  wash_duration_minutes integer,
  break_duration_minutes integer,
  quality_rating integer,
  damage_reported boolean DEFAULT false,
  temperature_fahrenheit integer,
  soap_used_gallons numeric,
  water_used_gallons numeric,
  supplies_cost numeric,
  rate_override numeric,
  discount_percentage numeric,
  additional_charges numeric,
  final_amount numeric,
  requires_approval boolean DEFAULT false,
  approved_by uuid,
  approved_at timestamp with time zone,
  quality_checked boolean DEFAULT false,
  quality_checked_by uuid,
  quality_checked_at timestamp with time zone,
  customer_satisfaction integer,
  odometer_reading integer,
  warranty_applies boolean DEFAULT false,
  warranty_expiration_date date,
  rework_required boolean DEFAULT false,
  rework_completed_at timestamp with time zone,
  flagged boolean DEFAULT false,
  deleted_at timestamp with time zone,
  deleted_by uuid,
  rate_at_time_of_wash numeric,
  comment text,
  employee_notes text,
  special_instructions text,
  photo_before_url text,
  photo_after_url text,
  photo_damage_url text,
  photo_proof_url text,
  condition_before text,
  condition_after text,
  damage_description text,
  service_type text DEFAULT 'standard',
  additional_services text[],
  weather_condition text,
  wash_location_type text DEFAULT 'facility',
  rate_override_reason text,
  additional_charges_reason text,
  approval_notes text,
  customer_signature_url text,
  customer_complaint text,
  customer_po_number text,
  fuel_level text,
  rework_reason text,
  flag_reason text,
  priority text DEFAULT 'normal',
  source text DEFAULT 'mobile_app',
  deletion_reason text
);

-- Manager Approval Requests Table
CREATE TABLE public.manager_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  manager_id uuid NOT NULL,
  wash_entry_id uuid NOT NULL,
  request_type text NOT NULL DEFAULT 'remove_entry',
  reason text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- System Settings Table
CREATE TABLE public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value text NOT NULL,
  description text,
  data_type text DEFAULT 'string',
  category text,
  is_public boolean DEFAULT false,
  updated_by uuid,
  updated_at timestamp with time zone DEFAULT now()
);

-- System Settings Audit Table
CREATE TABLE public.system_settings_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL,
  old_value text,
  new_value text NOT NULL,
  changed_by uuid,
  changed_at timestamp with time zone DEFAULT now(),
  change_reason text
);

-- Audit Log Table
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  changed_by uuid,
  changed_at timestamp with time zone DEFAULT now()
);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_vehicle_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wash_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECURITY DEFINER FUNCTIONS
-- ============================================================================

-- Check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
    AND role = 'super_admin'::app_role
  );
$$;

-- Check if user has specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Check if user has role or higher in hierarchy
CREATE OR REPLACE FUNCTION public.has_role_or_higher(_user_id uuid, _required_role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
    AND (
      -- Super admin has access to everything
      (ur.role = 'super_admin') OR
      -- If required role is employee, all roles have access
      (_required_role = 'employee') OR
      -- If required role is manager, manager, finance, and admin have access
      (_required_role = 'manager' AND ur.role IN ('manager', 'finance', 'admin')) OR
      -- If required role is finance, finance and admin have access
      (_required_role = 'finance' AND ur.role IN ('finance', 'admin')) OR
      -- If required role is admin, only admin and super_admin have access
      (_required_role = 'admin' AND ur.role IN ('admin', 'super_admin')) OR
      -- If required role is super_admin, only super_admin has access
      (_required_role = 'super_admin' AND ur.role = 'super_admin')
    )
  );
$$;

-- Get next Saturday at 23:59:59
CREATE OR REPLACE FUNCTION public.get_next_saturday()
RETURNS timestamp with time zone
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today DATE := CURRENT_DATE;
  days_until_saturday INT;
  next_saturday DATE;
BEGIN
  -- Calculate days until next Saturday (0 = Sunday, 6 = Saturday)
  days_until_saturday := (6 - EXTRACT(DOW FROM today)::INT) % 7;
  
  -- If today is Saturday, get next Saturday (7 days from now)
  -- Otherwise get the upcoming Saturday
  IF days_until_saturday = 0 THEN
    next_saturday := today + INTERVAL '7 days';
  ELSE
    next_saturday := today + INTERVAL '1 day' * days_until_saturday;
  END IF;
  
  -- Return Saturday at 23:59:59
  RETURN next_saturday + TIME '23:59:59';
END;
$$;

-- Get last Sunday at 23:59:59
CREATE OR REPLACE FUNCTION public.get_last_sunday()
RETURNS timestamp with time zone
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today DATE := CURRENT_DATE;
  days_since_sunday INT;
  last_sunday DATE;
BEGIN
  -- Calculate days since last Sunday (0 = Sunday, 6 = Saturday)
  days_since_sunday := EXTRACT(DOW FROM today)::INT;
  
  -- If today is Sunday (0), use today
  -- Otherwise, go back to previous Sunday
  IF days_since_sunday = 0 THEN
    last_sunday := today;
  ELSE
    last_sunday := today - INTERVAL '1 day' * days_since_sunday;
  END IF;
  
  -- Return Sunday at 23:59:59
  RETURN last_sunday + TIME '23:59:59';
END;
$$;

-- Automatically update cutoff date to next Saturday
CREATE OR REPLACE FUNCTION public.auto_update_cutoff_date()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_cutoff TIMESTAMP WITH TIME ZONE;
  system_user_id UUID;
BEGIN
  -- Get the next Saturday
  new_cutoff := public.get_next_saturday();
  
  -- Use NULL to indicate automatic system update
  system_user_id := NULL;
  
  -- Update the cutoff date
  UPDATE public.system_settings
  SET 
    setting_value = new_cutoff::TEXT,
    updated_by = system_user_id,
    updated_at = NOW()
  WHERE setting_key = 'entry_cutoff_date';
  
  -- Log to audit trail
  INSERT INTO public.system_settings_audit (
    setting_key,
    old_value,
    new_value,
    changed_by,
    change_reason
  )
  SELECT
    'entry_cutoff_date',
    (SELECT setting_value FROM public.system_settings WHERE setting_key = 'entry_cutoff_date'),
    new_cutoff::TEXT,
    system_user_id,
    'Automatic weekly rollover'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.system_settings_audit
    WHERE setting_key = 'entry_cutoff_date'
    AND DATE(changed_at) = CURRENT_DATE
  );
END;
$$;

-- Trigger function to log system setting changes
CREATE OR REPLACE FUNCTION public.log_system_setting_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.system_settings_audit (
    setting_key,
    old_value,
    new_value,
    changed_by
  ) VALUES (
    NEW.setting_key,
    OLD.setting_value,
    NEW.setting_value,
    NEW.updated_by
  );
  RETURN NEW;
END;
$$;

-- Trigger function to audit wash entries
CREATE OR REPLACE FUNCTION public.audit_wash_entries()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data, changed_by)
    VALUES ('wash_entries', OLD.id, 'DELETE', to_jsonb(OLD), OLD.employee_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES ('wash_entries', NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), NEW.employee_id);
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, record_id, action, new_data, changed_by)
    VALUES ('wash_entries', NEW.id, 'INSERT', to_jsonb(NEW), NEW.employee_id);
    RETURN NEW;
  END IF;
END;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- ============================================================================
-- user_roles RLS Policies
-- ============================================================================

CREATE POLICY "Employees can view their own roles"
ON public.user_roles FOR SELECT
USING ((auth.uid() = user_id) AND has_role(auth.uid(), 'employee'::app_role));

CREATE POLICY "Users with manager role or higher can view all roles"
ON public.user_roles FOR SELECT
USING (has_role_or_higher(auth.uid(), 'manager'::app_role) AND (has_role(auth.uid(), 'super_admin'::app_role) OR (role <> 'super_admin'::app_role)));

CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update roles"
ON public.user_roles FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Prevent editing super admin users by non-super-admins"
ON public.user_roles FOR UPDATE
USING ((role <> 'super_admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Prevent deleting super admin roles by non-super-admins"
ON public.user_roles FOR DELETE
USING ((role <> 'super_admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ============================================================================
-- users RLS Policies
-- ============================================================================

CREATE POLICY "Employees can read their own record"
ON public.users FOR SELECT
USING ((auth.uid() = id) AND has_role(auth.uid(), 'employee'::app_role));

CREATE POLICY "Users with manager role or higher can read all users"
ON public.users FOR SELECT
USING (has_role_or_higher(auth.uid(), 'manager'::app_role) AND (has_role(auth.uid(), 'super_admin'::app_role) OR (NOT is_super_admin(id))));

CREATE POLICY "Admin can insert users"
ON public.users FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update users"
ON public.users FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- locations RLS Policies
-- ============================================================================

CREATE POLICY "All authenticated users can read locations"
ON public.locations FOR SELECT
USING (true);

CREATE POLICY "Admin can insert locations"
ON public.locations FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update locations"
ON public.locations FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- user_locations RLS Policies
-- ============================================================================

CREATE POLICY "Users can view their own location assignments"
ON public.user_locations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users with manager role or higher can view all location assignm"
ON public.user_locations FOR SELECT
USING (has_role_or_higher(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins can manage location assignments"
ON public.user_locations FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- clients RLS Policies
-- ============================================================================

CREATE POLICY "Admins and finance can view all clients"
ON public.clients FOR SELECT
USING (has_role_or_higher(auth.uid(), 'finance'::app_role));

CREATE POLICY "Employees can view clients at their location"
ON public.clients FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM users u
    JOIN client_locations cl ON cl.location_id = u.location_id
    WHERE u.id = auth.uid()
    AND cl.client_id = clients.id
    AND cl.is_active = true
  )
);

CREATE POLICY "Admins can insert clients"
ON public.clients FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update clients"
ON public.clients FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete clients"
ON public.clients FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- client_locations RLS Policies
-- ============================================================================

CREATE POLICY "Authenticated users can view client locations"
ON public.client_locations FOR SELECT
USING (true);

CREATE POLICY "Admins can manage client locations"
ON public.client_locations FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- client_contacts RLS Policies
-- ============================================================================

CREATE POLICY "Finance can view client contacts"
ON public.client_contacts FOR SELECT
USING (has_role_or_higher(auth.uid(), 'finance'::app_role));

CREATE POLICY "Admins can manage client contacts"
ON public.client_contacts FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- client_notes RLS Policies
-- ============================================================================

CREATE POLICY "Finance can view client notes"
ON public.client_notes FOR SELECT
USING (has_role_or_higher(auth.uid(), 'finance'::app_role));

CREATE POLICY "Finance can create client notes"
ON public.client_notes FOR INSERT
WITH CHECK (has_role_or_higher(auth.uid(), 'finance'::app_role));

CREATE POLICY "Admins can manage client notes"
ON public.client_notes FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- client_vehicle_rates RLS Policies
-- ============================================================================

CREATE POLICY "Authenticated users can view client vehicle rates"
ON public.client_vehicle_rates FOR SELECT
USING (true);

CREATE POLICY "Admins can manage client vehicle rates"
ON public.client_vehicle_rates FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- vehicle_types RLS Policies
-- ============================================================================

CREATE POLICY "All authenticated users can read vehicle types"
ON public.vehicle_types FOR SELECT
USING (true);

CREATE POLICY "Admin can insert vehicle types"
ON public.vehicle_types FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update vehicle types"
ON public.vehicle_types FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete vehicle types"
ON public.vehicle_types FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- vehicles RLS Policies
-- ============================================================================

CREATE POLICY "All authenticated users can read vehicles"
ON public.vehicles FOR SELECT
USING (true);

CREATE POLICY "Admin can insert vehicles"
ON public.vehicles FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can create vehicles for wash entries"
ON public.vehicles FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'employee'::app_role) AND
  home_location_id IN (SELECT location_id FROM users WHERE id = auth.uid())
);

CREATE POLICY "Admin can update vehicles"
ON public.vehicles FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete vehicles"
ON public.vehicles FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- wash_entries RLS Policies
-- ============================================================================

CREATE POLICY "Employees can read their own wash entries"
ON public.wash_entries FOR SELECT
USING (auth.uid() = employee_id);

CREATE POLICY "Finance and admin can read all wash entries"
ON public.wash_entries FOR SELECT
USING (has_role_or_higher(auth.uid(), 'finance'::app_role));

CREATE POLICY "Employees can create their own wash entries"
ON public.wash_entries FOR INSERT
WITH CHECK (auth.uid() = employee_id);

CREATE POLICY "Admin can update wash entries"
ON public.wash_entries FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can soft delete approved entries"
ON public.wash_entries FOR UPDATE
USING (has_role_or_higher(auth.uid(), 'manager'::app_role) AND deleted_at IS NULL)
WITH CHECK (has_role_or_higher(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admin can delete wash entries"
ON public.wash_entries FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- manager_approval_requests RLS Policies
-- ============================================================================

CREATE POLICY "Employees can view own approval requests"
ON public.manager_approval_requests FOR SELECT
USING (auth.uid() = employee_id);

CREATE POLICY "Managers can view assigned requests"
ON public.manager_approval_requests FOR SELECT
USING (auth.uid() = manager_id AND status = 'pending');

CREATE POLICY "Admins can view all approval requests"
ON public.manager_approval_requests FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can create approval requests"
ON public.manager_approval_requests FOR INSERT
WITH CHECK (auth.uid() = employee_id);

CREATE POLICY "Managers can update assigned requests"
ON public.manager_approval_requests FOR UPDATE
USING (auth.uid() = manager_id AND status = 'pending');

-- ============================================================================
-- system_settings RLS Policies
-- ============================================================================

CREATE POLICY "All authenticated users can read system settings"
ON public.system_settings FOR SELECT
USING (true);

CREATE POLICY "Admin can insert system settings"
ON public.system_settings FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update system settings"
ON public.system_settings FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- system_settings_audit RLS Policies
-- ============================================================================

CREATE POLICY "All authenticated users can read audit trail"
ON public.system_settings_audit FOR SELECT
USING (true);

CREATE POLICY "System can insert audit records"
ON public.system_settings_audit FOR INSERT
WITH CHECK (true);

-- ============================================================================
-- audit_log RLS Policies
-- ============================================================================

CREATE POLICY "Managers and admins can view audit logs"
ON public.audit_log FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('manager'::app_role, 'admin'::app_role, 'super_admin'::app_role, 'finance'::app_role)
  )
);

CREATE POLICY "System can insert audit logs"
ON public.audit_log FOR INSERT
WITH CHECK (true);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to log system setting changes
CREATE TRIGGER log_system_setting_change_trigger
  AFTER UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.log_system_setting_change();

-- Trigger to audit wash entries
CREATE TRIGGER audit_wash_entries_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.wash_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_wash_entries();

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Insert initial system settings
INSERT INTO public.system_settings (setting_key, setting_value, description, data_type, category) VALUES
('entry_cutoff_date', (public.get_next_saturday())::text, 'Cutoff date for wash entry modifications', 'timestamp', 'operations'),
('app_version', '1.0.0', 'Current application version', 'string', 'system'),
('maintenance_mode', 'false', 'Enable/disable maintenance mode', 'boolean', 'system')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 
-- POST-MIGRATION STEPS:
-- 
-- 1. Configure Authentication:
--    - Go to Authentication > Settings in Supabase Dashboard
--    - Enable Email provider
--    - For dev/staging: Enable "Auto Confirm Email" under Email Auth
--    - Configure email templates if needed
-- 
-- 2. Deploy Edge Functions:
--    - Install Supabase CLI: npm install -g supabase
--    - Login: supabase login
--    - Link project: supabase link --project-ref YOUR_PROJECT_REF
--    - Deploy functions: supabase functions deploy
-- 
--    Edge Functions to deploy:
--    - create-user (requires JWT verification)
--    - reset-user-password (requires JWT verification)
--    - update-cutoff-date (no JWT required)
-- 
-- 3. Migrate Data:
--    - Export data from old database
--    - Import using COPY commands or Supabase Dashboard
--    - Verify data integrity
-- 
-- 4. Update Application Environment:
--    - VITE_SUPABASE_URL=your_project_url
--    - VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
--    - VITE_SUPABASE_PROJECT_ID=your_project_id
-- 
-- 5. Test Thoroughly:
--    - User authentication and authorization
--    - All CRUD operations
--    - RLS policies
--    - Edge functions
--    - Audit logging
-- 
-- 6. Set Up Monitoring:
--    - Enable database metrics
--    - Configure log retention
--    - Set up alerts for errors
-- 
-- ============================================================================
