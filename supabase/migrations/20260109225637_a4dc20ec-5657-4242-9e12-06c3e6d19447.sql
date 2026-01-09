-- Update get_report_data to include work_date for each row
-- This allows the frontend to determine which Friday each work log belongs to

DROP FUNCTION IF EXISTS public.get_report_data(date, date, text[], text[], text[]);

CREATE OR REPLACE FUNCTION public.get_report_data(
  p_start_date date, 
  p_end_date date, 
  p_client_ids text[] DEFAULT NULL::text[], 
  p_location_ids text[] DEFAULT NULL::text[], 
  p_work_type_ids text[] DEFAULT NULL::text[]
)
RETURNS TABLE(
  client_id text, 
  client_name text, 
  client_email text, 
  client_terms text, 
  client_class text, 
  client_is_taxable boolean, 
  client_tax_jurisdiction text, 
  client_tax_rate numeric, 
  client_parent_company text, 
  location_id text, 
  location_name text, 
  work_type_id text, 
  work_type_name text, 
  work_type_rate_type text, 
  frequency text, 
  rate numeric, 
  total_quantity numeric,
  work_date text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    c.id::TEXT as client_id,
    c.name as client_name,
    c.contact_email as client_email,
    c.default_terms as client_terms,
    c.default_class as client_class,
    c.is_taxable as client_is_taxable,
    c.tax_jurisdiction as client_tax_jurisdiction,
    c.tax_rate as client_tax_rate,
    c.parent_company as client_parent_company,
    l.id::TEXT as location_id,
    l.name as location_name,
    wt.id::TEXT as work_type_id,
    wt.name as work_type_name,
    wt.rate_type::TEXT as work_type_rate_type,
    rc.frequency,
    rc.rate,
    SUM(wl.quantity) as total_quantity,
    wl.work_date::TEXT as work_date
  FROM work_logs wl
  LEFT JOIN work_items wi ON wl.work_item_id = wi.id
  JOIN rate_configs rc ON (wi.rate_config_id = rc.id OR wl.rate_config_id = rc.id)
  JOIN work_types wt ON rc.work_type_id = wt.id
  JOIN locations l ON rc.location_id = l.id
  JOIN clients c ON rc.client_id = c.id
  WHERE wl.work_date BETWEEN p_start_date AND p_end_date
    AND (p_client_ids IS NULL OR c.id::TEXT = ANY(p_client_ids))
    AND (p_location_ids IS NULL OR l.id::TEXT = ANY(p_location_ids))
    AND (p_work_type_ids IS NULL OR wt.id::TEXT = ANY(p_work_type_ids))
  GROUP BY 
    c.id, c.name, c.contact_email, c.default_terms, c.default_class, 
    c.is_taxable, c.tax_jurisdiction, c.tax_rate, c.parent_company,
    l.id, l.name,
    wt.id, wt.name, wt.rate_type,
    rc.frequency, rc.rate,
    wl.work_date;
END;
$function$;