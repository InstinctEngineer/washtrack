-- Create system_settings table
CREATE TABLE public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  updated_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  description TEXT
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies: All authenticated users can read, only admin can update
CREATE POLICY "All authenticated users can read system settings"
  ON public.system_settings
  FOR SELECT
  USING (true);

CREATE POLICY "Admin can update system settings"
  ON public.system_settings
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can insert system settings"
  ON public.system_settings
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Function to get last Saturday at 23:59:59
CREATE OR REPLACE FUNCTION get_last_saturday()
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql
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

-- Insert default cutoff date record
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES (
  'entry_cutoff_date',
  to_char(get_last_saturday(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'Employees cannot enter washes before this date/time'
);

-- Create audit trail table for cutoff changes
CREATE TABLE public.system_settings_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  changed_by UUID REFERENCES public.users(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  change_reason TEXT
);

-- Enable RLS on audit table
ALTER TABLE public.system_settings_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policies for audit table
CREATE POLICY "All authenticated users can read audit trail"
  ON public.system_settings_audit
  FOR SELECT
  USING (true);

CREATE POLICY "System can insert audit records"
  ON public.system_settings_audit
  FOR INSERT
  WITH CHECK (true);

-- Trigger function to create audit trail
CREATE OR REPLACE FUNCTION log_system_setting_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.system_settings_audit (
    setting_key,
    old_value,
    new_value,
    changed_by
  ) VALUES (
    NEW.setting_key,
    OLD.setting_value,
    NEW.setting_value,
    NEW.updated_by
  );
  RETURN NEW;
END;
$$;

-- Create trigger for audit trail
CREATE TRIGGER system_settings_audit_trigger
  AFTER UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION log_system_setting_change();