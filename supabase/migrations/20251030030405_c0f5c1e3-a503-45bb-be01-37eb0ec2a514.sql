-- Create user_locations junction table for many-to-many relationship
CREATE TABLE public.user_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, location_id)
);

-- Enable RLS
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_locations
CREATE POLICY "Users can view their own location assignments"
  ON public.user_locations
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users with manager role or higher can view all location assignments"
  ON public.user_locations
  FOR SELECT
  USING (has_role_or_higher(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins can manage location assignments"
  ON public.user_locations
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Migrate existing location_id data to user_locations table
INSERT INTO public.user_locations (user_id, location_id, is_primary)
SELECT id, location_id, true
FROM public.users
WHERE location_id IS NOT NULL;

-- Create index for performance
CREATE INDEX idx_user_locations_user_id ON public.user_locations(user_id);
CREATE INDEX idx_user_locations_location_id ON public.user_locations(location_id);

-- Add comment explaining the relationship
COMMENT ON TABLE public.user_locations IS 'Many-to-many relationship between users and locations. Users can be assigned to multiple locations, with one marked as primary.';