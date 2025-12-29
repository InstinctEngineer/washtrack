-- Add new columns to clients table for export configuration
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS default_terms text DEFAULT 'Net 30',
ADD COLUMN IF NOT EXISTS default_class text,
ADD COLUMN IF NOT EXISTS tax_jurisdiction text,
ADD COLUMN IF NOT EXISTS is_taxable boolean DEFAULT true;

-- Create function to get aggregated report data
CREATE OR REPLACE FUNCTION get_report_data(
  p_start_date date,
  p_end_date date,
  p_client_ids uuid[] DEFAULT NULL,
  p_location_ids uuid[] DEFAULT NULL,
  p_work_type_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  client_id uuid,
  client_name text,
  client_email text,
  client_terms text,
  client_class text,
  client_tax_jurisdiction text,
  client_is_taxable boolean,
  location_id uuid,
  location_name text,
  work_type_id uuid,
  work_type_name text,
  frequency text,
  rate numeric,
  total_quantity numeric
)
LANGUAGE sql 
STABLE 
SECURITY DEFINER 
SET search_path = public
AS $$
  SELECT 
    c.id as client_id,
    c.name as client_name,
    c.contact_email as client_email,
    COALESCE(c.default_terms, 'Net 30') as client_terms,
    c.default_class as client_class,
    c.tax_jurisdiction as client_tax_jurisdiction,
    COALESCE(c.is_taxable, true) as client_is_taxable,
    l.id as location_id,
    l.name as location_name,
    wt.id as work_type_id,
    wt.name as work_type_name,
    rc.frequency,
    rc.rate,
    SUM(wl.quantity) as total_quantity
  FROM work_logs wl
  LEFT JOIN work_items wi ON wl.work_item_id = wi.id
  LEFT JOIN rate_configs rc ON COALESCE(wl.rate_config_id, wi.rate_config_id) = rc.id
  LEFT JOIN work_types wt ON rc.work_type_id = wt.id
  LEFT JOIN locations l ON rc.location_id = l.id
  LEFT JOIN clients c ON rc.client_id = c.id
  WHERE wl.work_date BETWEEN p_start_date AND p_end_date
    AND (p_client_ids IS NULL OR c.id = ANY(p_client_ids))
    AND (p_location_ids IS NULL OR l.id = ANY(p_location_ids))
    AND (p_work_type_ids IS NULL OR wt.id = ANY(p_work_type_ids))
  GROUP BY c.id, c.name, c.contact_email, c.default_terms, c.default_class, 
           c.tax_jurisdiction, c.is_taxable, l.id, l.name, wt.id, wt.name, 
           rc.frequency, rc.rate
  ORDER BY c.name, l.name, wt.name;
$$;