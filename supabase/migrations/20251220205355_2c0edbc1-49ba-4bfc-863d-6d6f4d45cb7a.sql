-- ================================================
-- PHASE 1: Normalized Database Design Migration
-- ================================================

-- 1. Create service_categories table (single-purpose lookup)
CREATE TABLE public.service_categories (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    category_code TEXT NOT NULL UNIQUE,
    category_name TEXT NOT NULL,
    is_hourly_default BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on service_categories
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies for service_categories
CREATE POLICY "All authenticated users can read service categories"
ON public.service_categories FOR SELECT
USING (true);

CREATE POLICY "Admin can insert service categories"
ON public.service_categories FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update service categories"
ON public.service_categories FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete service categories"
ON public.service_categories FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Create wash_frequencies table (single-purpose lookup)
CREATE TABLE public.wash_frequencies (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    frequency_code TEXT NOT NULL UNIQUE,
    frequency_name TEXT NOT NULL,
    washes_per_week NUMERIC,
    rate_multiplier NUMERIC NOT NULL DEFAULT 1.0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on wash_frequencies
ALTER TABLE public.wash_frequencies ENABLE ROW LEVEL SECURITY;

-- RLS policies for wash_frequencies
CREATE POLICY "All authenticated users can read wash frequencies"
ON public.wash_frequencies FOR SELECT
USING (true);

CREATE POLICY "Admin can insert wash frequencies"
ON public.wash_frequencies FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update wash frequencies"
ON public.wash_frequencies FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete wash frequencies"
ON public.wash_frequencies FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Create location_service_rates junction table (master rate lookup)
CREATE TABLE public.location_service_rates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    location_id UUID NOT NULL REFERENCES public.locations(id),
    client_id UUID REFERENCES public.clients(id),
    vehicle_type_id UUID REFERENCES public.vehicle_types(id),
    service_category_id UUID REFERENCES public.service_categories(id),
    frequency_id UUID REFERENCES public.wash_frequencies(id),
    rate NUMERIC NOT NULL,
    is_hourly BOOLEAN NOT NULL DEFAULT false,
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiration_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    notes TEXT
);

-- Enable RLS on location_service_rates
ALTER TABLE public.location_service_rates ENABLE ROW LEVEL SECURITY;

-- RLS policies for location_service_rates
CREATE POLICY "All authenticated users can read location service rates"
ON public.location_service_rates FOR SELECT
USING (true);

CREATE POLICY "Admin can insert location service rates"
ON public.location_service_rates FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update location service rates"
ON public.location_service_rates FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete location service rates"
ON public.location_service_rates FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. Rename wash_entries to work_entries
ALTER TABLE public.wash_entries RENAME TO work_entries;

-- 5. Rename columns in work_entries
ALTER TABLE public.work_entries RENAME COLUMN wash_date TO work_date;
ALTER TABLE public.work_entries RENAME COLUMN actual_location_id TO location_id;

-- 6. Add new columns to work_entries
ALTER TABLE public.work_entries
ADD COLUMN service_category_id UUID REFERENCES public.service_categories(id),
ADD COLUMN frequency_id UUID REFERENCES public.wash_frequencies(id),
ADD COLUMN direct_vehicle_type_id UUID REFERENCES public.vehicle_types(id),
ADD COLUMN quantity NUMERIC DEFAULT 1,
ADD COLUMN unit_rate_applied NUMERIC,
ADD COLUMN line_total NUMERIC,
ADD COLUMN is_additional_work BOOLEAN DEFAULT false,
ADD COLUMN additional_work_description TEXT,
ADD COLUMN hours_worked NUMERIC;

-- 7. Make vehicle_id nullable for non-vehicle work
ALTER TABLE public.work_entries ALTER COLUMN vehicle_id DROP NOT NULL;

-- 8. Add columns to locations table
ALTER TABLE public.locations
ADD COLUMN IF NOT EXISTS location_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS tax_jurisdiction TEXT;

-- 9. Update the audit trigger function to use new table name
CREATE OR REPLACE FUNCTION public.audit_work_entries()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data, changed_by)
    VALUES ('work_entries', OLD.id, 'DELETE', to_jsonb(OLD), OLD.employee_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES ('work_entries', NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), NEW.employee_id);
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, record_id, action, new_data, changed_by)
    VALUES ('work_entries', NEW.id, 'INSERT', to_jsonb(NEW), NEW.employee_id);
    RETURN NEW;
  END IF;
END;
$function$;

-- 10. Drop old trigger and create new one
DROP TRIGGER IF EXISTS audit_wash_entries_trigger ON public.work_entries;
CREATE TRIGGER audit_work_entries_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.work_entries
FOR EACH ROW EXECUTE FUNCTION public.audit_work_entries();

-- 11. Update RLS policies for work_entries (renamed from wash_entries)
-- First drop the old policies
DROP POLICY IF EXISTS "Admin can delete wash entries" ON public.work_entries;
DROP POLICY IF EXISTS "Admin can update wash entries" ON public.work_entries;
DROP POLICY IF EXISTS "Employees can create their own wash entries" ON public.work_entries;
DROP POLICY IF EXISTS "Employees can read their own wash entries" ON public.work_entries;
DROP POLICY IF EXISTS "Finance and admin can read all wash entries" ON public.work_entries;
DROP POLICY IF EXISTS "Managers can soft delete approved entries" ON public.work_entries;
DROP POLICY IF EXISTS "Users can view wash entries at their locations" ON public.work_entries;

-- Create new policies with updated names
CREATE POLICY "Admin can delete work entries"
ON public.work_entries FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update work entries"
ON public.work_entries FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can create their own work entries"
ON public.work_entries FOR INSERT
WITH CHECK (auth.uid() = employee_id);

CREATE POLICY "Employees can read their own work entries"
ON public.work_entries FOR SELECT
USING (auth.uid() = employee_id);

CREATE POLICY "Finance and admin can read all work entries"
ON public.work_entries FOR SELECT
USING (has_role_or_higher(auth.uid(), 'finance'::app_role));

CREATE POLICY "Managers can soft delete approved entries"
ON public.work_entries FOR UPDATE
USING (has_role_or_higher(auth.uid(), 'manager'::app_role) AND deleted_at IS NULL)
WITH CHECK (has_role_or_higher(auth.uid(), 'manager'::app_role));

CREATE POLICY "Users can view work entries at their locations"
ON public.work_entries FOR SELECT
USING (
  location_id IN (
    SELECT user_locations.location_id FROM user_locations WHERE user_locations.user_id = auth.uid()
    UNION
    SELECT users.location_id FROM users WHERE users.id = auth.uid() AND users.location_id IS NOT NULL
  )
);

-- 12. Create rate lookup function
CREATE OR REPLACE FUNCTION public.get_applicable_rate(
    p_location_id UUID,
    p_client_id UUID DEFAULT NULL,
    p_vehicle_type_id UUID DEFAULT NULL,
    p_service_category_id UUID DEFAULT NULL,
    p_frequency_id UUID DEFAULT NULL,
    p_work_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    rate NUMERIC,
    is_hourly BOOLEAN,
    rate_source TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Return the most specific matching rate
    RETURN QUERY
    SELECT 
        lsr.rate,
        lsr.is_hourly,
        CASE
            WHEN lsr.client_id IS NOT NULL AND lsr.vehicle_type_id IS NOT NULL AND lsr.service_category_id IS NOT NULL AND lsr.frequency_id IS NOT NULL
                THEN 'client+vehicle+category+frequency'
            WHEN lsr.client_id IS NOT NULL AND lsr.vehicle_type_id IS NOT NULL AND lsr.service_category_id IS NOT NULL
                THEN 'client+vehicle+category'
            WHEN lsr.client_id IS NOT NULL AND lsr.vehicle_type_id IS NOT NULL
                THEN 'client+vehicle'
            WHEN lsr.client_id IS NOT NULL AND lsr.service_category_id IS NOT NULL
                THEN 'client+category'
            WHEN lsr.vehicle_type_id IS NOT NULL AND lsr.service_category_id IS NOT NULL
                THEN 'vehicle+category'
            WHEN lsr.client_id IS NOT NULL
                THEN 'client'
            WHEN lsr.vehicle_type_id IS NOT NULL
                THEN 'vehicle_type'
            WHEN lsr.service_category_id IS NOT NULL
                THEN 'category'
            ELSE 'location_default'
        END as rate_source
    FROM location_service_rates lsr
    WHERE lsr.location_id = p_location_id
      AND lsr.is_active = true
      AND lsr.effective_date <= p_work_date
      AND (lsr.expiration_date IS NULL OR lsr.expiration_date >= p_work_date)
      AND (lsr.client_id IS NULL OR lsr.client_id = p_client_id)
      AND (lsr.vehicle_type_id IS NULL OR lsr.vehicle_type_id = p_vehicle_type_id)
      AND (lsr.service_category_id IS NULL OR lsr.service_category_id = p_service_category_id)
      AND (lsr.frequency_id IS NULL OR lsr.frequency_id = p_frequency_id)
    ORDER BY
        -- Most specific matches first (count non-null optional columns)
        (CASE WHEN lsr.client_id IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN lsr.vehicle_type_id IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN lsr.service_category_id IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN lsr.frequency_id IS NOT NULL THEN 1 ELSE 0 END) DESC,
        lsr.effective_date DESC
    LIMIT 1;
END;
$$;

-- 13. Seed initial service categories
INSERT INTO public.service_categories (category_code, category_name, is_hourly_default, sort_order) VALUES
    ('WASH_VEHICLE', 'Vehicle Washing', false, 1),
    ('WASH_TRACTOR', 'Yard Tractor Washing', false, 2),
    ('WASH_TRAILER', 'Trailer Washing', false, 3),
    ('JANITORIAL', 'Janitorial', true, 4),
    ('LABOR_ADDL', 'Additional Labor', true, 5),
    ('MISC', 'Miscellaneous', false, 6);

-- 14. Seed initial wash frequencies
INSERT INTO public.wash_frequencies (frequency_code, frequency_name, washes_per_week, rate_multiplier, sort_order) VALUES
    ('1X_WEEK', '1x per week', 1, 1.0, 1),
    ('2X_WEEK', '2x per week', 2, 0.85, 2),
    ('3X_WEEK', '3x per week', 3, 0.75, 3),
    ('MONTHLY', 'Monthly', 0.25, 1.25, 4),
    ('ON_DEMAND', 'On Demand', NULL, 1.0, 5);