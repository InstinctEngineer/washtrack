
-- 1. Add business_type to clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS business_type TEXT NOT NULL DEFAULT 'fedex'
  CHECK (business_type IN ('fedex', 'dealership'));

CREATE INDEX IF NOT EXISTS idx_clients_business_type ON public.clients(business_type);

-- Case-insensitive uniqueness for dealership client names
CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_dealership_name_ci
  ON public.clients (lower(name))
  WHERE business_type = 'dealership';

-- Case-insensitive uniqueness for location names within a client (dealership only, gated in app)
CREATE UNIQUE INDEX IF NOT EXISTS uq_locations_client_name_ci
  ON public.locations (client_id, lower(name));

-- 2. dealership_rates
CREATE TABLE IF NOT EXISTS public.dealership_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
  rate_per_vehicle NUMERIC(10,2) NOT NULL DEFAULT 5.25 CHECK (rate_per_vehicle > 0),
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_dealership_rates_active_loc
  ON public.dealership_rates (client_id, location_id)
  WHERE is_active = true AND location_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_dealership_rates_active_client
  ON public.dealership_rates (client_id)
  WHERE is_active = true AND location_id IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dealership_rates TO authenticated;
GRANT ALL ON public.dealership_rates TO service_role;

ALTER TABLE public.dealership_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view dealership rates"
  ON public.dealership_rates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Finance+ can insert dealership rates"
  ON public.dealership_rates FOR INSERT TO authenticated
  WITH CHECK (public.has_role_or_higher(auth.uid(), 'finance'::app_role));

CREATE POLICY "Finance+ can update dealership rates"
  ON public.dealership_rates FOR UPDATE TO authenticated
  USING (public.has_role_or_higher(auth.uid(), 'finance'::app_role));

CREATE POLICY "Admin can delete dealership rates"
  ON public.dealership_rates FOR DELETE TO authenticated
  USING (public.has_role_or_higher(auth.uid(), 'admin'::app_role));

-- 3. dealership_wash_batches
CREATE TABLE IF NOT EXISTS public.dealership_wash_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL,
  work_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vehicle_count INTEGER NOT NULL CHECK (vehicle_count > 0),
  rate_applied NUMERIC(10,2) NOT NULL CHECK (rate_applied > 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_dealership_batch_per_day
  ON public.dealership_wash_batches (location_id, employee_id, work_date);

CREATE INDEX IF NOT EXISTS idx_dealership_batch_client_date
  ON public.dealership_wash_batches (client_id, work_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dealership_wash_batches TO authenticated;
GRANT ALL ON public.dealership_wash_batches TO service_role;

ALTER TABLE public.dealership_wash_batches ENABLE ROW LEVEL SECURITY;

-- Employees: view batches at locations they're assigned to (mirrors work_logs pattern)
CREATE POLICY "Employees view batches at assigned locations"
  ON public.dealership_wash_batches FOR SELECT TO authenticated
  USING (
    public.has_role_or_higher(auth.uid(), 'finance'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_locations ul
      WHERE ul.user_id = auth.uid() AND ul.location_id = dealership_wash_batches.location_id
    )
  );

CREATE POLICY "Employees insert their own batches"
  ON public.dealership_wash_batches FOR INSERT TO authenticated
  WITH CHECK (
    employee_id = auth.uid()
    AND (
      public.has_role_or_higher(auth.uid(), 'finance'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.user_locations ul
        WHERE ul.user_id = auth.uid() AND ul.location_id = dealership_wash_batches.location_id
      )
    )
  );

CREATE POLICY "Employees update their own same-day batches; finance any"
  ON public.dealership_wash_batches FOR UPDATE TO authenticated
  USING (
    public.has_role_or_higher(auth.uid(), 'finance'::app_role)
    OR (employee_id = auth.uid() AND work_date = CURRENT_DATE)
  );

CREATE POLICY "Admin delete batches"
  ON public.dealership_wash_batches FOR DELETE TO authenticated
  USING (
    public.has_role_or_higher(auth.uid(), 'admin'::app_role)
    OR (employee_id = auth.uid() AND work_date = CURRENT_DATE)
  );

-- 4. dealership_location_requests
CREATE TABLE IF NOT EXISTS public.dealership_location_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by UUID NOT NULL,
  proposed_client_name TEXT NOT NULL,
  proposed_location_name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  notes TEXT,
  matched_client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  created_client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  created_location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','merged','rejected')),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dealership_requests_status ON public.dealership_location_requests(status);
CREATE INDEX IF NOT EXISTS idx_dealership_requests_requester ON public.dealership_location_requests(requested_by);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dealership_location_requests TO authenticated;
GRANT ALL ON public.dealership_location_requests TO service_role;

ALTER TABLE public.dealership_location_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own requests; finance+ all"
  ON public.dealership_location_requests FOR SELECT TO authenticated
  USING (
    requested_by = auth.uid()
    OR public.has_role_or_higher(auth.uid(), 'finance'::app_role)
  );

CREATE POLICY "Users create their own requests"
  ON public.dealership_location_requests FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid());

CREATE POLICY "Finance+ review requests"
  ON public.dealership_location_requests FOR UPDATE TO authenticated
  USING (public.has_role_or_higher(auth.uid(), 'finance'::app_role));

CREATE POLICY "Admin delete requests"
  ON public.dealership_location_requests FOR DELETE TO authenticated
  USING (public.has_role_or_higher(auth.uid(), 'admin'::app_role));

-- 5. Seed global default rate setting
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES ('dealership_default_rate', '5.25', 'Default per-vehicle rate for dealership washes')
ON CONFLICT (setting_key) DO NOTHING;

-- 6. updated_at trigger function (reusable)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_dealership_rates_updated ON public.dealership_rates;
CREATE TRIGGER trg_dealership_rates_updated
  BEFORE UPDATE ON public.dealership_rates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_dealership_batches_updated ON public.dealership_wash_batches;
CREATE TRIGGER trg_dealership_batches_updated
  BEFORE UPDATE ON public.dealership_wash_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_dealership_requests_updated ON public.dealership_location_requests;
CREATE TRIGGER trg_dealership_requests_updated
  BEFORE UPDATE ON public.dealership_location_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. Report function
CREATE OR REPLACE FUNCTION public.get_dealership_report_data(
  p_start_date DATE,
  p_end_date DATE,
  p_client_ids TEXT[] DEFAULT NULL,
  p_location_ids TEXT[] DEFAULT NULL
)
RETURNS TABLE(
  client_id TEXT,
  client_name TEXT,
  client_email TEXT,
  client_terms TEXT,
  client_parent_company TEXT,
  location_id TEXT,
  location_name TEXT,
  work_date TEXT,
  vehicle_count BIGINT,
  rate_applied NUMERIC,
  total_amount NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role_or_higher(auth.uid(), 'finance'::app_role) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  RETURN QUERY
  SELECT
    c.id::TEXT,
    c.name,
    c.contact_email,
    c.default_terms,
    c.parent_company,
    l.id::TEXT,
    l.name,
    b.work_date::TEXT,
    SUM(b.vehicle_count)::BIGINT,
    b.rate_applied,
    SUM(b.vehicle_count * b.rate_applied)::NUMERIC
  FROM public.dealership_wash_batches b
  JOIN public.clients c ON c.id = b.client_id
  JOIN public.locations l ON l.id = b.location_id
  WHERE b.work_date BETWEEN p_start_date AND p_end_date
    AND c.business_type = 'dealership'
    AND (p_client_ids IS NULL OR c.id::TEXT = ANY(p_client_ids))
    AND (p_location_ids IS NULL OR l.id::TEXT = ANY(p_location_ids))
  GROUP BY c.id, c.name, c.contact_email, c.default_terms, c.parent_company,
           l.id, l.name, b.work_date, b.rate_applied;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_dealership_report_data(DATE, DATE, TEXT[], TEXT[]) TO authenticated;
