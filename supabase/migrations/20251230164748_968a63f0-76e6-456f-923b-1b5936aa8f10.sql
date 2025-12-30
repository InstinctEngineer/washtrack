-- Drop old functions and create renamed versions for Monday-Sunday week

-- Drop the old functions
DROP FUNCTION IF EXISTS public.get_last_sunday();
DROP FUNCTION IF EXISTS public.get_next_saturday();

-- Create get_last_monday - returns last Monday at 23:59:59
CREATE OR REPLACE FUNCTION public.get_last_monday()
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  today DATE := CURRENT_DATE;
  days_since_monday INT;
  last_monday DATE;
BEGIN
  -- Calculate days since last Monday
  -- PostgreSQL DOW: 0=Sunday, 1=Monday, ..., 6=Saturday
  -- We want Monday=0, Tuesday=1, ..., Sunday=6
  days_since_monday := (EXTRACT(DOW FROM today)::INT + 6) % 7;
  
  -- If today is Monday, use today; otherwise go back to previous Monday
  IF days_since_monday = 0 THEN
    last_monday := today;
  ELSE
    last_monday := today - INTERVAL '1 day' * days_since_monday;
  END IF;
  
  -- Return Monday at 23:59:59
  RETURN last_monday + TIME '23:59:59';
END;
$$;

-- Create get_next_sunday - returns next Sunday at 23:59:59 (end of week)
CREATE OR REPLACE FUNCTION public.get_next_sunday()
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  today DATE := CURRENT_DATE;
  days_until_sunday INT;
  next_sunday DATE;
BEGIN
  -- Calculate days until next Sunday (0 = Sunday in PostgreSQL DOW)
  days_until_sunday := (7 - EXTRACT(DOW FROM today)::INT) % 7;
  
  -- If today is Sunday, get next Sunday (7 days from now)
  IF days_until_sunday = 0 THEN
    next_sunday := today + INTERVAL '7 days';
  ELSE
    next_sunday := today + INTERVAL '1 day' * days_until_sunday;
  END IF;
  
  -- Return Sunday at 23:59:59
  RETURN next_sunday + TIME '23:59:59';
END;
$$;

-- Update auto_update_cutoff_date to use new function
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
  -- Get the next Sunday (end of week)
  new_cutoff := public.get_next_sunday();
  system_user_id := NULL;
  
  UPDATE public.system_settings
  SET 
    setting_value = new_cutoff::TEXT,
    updated_by = system_user_id,
    updated_at = NOW()
  WHERE setting_key = 'entry_cutoff_date';
  
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

-- Update current cutoff to next Sunday
UPDATE public.system_settings
SET setting_value = get_next_sunday()::text,
    updated_at = NOW()
WHERE setting_key = 'entry_cutoff_date';