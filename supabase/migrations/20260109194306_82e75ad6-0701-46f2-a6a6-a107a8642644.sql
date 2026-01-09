-- Add credentials_shared_at column to track when login credentials were shared
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS credentials_shared_at timestamptz DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.users.credentials_shared_at IS 
  'Timestamp when login credentials were shared with the user by admin';