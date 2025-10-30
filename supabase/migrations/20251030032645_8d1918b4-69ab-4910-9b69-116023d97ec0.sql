-- Deactivate any "All Locations" location
UPDATE public.locations 
SET is_active = false 
WHERE is_all_locations = true;

-- Remove the is_all_locations column as it's no longer needed with multi-location support
ALTER TABLE public.locations 
DROP COLUMN IF EXISTS is_all_locations;