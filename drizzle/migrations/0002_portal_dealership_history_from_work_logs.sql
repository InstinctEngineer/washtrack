CREATE OR REPLACE FUNCTION public.get_portal_dealership_history(p_location_id uuid, p_start date, p_end date)
RETURNS TABLE(work_date date, vehicle_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.portal_has_location(auth.uid(), p_location_id) THEN
    RAISE EXCEPTION 'Access denied to this location';
  END IF;
  RETURN QUERY
  SELECT wl.work_date, SUM(wl.quantity)::bigint
  FROM public.work_logs wl
  LEFT JOIN public.work_items wi ON wi.id = wl.work_item_id
  JOIN public.rate_configs rc ON rc.id = COALESCE(wi.rate_config_id, wl.rate_config_id)
  WHERE rc.location_id = p_location_id
    AND wl.work_date BETWEEN p_start AND p_end
  GROUP BY wl.work_date
  ORDER BY wl.work_date DESC;
END;
$$;