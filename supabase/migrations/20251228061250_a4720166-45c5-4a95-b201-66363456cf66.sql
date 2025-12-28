-- ============================================
-- Phase 1: Create New Tables
-- ============================================

-- 1. Create work_types table
CREATE TABLE public.work_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  rate_type TEXT NOT NULL CHECK (rate_type IN ('per_unit', 'hourly')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create rate_configs table (without inline unique constraint)
CREATE TABLE public.rate_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  work_type_id UUID NOT NULL REFERENCES public.work_types(id) ON DELETE CASCADE,
  frequency TEXT,
  rate DECIMAL,
  needs_rate_review BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create unique index that handles NULL frequency properly
CREATE UNIQUE INDEX idx_rate_configs_unique 
ON public.rate_configs (client_id, location_id, work_type_id, COALESCE(frequency, ''));

-- 3. Create work_items table
CREATE TABLE public.work_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_config_id UUID NOT NULL REFERENCES public.rate_configs(id) ON DELETE CASCADE,
  identifier TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rate_config_id, identifier)
);

-- ============================================
-- Phase 2: Migrate Existing Data
-- ============================================

-- 1. Seed work_types from existing billable_items
INSERT INTO public.work_types (name, rate_type)
SELECT DISTINCT work_type, rate_type FROM public.billable_items
ON CONFLICT (name) DO NOTHING;

-- 2. Create rate_configs from grouped billable_items
INSERT INTO public.rate_configs (client_id, location_id, work_type_id, frequency, rate, needs_rate_review)
SELECT DISTINCT 
  bi.client_id,
  bi.location_id,
  wt.id,
  bi.frequency,
  MAX(bi.rate),
  BOOL_OR(bi.needs_rate_review)
FROM public.billable_items bi
JOIN public.work_types wt ON wt.name = bi.work_type
GROUP BY bi.client_id, bi.location_id, wt.id, bi.frequency;

-- 3. Migrate individual items to work_items
INSERT INTO public.work_items (rate_config_id, identifier, is_active, created_at)
SELECT 
  rc.id,
  bi.identifier,
  bi.is_active,
  bi.created_at
FROM public.billable_items bi
JOIN public.work_types wt ON wt.name = bi.work_type
JOIN public.rate_configs rc ON 
  rc.client_id = bi.client_id 
  AND rc.location_id = bi.location_id 
  AND rc.work_type_id = wt.id 
  AND COALESCE(rc.frequency, '') = COALESCE(bi.frequency, '')
WHERE bi.identifier IS NOT NULL;

-- ============================================
-- Phase 3: Modify work_logs Table
-- ============================================

-- Add new columns
ALTER TABLE public.work_logs 
  ADD COLUMN work_item_id UUID REFERENCES public.work_items(id) ON DELETE SET NULL,
  ADD COLUMN rate_config_id UUID REFERENCES public.rate_configs(id) ON DELETE SET NULL;

-- Drop old RLS policies on work_logs that reference billable_item_id
DROP POLICY IF EXISTS "Employees can insert work_logs" ON public.work_logs;

-- Remove old column
ALTER TABLE public.work_logs DROP COLUMN billable_item_id;

-- Add constraint: either work_item_id OR rate_config_id must be set
ALTER TABLE public.work_logs 
  ADD CONSTRAINT work_logs_item_or_config_check 
  CHECK (work_item_id IS NOT NULL OR rate_config_id IS NOT NULL);

-- ============================================
-- Phase 4: Drop Old Table & Function
-- ============================================

-- Drop the rate inheritance trigger function
DROP FUNCTION IF EXISTS public.inherit_rate_for_billable_item() CASCADE;

-- Drop billable_items table (this also drops its RLS policies)
DROP TABLE public.billable_items;

-- ============================================
-- Phase 5: Enable RLS & Create Policies
-- ============================================

-- work_types RLS
ALTER TABLE public.work_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read work_types" ON public.work_types
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage work_types" ON public.work_types
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- rate_configs RLS
ALTER TABLE public.rate_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage rate_configs" ON public.rate_configs
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Finance can view rate_configs" ON public.rate_configs
  FOR SELECT USING (has_role_or_higher(auth.uid(), 'finance'::app_role));

CREATE POLICY "Finance can update rate_configs" ON public.rate_configs
  FOR UPDATE USING (has_role_or_higher(auth.uid(), 'finance'::app_role));

CREATE POLICY "Employees can view assigned rate_configs" ON public.rate_configs
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM user_locations ul 
    WHERE ul.location_id = rate_configs.location_id 
    AND ul.user_id = auth.uid()
  ));

-- work_items RLS
ALTER TABLE public.work_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage work_items" ON public.work_items
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Finance can view work_items" ON public.work_items
  FOR SELECT USING (has_role_or_higher(auth.uid(), 'finance'::app_role));

CREATE POLICY "Employees can view assigned work_items" ON public.work_items
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM rate_configs rc
    JOIN user_locations ul ON ul.location_id = rc.location_id
    WHERE rc.id = work_items.rate_config_id 
    AND ul.user_id = auth.uid()
  ));

CREATE POLICY "Employees can insert work_items" ON public.work_items
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM rate_configs rc
    JOIN user_locations ul ON ul.location_id = rc.location_id
    WHERE rc.id = work_items.rate_config_id 
    AND ul.user_id = auth.uid()
  ));

-- work_logs updated policies
CREATE POLICY "Employees can insert work_logs" ON public.work_logs
  FOR INSERT WITH CHECK (
    employee_id = auth.uid() AND (
      (work_item_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM work_items wi
        JOIN rate_configs rc ON rc.id = wi.rate_config_id
        JOIN user_locations ul ON ul.location_id = rc.location_id
        WHERE wi.id = work_logs.work_item_id AND ul.user_id = auth.uid()
      ))
      OR
      (rate_config_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM rate_configs rc
        JOIN user_locations ul ON ul.location_id = rc.location_id
        WHERE rc.id = work_logs.rate_config_id AND ul.user_id = auth.uid()
      ))
    )
  );

-- ============================================
-- Phase 6: Create Indexes
-- ============================================

CREATE INDEX idx_rate_configs_lookup ON public.rate_configs(client_id, location_id, work_type_id);
CREATE INDEX idx_work_items_rate_config ON public.work_items(rate_config_id);
CREATE INDEX idx_work_logs_work_item ON public.work_logs(work_item_id);
CREATE INDEX idx_work_logs_rate_config ON public.work_logs(rate_config_id);
CREATE INDEX idx_work_logs_employee ON public.work_logs(employee_id);
CREATE INDEX idx_work_logs_date ON public.work_logs(work_date);