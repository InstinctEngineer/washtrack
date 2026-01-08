-- Create get_report_data function for report generation
CREATE OR REPLACE FUNCTION get_report_data(
  p_start_date DATE,
  p_end_date DATE,
  p_client_ids TEXT[] DEFAULT NULL,
  p_location_ids TEXT[] DEFAULT NULL,
  p_work_type_ids TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  client_id TEXT,
  client_name TEXT,
  client_email TEXT,
  client_terms TEXT,
  client_class TEXT,
  client_is_taxable BOOLEAN,
  client_tax_jurisdiction TEXT,
  client_tax_rate NUMERIC,
  location_id TEXT,
  location_name TEXT,
  work_type_id TEXT,
  work_type_name TEXT,
  frequency TEXT,
  rate NUMERIC,
  total_quantity NUMERIC
) AS $$
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
    l.id::TEXT as location_id,
    l.name as location_name,
    wt.id::TEXT as work_type_id,
    wt.name as work_type_name,
    rc.frequency,
    rc.rate,
    SUM(wl.quantity) as total_quantity
  FROM work_logs wl
  JOIN work_items wi ON wl.work_item_id = wi.id OR wl.rate_config_id = wi.rate_config_id
  JOIN rate_configs rc ON wi.rate_config_id = rc.id
  JOIN work_types wt ON rc.work_type_id = wt.id
  JOIN locations l ON rc.location_id = l.id
  JOIN clients c ON rc.client_id = c.id
  WHERE wl.work_date BETWEEN p_start_date AND p_end_date
    AND (p_client_ids IS NULL OR c.id::TEXT = ANY(p_client_ids))
    AND (p_location_ids IS NULL OR l.id::TEXT = ANY(p_location_ids))
    AND (p_work_type_ids IS NULL OR wt.id::TEXT = ANY(p_work_type_ids))
  GROUP BY 
    c.id, c.name, c.contact_email, c.default_terms, c.default_class, 
    c.is_taxable, c.tax_jurisdiction, c.tax_rate,
    l.id, l.name,
    wt.id, wt.name,
    rc.frequency, rc.rate;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;