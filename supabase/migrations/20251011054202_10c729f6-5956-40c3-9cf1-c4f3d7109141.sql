-- Fix search_path for get_last_saturday function
DROP FUNCTION IF EXISTS get_last_saturday();

CREATE OR REPLACE FUNCTION get_last_saturday()
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today DATE := CURRENT_DATE;
  days_since_saturday INT;
  last_saturday DATE;
BEGIN
  -- Calculate days since last Saturday (0 = Sunday, 6 = Saturday)
  days_since_saturday := EXTRACT(DOW FROM today)::INT;
  
  -- If today is Sunday (0), go back 1 day to Saturday
  -- Otherwise, go back to previous Saturday
  IF days_since_saturday = 0 THEN
    last_saturday := today - INTERVAL '1 day';
  ELSE
    last_saturday := today - INTERVAL '1 day' * (days_since_saturday + 1);
  END IF;
  
  -- Return Saturday at 23:59:59
  RETURN last_saturday + TIME '23:59:59';
END;
$$;