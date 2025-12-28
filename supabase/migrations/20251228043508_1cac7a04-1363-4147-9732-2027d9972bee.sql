-- Step 1: Drop the existing unique constraint
ALTER TABLE public.billable_items 
DROP CONSTRAINT IF EXISTS billable_items_client_id_location_id_work_type_frequency_key;

-- Step 2: Add identifier column
ALTER TABLE public.billable_items 
ADD COLUMN IF NOT EXISTS identifier text;

-- Step 3: Create partial unique index (only enforced when identifier is NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS billable_items_unique_with_identifier 
ON public.billable_items (client_id, location_id, work_type, frequency, identifier) 
WHERE identifier IS NOT NULL;

-- Step 4: Add a comment for documentation
COMMENT ON COLUMN public.billable_items.identifier IS 'Employee-assigned ID like truck number, asset tag, or license plate';

-- Step 5: Add index on identifier for faster lookups
CREATE INDEX IF NOT EXISTS idx_billable_items_identifier ON public.billable_items(identifier) WHERE identifier IS NOT NULL;