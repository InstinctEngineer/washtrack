-- Allow users to view all wash entries at their assigned locations
-- This fixes the issue where employees couldn't see vehicles washed by super admins
CREATE POLICY "Users can view wash entries at their locations"
ON public.wash_entries
FOR SELECT
TO authenticated
USING (
  actual_location_id IN (
    -- Get locations from user_locations table (multi-location support)
    SELECT location_id FROM public.user_locations WHERE user_id = auth.uid()
    UNION
    -- Also check the legacy location_id on users table
    SELECT location_id FROM public.users WHERE id = auth.uid() AND location_id IS NOT NULL
  )
);