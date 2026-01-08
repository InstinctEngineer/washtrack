ALTER TABLE public.clients 
ADD COLUMN tax_rate NUMERIC(5,2) DEFAULT NULL;

COMMENT ON COLUMN public.clients.tax_rate IS 'Tax rate percentage (e.g., 8.25 for 8.25%)';