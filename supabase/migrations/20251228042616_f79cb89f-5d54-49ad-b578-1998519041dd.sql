
-- ============================================
-- PHASE 1: SCHEMA REBUILD MIGRATION
-- ============================================

-- Step 1: Clear existing foreign key references
UPDATE public.users SET location_id = NULL;
DELETE FROM public.user_locations;

-- Step 2: Drop existing foreign key constraints on users and user_locations
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_location_id_fkey;
ALTER TABLE public.user_locations DROP CONSTRAINT IF EXISTS user_locations_location_id_fkey;

-- Step 3: Drop old tables in dependency order
DROP TABLE IF EXISTS public.work_entries CASCADE;
DROP TABLE IF EXISTS public.client_vehicle_rates CASCADE;
DROP TABLE IF EXISTS public.location_service_rates CASCADE;
DROP TABLE IF EXISTS public.client_notes CASCADE;
DROP TABLE IF EXISTS public.client_contacts CASCADE;
DROP TABLE IF EXISTS public.client_locations CASCADE;
DROP TABLE IF EXISTS public.vehicles CASCADE;
DROP TABLE IF EXISTS public.vehicle_types CASCADE;
DROP TABLE IF EXISTS public.wash_frequencies CASCADE;
DROP TABLE IF EXISTS public.service_categories CASCADE;
DROP TABLE IF EXISTS public.locations CASCADE;
DROP TABLE IF EXISTS public.clients CASCADE;

-- Step 4: Create new clients table
CREATE TABLE public.clients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    parent_company text,
    billing_address text,
    contact_name text,
    contact_email text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Step 5: Create new locations table
CREATE TABLE public.locations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    address text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Step 6: Create billable_items table
CREATE TABLE public.billable_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    work_type text NOT NULL,
    frequency text,
    rate decimal,
    rate_type text NOT NULL CHECK (rate_type IN ('per_unit', 'hourly')),
    needs_rate_review boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (client_id, location_id, work_type, frequency)
);

-- Step 7: Create work_logs table
CREATE TABLE public.work_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    billable_item_id uuid NOT NULL REFERENCES public.billable_items(id) ON DELETE RESTRICT,
    employee_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    work_date date NOT NULL,
    quantity decimal NOT NULL,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Step 8: Restore foreign keys on existing tables
ALTER TABLE public.users 
ADD CONSTRAINT users_location_id_fkey 
FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;

ALTER TABLE public.user_locations 
ADD CONSTRAINT user_locations_location_id_fkey 
FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE CASCADE;

-- Step 9: Create rate inheritance function
CREATE OR REPLACE FUNCTION public.inherit_rate_for_billable_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    inherited_rate decimal;
BEGIN
    -- Only run if rate is not already set
    IF NEW.rate IS NULL THEN
        -- Look for existing item with same client + location + work_type + frequency with a rate
        SELECT rate INTO inherited_rate
        FROM public.billable_items
        WHERE client_id = NEW.client_id
          AND location_id = NEW.location_id
          AND work_type = NEW.work_type
          AND (
              (frequency IS NULL AND NEW.frequency IS NULL) OR
              (frequency = NEW.frequency)
          )
          AND rate IS NOT NULL
          AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        LIMIT 1;
        
        IF inherited_rate IS NOT NULL THEN
            NEW.rate := inherited_rate;
            NEW.needs_rate_review := false;
        ELSE
            NEW.needs_rate_review := true;
        END IF;
    ELSE
        NEW.needs_rate_review := false;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Step 10: Create trigger for rate inheritance
CREATE TRIGGER inherit_rate_trigger
BEFORE INSERT ON public.billable_items
FOR EACH ROW
EXECUTE FUNCTION public.inherit_rate_for_billable_item();

-- Step 11: Enable RLS on all new tables
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billable_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_logs ENABLE ROW LEVEL SECURITY;

-- Step 12: RLS policies for clients
CREATE POLICY "Admins can manage clients"
ON public.clients FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Finance can view clients"
ON public.clients FOR SELECT
USING (has_role_or_higher(auth.uid(), 'finance'::app_role));

CREATE POLICY "Employees can view assigned clients"
ON public.clients FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.locations l
        JOIN public.user_locations ul ON ul.location_id = l.id
        WHERE l.client_id = clients.id
        AND ul.user_id = auth.uid()
    )
);

-- Step 13: RLS policies for locations
CREATE POLICY "Admins can manage locations"
ON public.locations FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Finance can view locations"
ON public.locations FOR SELECT
USING (has_role_or_higher(auth.uid(), 'finance'::app_role));

CREATE POLICY "Employees can view assigned locations"
ON public.locations FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.user_locations ul
        WHERE ul.location_id = locations.id
        AND ul.user_id = auth.uid()
    )
);

-- Step 14: RLS policies for billable_items
CREATE POLICY "Admins can manage billable_items"
ON public.billable_items FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Finance can view billable_items"
ON public.billable_items FOR SELECT
USING (has_role_or_higher(auth.uid(), 'finance'::app_role));

CREATE POLICY "Finance can update billable_items"
ON public.billable_items FOR UPDATE
USING (has_role_or_higher(auth.uid(), 'finance'::app_role));

CREATE POLICY "Employees can view assigned billable_items"
ON public.billable_items FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.user_locations ul
        WHERE ul.location_id = billable_items.location_id
        AND ul.user_id = auth.uid()
    )
);

CREATE POLICY "Employees can insert billable_items"
ON public.billable_items FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_locations ul
        WHERE ul.location_id = location_id
        AND ul.user_id = auth.uid()
    )
);

-- Step 15: RLS policies for work_logs
CREATE POLICY "Admins can manage work_logs"
ON public.work_logs FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Finance can view work_logs"
ON public.work_logs FOR SELECT
USING (has_role_or_higher(auth.uid(), 'finance'::app_role));

CREATE POLICY "Employees can view own work_logs"
ON public.work_logs FOR SELECT
USING (employee_id = auth.uid());

CREATE POLICY "Employees can insert work_logs"
ON public.work_logs FOR INSERT
WITH CHECK (
    employee_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM public.billable_items bi
        JOIN public.user_locations ul ON ul.location_id = bi.location_id
        WHERE bi.id = billable_item_id
        AND ul.user_id = auth.uid()
    )
);

-- Step 16: Create indexes for performance
CREATE INDEX idx_locations_client_id ON public.locations(client_id);
CREATE INDEX idx_billable_items_client_id ON public.billable_items(client_id);
CREATE INDEX idx_billable_items_location_id ON public.billable_items(location_id);
CREATE INDEX idx_billable_items_needs_review ON public.billable_items(needs_rate_review) WHERE needs_rate_review = true;
CREATE INDEX idx_work_logs_employee_id ON public.work_logs(employee_id);
CREATE INDEX idx_work_logs_work_date ON public.work_logs(work_date);
CREATE INDEX idx_work_logs_billable_item_id ON public.work_logs(billable_item_id);
