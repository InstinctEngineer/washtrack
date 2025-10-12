-- CRITICAL ARCHITECTURAL CHANGE: Multi-Client Support
-- Business Model: Multiple clients serviced at each location

-- =====================================================
-- CREATE NEW TABLES FOR MULTI-CLIENT SUPPORT
-- =====================================================

-- Clients table (companies being serviced)
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_code TEXT UNIQUE NOT NULL,
  client_name TEXT NOT NULL,
  legal_business_name TEXT,
  industry TEXT,
  
  -- Contact information
  primary_contact_name TEXT,
  primary_contact_email TEXT,
  primary_contact_phone TEXT,
  billing_contact_name TEXT,
  billing_contact_email TEXT,
  billing_contact_phone TEXT,
  
  -- Address
  billing_address TEXT,
  billing_city TEXT,
  billing_state TEXT,
  billing_zip TEXT,
  billing_country TEXT DEFAULT 'USA',
  
  -- Business details
  tax_id TEXT,
  payment_terms TEXT DEFAULT 'net_30' CHECK (payment_terms IN ('net_15', 'net_30', 'net_45', 'net_60', 'due_on_receipt', 'prepaid')),
  credit_limit DECIMAL(10,2),
  current_balance DECIMAL(10,2) DEFAULT 0,
  
  -- Contract details
  contract_number TEXT,
  contract_start_date DATE,
  contract_end_date DATE,
  auto_renew BOOLEAN DEFAULT TRUE,
  
  -- Status and settings
  is_active BOOLEAN DEFAULT TRUE,
  account_status TEXT DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'past_due', 'collections', 'inactive')),
  requires_po_number BOOLEAN DEFAULT FALSE,
  
  -- Custom billing
  invoice_frequency TEXT DEFAULT 'monthly' CHECK (invoice_frequency IN ('weekly', 'bi_weekly', 'monthly', 'quarterly', 'per_wash')),
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  
  -- Notes and metadata
  notes TEXT,
  tags TEXT[],
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES public.users(id),
  
  -- Soft delete
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID REFERENCES public.users(id)
);

-- Junction table: Which clients are serviced at which locations
CREATE TABLE IF NOT EXISTS public.client_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  
  -- Location-specific settings for this client
  is_primary_location BOOLEAN DEFAULT FALSE,
  priority_level TEXT DEFAULT 'standard' CHECK (priority_level IN ('low', 'standard', 'high', 'vip')),
  
  -- Custom rates at this location
  rate_multiplier DECIMAL(5,2) DEFAULT 1.0,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  activated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deactivated_at TIMESTAMP WITH TIME ZONE,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id),
  
  UNIQUE(client_id, location_id)
);

-- Client-specific vehicle types and rates
CREATE TABLE IF NOT EXISTS public.client_vehicle_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  vehicle_type_id UUID NOT NULL REFERENCES public.vehicle_types(id) ON DELETE CASCADE,
  
  -- Custom rate for this client-vehicle type combination
  custom_rate DECIMAL(10,2) NOT NULL,
  effective_date DATE NOT NULL,
  expiration_date DATE,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id),
  
  UNIQUE(client_id, vehicle_type_id, effective_date)
);

-- Client contacts (multiple contacts per client)
CREATE TABLE IF NOT EXISTS public.client_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  
  contact_name TEXT NOT NULL,
  contact_title TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  contact_type TEXT CHECK (contact_type IN ('primary', 'billing', 'operations', 'emergency', 'other')),
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Client notes and communication log
CREATE TABLE IF NOT EXISTS public.client_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  
  note_text TEXT NOT NULL,
  note_type TEXT DEFAULT 'general' CHECK (note_type IN ('general', 'billing', 'complaint', 'compliment', 'contract', 'important')),
  is_pinned BOOLEAN DEFAULT FALSE,
  
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- MODIFY EXISTING TABLES FOR MULTI-CLIENT
-- =====================================================

-- Add client_id to vehicles (vehicles belong to clients)
ALTER TABLE public.vehicles 
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_vehicle_number TEXT;

-- Add client_id to wash_entries (denormalized for query performance)
ALTER TABLE public.wash_entries 
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

-- Add client access to users
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS assigned_clients UUID[],
  ADD COLUMN IF NOT EXISTS client_access_level TEXT DEFAULT 'all' CHECK (client_access_level IN ('all', 'assigned_only', 'location_only'));

-- Locations client capacity tracking
ALTER TABLE public.locations 
  ADD COLUMN IF NOT EXISTS max_clients_serviced INTEGER DEFAULT 20,
  ADD COLUMN IF NOT EXISTS current_clients_count INTEGER DEFAULT 0;

-- =====================================================
-- FUTURE-PROOFING COLUMNS (NULLABLE, UNUSED INITIALLY)
-- =====================================================

-- WASH ENTRIES EXPANSION
ALTER TABLE public.wash_entries 
  ADD COLUMN IF NOT EXISTS comment TEXT,
  ADD COLUMN IF NOT EXISTS employee_notes TEXT,
  ADD COLUMN IF NOT EXISTS special_instructions TEXT,
  
  ADD COLUMN IF NOT EXISTS photo_before_url TEXT,
  ADD COLUMN IF NOT EXISTS photo_after_url TEXT,
  ADD COLUMN IF NOT EXISTS photo_damage_url TEXT,
  ADD COLUMN IF NOT EXISTS photo_proof_url TEXT,
  
  ADD COLUMN IF NOT EXISTS time_started TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS time_completed TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS wash_duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS break_duration_minutes INTEGER,
  
  ADD COLUMN IF NOT EXISTS quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS condition_before TEXT CHECK (condition_before IN ('excellent', 'good', 'fair', 'poor', 'damaged')),
  ADD COLUMN IF NOT EXISTS condition_after TEXT CHECK (condition_after IN ('excellent', 'good', 'fair', 'poor', 'damaged')),
  ADD COLUMN IF NOT EXISTS damage_reported BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS damage_description TEXT,
  
  ADD COLUMN IF NOT EXISTS service_type TEXT DEFAULT 'standard' CHECK (service_type IN ('standard', 'detail', 'express', 'deep_clean', 'exterior_only', 'interior_only')),
  ADD COLUMN IF NOT EXISTS additional_services TEXT[],
  
  ADD COLUMN IF NOT EXISTS weather_condition TEXT CHECK (weather_condition IN ('sunny', 'cloudy', 'rainy', 'snowy', 'windy', 'extreme_heat', 'extreme_cold')),
  ADD COLUMN IF NOT EXISTS temperature_fahrenheit INTEGER,
  ADD COLUMN IF NOT EXISTS wash_location_type TEXT DEFAULT 'facility' CHECK (wash_location_type IN ('facility', 'field', 'customer_site', 'mobile')),
  
  ADD COLUMN IF NOT EXISTS soap_used_gallons DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS water_used_gallons DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS supplies_cost DECIMAL(10,2),
  
  ADD COLUMN IF NOT EXISTS rate_override DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS rate_override_reason TEXT,
  ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS additional_charges DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS additional_charges_reason TEXT,
  ADD COLUMN IF NOT EXISTS final_amount DECIMAL(10,2),
  
  ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS approval_notes TEXT,
  ADD COLUMN IF NOT EXISTS quality_checked BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS quality_checked_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS quality_checked_at TIMESTAMP WITH TIME ZONE,
  
  ADD COLUMN IF NOT EXISTS customer_signature_url TEXT,
  ADD COLUMN IF NOT EXISTS customer_satisfaction INTEGER CHECK (customer_satisfaction BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS customer_complaint TEXT,
  ADD COLUMN IF NOT EXISTS customer_po_number TEXT,
  
  ADD COLUMN IF NOT EXISTS odometer_reading INTEGER,
  ADD COLUMN IF NOT EXISTS fuel_level TEXT CHECK (fuel_level IN ('empty', 'quarter', 'half', 'three_quarters', 'full')),
  
  ADD COLUMN IF NOT EXISTS warranty_applies BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS warranty_expiration_date DATE,
  ADD COLUMN IF NOT EXISTS rework_required BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rework_reason TEXT,
  ADD COLUMN IF NOT EXISTS rework_completed_at TIMESTAMP WITH TIME ZONE,
  
  ADD COLUMN IF NOT EXISTS flagged BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS flag_reason TEXT,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'mobile_app' CHECK (source IN ('mobile_app', 'web_app', 'admin_override', 'import', 'api')),
  
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- USERS EXPANSION
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS hire_date DATE,
  ADD COLUMN IF NOT EXISTS termination_date DATE,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  
  ADD COLUMN IF NOT EXISTS certifications TEXT[],
  ADD COLUMN IF NOT EXISTS certification_expiry_dates JSONB,
  ADD COLUMN IF NOT EXISTS training_completed TEXT[],
  ADD COLUMN IF NOT EXISTS last_training_date DATE,
  
  ADD COLUMN IF NOT EXISTS performance_rating DECIMAL(3,2) CHECK (performance_rating BETWEEN 0 AND 5),
  ADD COLUMN IF NOT EXISTS total_washes_completed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_revenue_generated DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS average_wash_time_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS quality_score_average DECIMAL(3,2),
  
  ADD COLUMN IF NOT EXISTS default_shift TEXT CHECK (default_shift IN ('morning', 'afternoon', 'evening', 'night', 'rotating')),
  ADD COLUMN IF NOT EXISTS max_daily_washes INTEGER,
  ADD COLUMN IF NOT EXISTS available_days TEXT[],
  ADD COLUMN IF NOT EXISTS on_vacation BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS vacation_until DATE,
  
  ADD COLUMN IF NOT EXISTS pay_rate DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS pay_type TEXT CHECK (pay_type IN ('hourly', 'salary', 'commission', 'per_wash')),
  ADD COLUMN IF NOT EXISTS commission_percentage DECIMAL(5,2),
  
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_login_ip TEXT,
  ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS account_locked_until TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE,
  
  ADD COLUMN IF NOT EXISTS profile_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en' CHECK (preferred_language IN ('en', 'es', 'fr')),
  
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[];

-- VEHICLES EXPANSION
ALTER TABLE public.vehicles 
  ADD COLUMN IF NOT EXISTS make TEXT,
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS year INTEGER,
  ADD COLUMN IF NOT EXISTS color TEXT,
  ADD COLUMN IF NOT EXISTS license_plate TEXT,
  ADD COLUMN IF NOT EXISTS vin TEXT,
  
  ADD COLUMN IF NOT EXISTS length_feet DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS width_feet DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS height_feet DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS weight_tons DECIMAL(10,2),
  
  ADD COLUMN IF NOT EXISTS current_condition TEXT CHECK (current_condition IN ('excellent', 'good', 'fair', 'poor', 'out_of_service')),
  ADD COLUMN IF NOT EXISTS current_odometer INTEGER,
  ADD COLUMN IF NOT EXISTS last_maintenance_date DATE,
  ADD COLUMN IF NOT EXISTS next_maintenance_due_date DATE,
  ADD COLUMN IF NOT EXISTS maintenance_notes TEXT,
  
  ADD COLUMN IF NOT EXISTS owner_name TEXT,
  ADD COLUMN IF NOT EXISTS owner_contact TEXT,
  ADD COLUMN IF NOT EXISTS assigned_driver_id UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS fleet_number TEXT,
  
  ADD COLUMN IF NOT EXISTS requires_special_equipment BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS special_equipment_notes TEXT,
  ADD COLUMN IF NOT EXISTS estimated_wash_time_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS wash_frequency_days INTEGER,
  
  ADD COLUMN IF NOT EXISTS custom_rate DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS billing_code TEXT,
  ADD COLUMN IF NOT EXISTS contract_number TEXT,
  
  ADD COLUMN IF NOT EXISTS last_wash_quality_rating INTEGER,
  ADD COLUMN IF NOT EXISTS total_washes_completed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_wash_employee_id UUID REFERENCES public.users(id),
  
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS photo_thumbnail_url TEXT,
  
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[],
  ADD COLUMN IF NOT EXISTS flagged BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS flag_reason TEXT;

-- Add unique constraint on VIN if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_vin_key'
  ) THEN
    ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_vin_key UNIQUE (vin);
  END IF;
END $$;

-- LOCATIONS EXPANSION
ALTER TABLE public.locations 
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS contact_person TEXT,
  
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York',
  ADD COLUMN IF NOT EXISTS operating_hours JSONB,
  ADD COLUMN IF NOT EXISTS closed_on TEXT[],
  
  ADD COLUMN IF NOT EXISTS max_daily_capacity INTEGER,
  ADD COLUMN IF NOT EXISTS current_capacity_used INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS equipment_list TEXT[],
  ADD COLUMN IF NOT EXISTS has_covered_area BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_pressure_washer BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_detail_bay BOOLEAN DEFAULT FALSE,
  
  ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,8),
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8),
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS zip_code TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'USA',
  
  ADD COLUMN IF NOT EXISTS billing_address TEXT,
  ADD COLUMN IF NOT EXISTS billing_contact TEXT,
  ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,4),
  
  ADD COLUMN IF NOT EXISTS total_washes_completed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS average_washes_per_day DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS total_revenue DECIMAL(10,2) DEFAULT 0,
  
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- VEHICLE TYPES EXPANSION
ALTER TABLE public.vehicle_types 
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS estimated_wash_time_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS requires_special_training BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS icon_name TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS category TEXT;

-- SYSTEM SETTINGS EXPANSION
ALTER TABLE public.system_settings 
  ADD COLUMN IF NOT EXISTS data_type TEXT DEFAULT 'string' CHECK (data_type IN ('string', 'integer', 'boolean', 'json', 'date')),
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS category TEXT;

-- =====================================================
-- CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Client indexes
CREATE INDEX IF NOT EXISTS idx_clients_active ON public.clients(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_clients_account_status ON public.clients(account_status);
CREATE INDEX IF NOT EXISTS idx_clients_code ON public.clients(client_code);

-- Client-location junction indexes
CREATE INDEX IF NOT EXISTS idx_client_locations_client ON public.client_locations(client_id);
CREATE INDEX IF NOT EXISTS idx_client_locations_location ON public.client_locations(location_id);
CREATE INDEX IF NOT EXISTS idx_client_locations_active ON public.client_locations(client_id, location_id) WHERE is_active = TRUE;

-- Wash entries indexes
CREATE INDEX IF NOT EXISTS idx_wash_entries_employee_date ON public.wash_entries(employee_id, wash_date);
CREATE INDEX IF NOT EXISTS idx_wash_entries_location_date ON public.wash_entries(actual_location_id, wash_date);
CREATE INDEX IF NOT EXISTS idx_wash_entries_client_date ON public.wash_entries(client_id, wash_date);
CREATE INDEX IF NOT EXISTS idx_wash_entries_deleted_at ON public.wash_entries(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wash_entries_flagged ON public.wash_entries(flagged) WHERE flagged = TRUE;

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_location ON public.users(location_id);
CREATE INDEX IF NOT EXISTS idx_users_manager ON public.users(manager_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON public.users(is_active) WHERE is_active = TRUE;

-- Vehicles indexes
CREATE INDEX IF NOT EXISTS idx_vehicles_client ON public.vehicles(client_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_home_location ON public.vehicles(home_location_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_last_seen_location ON public.vehicles(last_seen_location_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_type ON public.vehicles(vehicle_type_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_active ON public.vehicles(is_active) WHERE is_active = TRUE;

-- =====================================================
-- ENABLE RLS ON NEW TABLES
-- =====================================================

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_vehicle_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- CREATE RLS POLICIES FOR MULTI-CLIENT ACCESS
-- =====================================================

-- Clients: Admins and finance can see all clients
CREATE POLICY "Admins and finance can view all clients"
ON public.clients FOR SELECT
USING (
  public.has_role_or_higher(auth.uid(), 'finance'::app_role)
);

-- Employees can only see clients at their assigned location
CREATE POLICY "Employees can view clients at their location"
ON public.clients FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.client_locations cl ON cl.location_id = u.location_id
    WHERE u.id = auth.uid()
    AND cl.client_id = public.clients.id
    AND cl.is_active = TRUE
  )
);

-- Admins can manage clients
CREATE POLICY "Admins can insert clients"
ON public.clients FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update clients"
ON public.clients FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete clients"
ON public.clients FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Client Locations: All authenticated can read
CREATE POLICY "Authenticated users can view client locations"
ON public.client_locations FOR SELECT
USING (true);

CREATE POLICY "Admins can manage client locations"
ON public.client_locations FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Client Vehicle Rates: All authenticated can read
CREATE POLICY "Authenticated users can view client vehicle rates"
ON public.client_vehicle_rates FOR SELECT
USING (true);

CREATE POLICY "Admins can manage client vehicle rates"
ON public.client_vehicle_rates FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Client Contacts: Finance and admins can see all
CREATE POLICY "Finance can view client contacts"
ON public.client_contacts FOR SELECT
USING (public.has_role_or_higher(auth.uid(), 'finance'::app_role));

CREATE POLICY "Admins can manage client contacts"
ON public.client_contacts FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Client Notes: Finance and admins can see all
CREATE POLICY "Finance can view client notes"
ON public.client_notes FOR SELECT
USING (public.has_role_or_higher(auth.uid(), 'finance'::app_role));

CREATE POLICY "Finance can create client notes"
ON public.client_notes FOR INSERT
WITH CHECK (public.has_role_or_higher(auth.uid(), 'finance'::app_role));

CREATE POLICY "Admins can manage client notes"
ON public.client_notes FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));