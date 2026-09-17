CREATE OR REPLACE FUNCTION public.get_payroll_production_data(
  p_start_date date,
  p_end_date date,
  p_employee_ids text[] DEFAULT NULL,
  p_location_ids text[] DEFAULT NULL
)
RETURNS TABLE(
  employee_id text,
  employee_name text,
  provider_employee_number text,
  location_id text,
  location_name text,
  client_name text,
  work_type_id text,
  work_type_name text,
  work_type_rate_type text,
  total_quantity numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    u.id::TEXT,
    u.name,
    u.employee_id,
    l.id::TEXT,
    l.name,
    c.name,
    wt.id::TEXT,
    wt.name,
    wt.rate_type::TEXT,
    SUM(wl.quantity) AS total_quantity
  FROM work_logs wl
  LEFT JOIN work_items wi ON wl.work_item_id = wi.id
  JOIN rate_configs rc ON (wi.rate_config_id = rc.id OR wl.rate_config_id = rc.id)
  JOIN work_types wt ON rc.work_type_id = wt.id
  JOIN locations l ON rc.location_id = l.id
  JOIN clients c ON rc.client_id = c.id
  JOIN users u ON wl.employee_id = u.id
  WHERE wl.work_date BETWEEN p_start_date AND p_end_date
    AND l.is_test = false
    AND c.is_test = false
    AND (p_employee_ids IS NULL OR u.id::TEXT = ANY(p_employee_ids))
    AND (p_location_ids IS NULL OR l.id::TEXT = ANY(p_location_ids))
  GROUP BY u.id, u.name, u.employee_id, l.id, l.name, c.name, wt.id, wt.name, wt.rate_type;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_payroll_production_data(date, date, text[], text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_payroll_production_data(date, date, text[], text[]) TO service_role;