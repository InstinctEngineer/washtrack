CREATE OR REPLACE FUNCTION public.get_payroll_rate_sheet(
  p_start_date date,
  p_end_date date
)
RETURNS TABLE(
  employee_id text,
  employee_name text,
  provider_employee_number text,
  work_type_id text,
  work_type_name text,
  work_type_rate_type text,
  total_quantity numeric,
  last_worked date
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
    wt.id::TEXT,
    wt.name,
    wt.rate_type::TEXT,
    SUM(wl.quantity) AS total_quantity,
    MAX(wl.work_date) AS last_worked
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
  GROUP BY u.id, u.name, u.employee_id, wt.id, wt.name, wt.rate_type;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_payroll_rate_sheet(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_payroll_rate_sheet(date, date) TO service_role;

DROP POLICY IF EXISTS "Finance and above manage payroll employee lines" ON public.payroll_employee_lines;
CREATE POLICY "Finance and above manage payroll employee lines"
ON public.payroll_employee_lines
FOR ALL
TO authenticated
USING (public.has_role_or_higher(auth.uid(), 'finance'))
WITH CHECK (public.has_role_or_higher(auth.uid(), 'finance'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_employee_lines TO authenticated;
GRANT ALL ON public.payroll_employee_lines TO service_role;