
-- ============ Tables ============

CREATE TABLE public.client_portal_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text,
  company_name text,
  is_active boolean NOT NULL DEFAULT true,
  disabled_reason text,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_portal_users TO authenticated;
GRANT ALL ON public.client_portal_users TO service_role;
ALTER TABLE public.client_portal_users ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.client_portal_location_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_user_id uuid NOT NULL REFERENCES public.client_portal_users(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (portal_user_id, location_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_portal_location_access TO authenticated;
GRANT ALL ON public.client_portal_location_access TO service_role;
ALTER TABLE public.client_portal_location_access ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.client_portal_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_user_id uuid NOT NULL REFERENCES public.client_portal_users(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied')),
  note text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX client_portal_access_requests_pending_uniq
  ON public.client_portal_access_requests(portal_user_id, location_id)
  WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_portal_access_requests TO authenticated;
GRANT ALL ON public.client_portal_access_requests TO service_role;
ALTER TABLE public.client_portal_access_requests ENABLE ROW LEVEL SECURITY;

-- updated_at triggers
CREATE TRIGGER trg_client_portal_users_updated
  BEFORE UPDATE ON public.client_portal_users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_client_portal_requests_updated
  BEFORE UPDATE ON public.client_portal_access_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ Helper functions ============

CREATE OR REPLACE FUNCTION public.is_portal_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_portal_users
    WHERE auth_user_id = _user_id AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.portal_has_location(_user_id uuid, _location_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.client_portal_location_access a
    JOIN public.client_portal_users u ON u.id = a.portal_user_id
    WHERE u.auth_user_id = _user_id
      AND u.is_active = true
      AND a.location_id = _location_id
  );
$$;

CREATE OR REPLACE FUNCTION public.get_portal_user_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.client_portal_users WHERE auth_user_id = _user_id;
$$;

-- ============ RLS Policies ============

-- client_portal_users
CREATE POLICY "Portal users can read own profile"
  ON public.client_portal_users FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "Finance+ can read all portal users"
  ON public.client_portal_users FOR SELECT TO authenticated
  USING (public.has_role_or_higher(auth.uid(), 'finance'::app_role));

CREATE POLICY "Admin+ can insert portal users"
  ON public.client_portal_users FOR INSERT TO authenticated
  WITH CHECK (public.has_role_or_higher(auth.uid(), 'admin'::app_role));

CREATE POLICY "Finance+ can update portal users"
  ON public.client_portal_users FOR UPDATE TO authenticated
  USING (public.has_role_or_higher(auth.uid(), 'finance'::app_role));

CREATE POLICY "Admin+ can delete portal users"
  ON public.client_portal_users FOR DELETE TO authenticated
  USING (public.has_role_or_higher(auth.uid(), 'admin'::app_role));

-- client_portal_location_access
CREATE POLICY "Portal users see own grants"
  ON public.client_portal_location_access FOR SELECT TO authenticated
  USING (portal_user_id = public.get_portal_user_id(auth.uid()));

CREATE POLICY "Finance+ read all grants"
  ON public.client_portal_location_access FOR SELECT TO authenticated
  USING (public.has_role_or_higher(auth.uid(), 'finance'::app_role));

CREATE POLICY "Finance+ manage grants"
  ON public.client_portal_location_access FOR ALL TO authenticated
  USING (public.has_role_or_higher(auth.uid(), 'finance'::app_role))
  WITH CHECK (public.has_role_or_higher(auth.uid(), 'finance'::app_role));

-- client_portal_access_requests
CREATE POLICY "Portal users read own requests"
  ON public.client_portal_access_requests FOR SELECT TO authenticated
  USING (portal_user_id = public.get_portal_user_id(auth.uid()));

CREATE POLICY "Portal users create own requests"
  ON public.client_portal_access_requests FOR INSERT TO authenticated
  WITH CHECK (
    portal_user_id = public.get_portal_user_id(auth.uid())
    AND status = 'pending'
  );

CREATE POLICY "Finance+ read all requests"
  ON public.client_portal_access_requests FOR SELECT TO authenticated
  USING (public.has_role_or_higher(auth.uid(), 'finance'::app_role));

CREATE POLICY "Finance+ update requests"
  ON public.client_portal_access_requests FOR UPDATE TO authenticated
  USING (public.has_role_or_higher(auth.uid(), 'finance'::app_role));

-- ============ Read-only history RPCs ============

CREATE OR REPLACE FUNCTION public.get_portal_work_history(
  p_location_id uuid,
  p_start date,
  p_end date
)
RETURNS TABLE(
  work_date date,
  work_type_name text,
  identifier text,
  quantity numeric,
  notes text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.portal_has_location(auth.uid(), p_location_id) THEN
    RAISE EXCEPTION 'Access denied to this location';
  END IF;

  RETURN QUERY
  SELECT
    wl.work_date,
    wt.name,
    wi.identifier,
    wl.quantity,
    wl.notes
  FROM public.work_logs wl
  LEFT JOIN public.work_items wi ON wi.id = wl.work_item_id
  JOIN public.rate_configs rc
    ON rc.id = COALESCE(wi.rate_config_id, wl.rate_config_id)
  JOIN public.work_types wt ON wt.id = rc.work_type_id
  WHERE rc.location_id = p_location_id
    AND wl.work_date BETWEEN p_start AND p_end
  ORDER BY wl.work_date DESC, wt.name;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_portal_dealership_history(
  p_location_id uuid,
  p_start date,
  p_end date
)
RETURNS TABLE(
  work_date date,
  vehicle_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.portal_has_location(auth.uid(), p_location_id) THEN
    RAISE EXCEPTION 'Access denied to this location';
  END IF;

  RETURN QUERY
  SELECT b.work_date, SUM(b.vehicle_count)::bigint
  FROM public.dealership_wash_batches b
  WHERE b.location_id = p_location_id
    AND b.work_date BETWEEN p_start AND p_end
  GROUP BY b.work_date
  ORDER BY b.work_date DESC;
END;
$$;

-- Portal user listing of their locations (with client/business_type info)
CREATE OR REPLACE FUNCTION public.get_portal_my_locations()
RETURNS TABLE(
  location_id uuid,
  location_name text,
  client_name text,
  business_type text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT l.id, l.name, c.name, c.business_type
  FROM public.client_portal_location_access a
  JOIN public.client_portal_users u ON u.id = a.portal_user_id
  JOIN public.locations l ON l.id = a.location_id
  JOIN public.clients c ON c.id = l.client_id
  WHERE u.auth_user_id = auth.uid()
    AND u.is_active = true
  ORDER BY c.name, l.name;
$$;

-- ============ Inactivity disable job ============

CREATE OR REPLACE FUNCTION public.disable_inactive_portal_users()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.client_portal_users
  SET is_active = false,
      disabled_reason = 'inactivity_90d'
  WHERE is_active = true
    AND (
      (last_login_at IS NOT NULL AND last_login_at < now() - interval '90 days')
      OR (last_login_at IS NULL AND created_at < now() - interval '90 days')
    );
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- ============ Settings seed ============

INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES ('portal_support_phone', '(555) 555-5555',
        'Phone number shown to disabled client portal users')
ON CONFLICT (setting_key) DO NOTHING;
