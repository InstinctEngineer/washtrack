
CREATE TABLE public.wash_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  work_item_id uuid NOT NULL REFERENCES public.work_items(id) ON DELETE CASCADE,
  portal_user_id uuid NOT NULL REFERENCES public.client_portal_users(id) ON DELETE CASCADE,
  requested_for_week date NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  fulfilled_at timestamptz,
  fulfilled_work_log_id uuid REFERENCES public.work_logs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (work_item_id, requested_for_week)
);

CREATE INDEX idx_wash_requests_location_week ON public.wash_requests(location_id, requested_for_week);
CREATE INDEX idx_wash_requests_work_item ON public.wash_requests(work_item_id) WHERE fulfilled_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wash_requests TO authenticated;
GRANT ALL ON public.wash_requests TO service_role;

ALTER TABLE public.wash_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Portal users can view their location requests"
  ON public.wash_requests FOR SELECT TO authenticated
  USING (public.portal_has_location(auth.uid(), location_id));

CREATE POLICY "Portal users can create requests for their locations"
  ON public.wash_requests FOR INSERT TO authenticated
  WITH CHECK (
    public.portal_has_location(auth.uid(), location_id)
    AND portal_user_id = public.get_portal_user_id(auth.uid())
  );

CREATE POLICY "Portal users can cancel their own open requests"
  ON public.wash_requests FOR DELETE TO authenticated
  USING (
    portal_user_id = public.get_portal_user_id(auth.uid())
    AND fulfilled_at IS NULL
  );

CREATE POLICY "Employees can view requests for assigned locations"
  ON public.wash_requests FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_locations ul
    WHERE ul.user_id = auth.uid() AND ul.location_id = wash_requests.location_id
  ));

CREATE POLICY "Finance and admins can view all requests"
  ON public.wash_requests FOR SELECT TO authenticated
  USING (public.has_role_or_higher(auth.uid(), 'finance'::app_role));

CREATE POLICY "Finance and admins can manage all requests"
  ON public.wash_requests FOR ALL TO authenticated
  USING (public.has_role_or_higher(auth.uid(), 'finance'::app_role))
  WITH CHECK (public.has_role_or_higher(auth.uid(), 'finance'::app_role));

-- Trigger to auto-fulfill on work_log insert
CREATE OR REPLACE FUNCTION public.auto_fulfill_wash_requests()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.work_item_id IS NOT NULL THEN
    UPDATE public.wash_requests
       SET fulfilled_at = now(),
           fulfilled_work_log_id = NEW.id
     WHERE work_item_id = NEW.work_item_id
       AND fulfilled_at IS NULL
       AND requested_for_week <= NEW.work_date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_fulfill_wash_requests ON public.work_logs;
CREATE TRIGGER trg_auto_fulfill_wash_requests
  AFTER INSERT ON public.work_logs
  FOR EACH ROW EXECUTE FUNCTION public.auto_fulfill_wash_requests();

-- RPC: list location work items with request flag for current week
CREATE OR REPLACE FUNCTION public.get_portal_location_work_items(p_location_id uuid)
RETURNS TABLE(
  work_item_id uuid,
  identifier text,
  work_type_name text,
  is_requested boolean,
  requested_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  week_start date := (current_date - ((EXTRACT(DOW FROM current_date)::int + 6) % 7))::date;
BEGIN
  IF NOT public.portal_has_location(auth.uid(), p_location_id) THEN
    RAISE EXCEPTION 'Access denied to this location';
  END IF;

  RETURN QUERY
  SELECT
    wi.id,
    wi.identifier,
    wt.name,
    (wr.id IS NOT NULL AND wr.fulfilled_at IS NULL) AS is_requested,
    wr.requested_at
  FROM public.work_items wi
  JOIN public.rate_configs rc ON rc.id = wi.rate_config_id
  JOIN public.work_types wt ON wt.id = rc.work_type_id
  LEFT JOIN public.wash_requests wr
    ON wr.work_item_id = wi.id
   AND wr.requested_for_week = week_start
  WHERE rc.location_id = p_location_id
    AND wi.is_active = true
    AND rc.is_active = true
  ORDER BY wt.name, wi.identifier;
END;
$$;
