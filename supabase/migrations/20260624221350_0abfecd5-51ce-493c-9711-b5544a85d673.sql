
ALTER TABLE public.client_portal_users
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS work_location text,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

ALTER TABLE public.client_portal_users
  DROP CONSTRAINT IF EXISTS client_portal_users_approval_status_check;
ALTER TABLE public.client_portal_users
  ADD CONSTRAINT client_portal_users_approval_status_check
  CHECK (approval_status IN ('pending','approved','denied'));

-- Backfill existing rows: they were admin-created, treat as approved/onboarded
UPDATE public.client_portal_users
SET onboarding_completed = true,
    approval_status = 'approved',
    approved_at = COALESCE(approved_at, created_at)
WHERE approval_status = 'pending' AND created_at < now();

-- Tighten is_portal_user to require approval
CREATE OR REPLACE FUNCTION public.is_portal_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_portal_users
    WHERE auth_user_id = _user_id
      AND is_active = true
      AND approval_status = 'approved'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_portal_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_portal_users
    WHERE auth_user_id = _user_id
      AND is_active = true
      AND approval_status = 'approved'
  );
$$;

-- Replace insert policy to block pending users
DROP POLICY IF EXISTS "Portal users create own requests" ON public.client_portal_access_requests;
CREATE POLICY "Portal users create own requests"
  ON public.client_portal_access_requests FOR INSERT TO authenticated
  WITH CHECK (
    portal_user_id = public.get_portal_user_id(auth.uid())
    AND status = 'pending'
    AND public.is_portal_approved(auth.uid())
  );

-- Account status RPC for the portal frontend
CREATE OR REPLACE FUNCTION public.get_portal_account_status()
RETURNS TABLE(
  approval_status text,
  is_active boolean,
  onboarding_completed boolean,
  disabled_reason text,
  first_name text,
  last_name text,
  work_location text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT approval_status, is_active, onboarding_completed, disabled_reason,
         first_name, last_name, work_location
  FROM public.client_portal_users
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;
