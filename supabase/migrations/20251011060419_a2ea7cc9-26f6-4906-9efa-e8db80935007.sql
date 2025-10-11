-- Update get_last_saturday to get_last_sunday
DROP FUNCTION IF EXISTS public.get_last_saturday();

CREATE OR REPLACE FUNCTION public.get_last_sunday()
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  today DATE := CURRENT_DATE;
  days_since_sunday INT;
  last_sunday DATE;
BEGIN
  -- Calculate days since last Sunday (0 = Sunday, 6 = Saturday)
  days_since_sunday := EXTRACT(DOW FROM today)::INT;
  
  -- If today is Sunday (0), use today
  -- Otherwise, go back to previous Sunday
  IF days_since_sunday = 0 THEN
    last_sunday := today;
  ELSE
    last_sunday := today - INTERVAL '1 day' * days_since_sunday;
  END IF;
  
  -- Return Sunday at 23:59:59
  RETURN last_sunday + TIME '23:59:59';
END;
$$;

-- Update the default cutoff date to last Sunday
UPDATE public.system_settings
SET setting_value = get_last_sunday()::text,
    description = 'Employees can enter washes for the 7-day period ending on this date'
WHERE setting_key = 'entry_cutoff_date';