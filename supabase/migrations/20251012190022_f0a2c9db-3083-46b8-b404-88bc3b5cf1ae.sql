-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create a function to get the next Saturday at 23:59:59
CREATE OR REPLACE FUNCTION public.get_next_saturday()
RETURNS timestamp with time zone
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  today DATE := CURRENT_DATE;
  days_until_saturday INT;
  next_saturday DATE;
BEGIN
  -- Calculate days until next Saturday (0 = Sunday, 6 = Saturday)
  days_until_saturday := (6 - EXTRACT(DOW FROM today)::INT) % 7;
  
  -- If today is Saturday, get next Saturday (7 days from now)
  -- Otherwise get the upcoming Saturday
  IF days_until_saturday = 0 THEN
    next_saturday := today + INTERVAL '7 days';
  ELSE
    next_saturday := today + INTERVAL '1 day' * days_until_saturday;
  END IF;
  
  -- Return Saturday at 23:59:59
  RETURN next_saturday + TIME '23:59:59';
END;
$$;

-- Create a function to auto-update cutoff date
CREATE OR REPLACE FUNCTION public.auto_update_cutoff_date()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_cutoff TIMESTAMP WITH TIME ZONE;
  system_user_id UUID;
BEGIN
  -- Get the next Saturday
  new_cutoff := public.get_next_saturday();
  
  -- Use a system user ID (you can create a dedicated system user or use NULL)
  -- For now, we'll use NULL to indicate automatic system update
  system_user_id := NULL;
  
  -- Update the cutoff date
  UPDATE public.system_settings
  SET 
    setting_value = new_cutoff::TEXT,
    updated_by = system_user_id,
    updated_at = NOW()
  WHERE setting_key = 'entry_cutoff_date';
  
  -- Log to audit trail
  INSERT INTO public.system_settings_audit (
    setting_key,
    old_value,
    new_value,
    changed_by,
    change_reason
  )
  SELECT
    'entry_cutoff_date',
    (SELECT setting_value FROM public.system_settings WHERE setting_key = 'entry_cutoff_date'),
    new_cutoff::TEXT,
    system_user_id,
    'Automatic weekly rollover'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.system_settings_audit
    WHERE setting_key = 'entry_cutoff_date'
    AND DATE(changed_at) = CURRENT_DATE
  );
  
END;
$$;