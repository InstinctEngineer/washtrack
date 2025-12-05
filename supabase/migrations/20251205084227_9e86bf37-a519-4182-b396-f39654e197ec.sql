-- Drop the overly permissive manager policy
DROP POLICY IF EXISTS "Users with manager role or higher can read all users" ON public.users;

-- Create a view with only non-sensitive user data for managers
CREATE OR REPLACE VIEW public.users_safe_view AS
SELECT 
  id,
  name,
  email,
  employee_id,
  role,
  location_id,
  manager_id,
  is_active,
  created_at,
  assigned_clients,
  hire_date,
  termination_date,
  on_vacation,
  vacation_until,
  profile_photo_url,
  preferred_language,
  notes,
  tags,
  client_access_level,
  certifications,
  training_completed,
  default_shift,
  available_days,
  -- Performance metrics (non-sensitive)
  total_washes_completed,
  average_wash_time_minutes,
  quality_score_average,
  max_daily_washes,
  performance_rating,
  last_training_date
FROM public.users;

-- Enable RLS on the view
ALTER VIEW public.users_safe_view SET (security_invoker = true);

-- Create policy: Only admins can read full user data from the main table
CREATE POLICY "Only admins can read all user data"
ON public.users
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
);

-- Keep the policy for employees to read their own record
-- (already exists: "Employees can read their own record")

-- Create a security definer function to get safe user data for managers
CREATE OR REPLACE FUNCTION public.get_users_for_managers()
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  employee_id text,
  role text,
  location_id uuid,
  manager_id uuid,
  is_active boolean,
  created_at timestamptz,
  assigned_clients text[],
  hire_date date,
  termination_date date,
  on_vacation boolean,
  vacation_until date,
  profile_photo_url text,
  preferred_language text,
  notes text,
  tags text[],
  client_access_level text,
  certifications text[],
  training_completed text[],
  default_shift text,
  available_days text[],
  total_washes_completed integer,
  average_wash_time_minutes integer,
  quality_score_average numeric,
  max_daily_washes integer,
  performance_rating numeric,
  last_training_date date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    u.id,
    u.name,
    u.email,
    u.employee_id,
    u.role,
    u.location_id,
    u.manager_id,
    u.is_active,
    u.created_at,
    u.assigned_clients,
    u.hire_date,
    u.termination_date,
    u.on_vacation,
    u.vacation_until,
    u.profile_photo_url,
    u.preferred_language,
    u.notes,
    u.tags,
    u.client_access_level,
    u.certifications,
    u.training_completed,
    u.default_shift,
    u.available_days,
    u.total_washes_completed,
    u.average_wash_time_minutes,
    u.quality_score_average,
    u.max_daily_washes,
    u.performance_rating,
    u.last_training_date
  FROM public.users u
  WHERE 
    -- Only return data if user has manager role or higher
    has_role_or_higher(auth.uid(), 'manager'::app_role)
    -- Don't expose super_admin users to non-super-admins
    AND (has_role(auth.uid(), 'super_admin'::app_role) OR NOT is_super_admin(u.id));
$$;