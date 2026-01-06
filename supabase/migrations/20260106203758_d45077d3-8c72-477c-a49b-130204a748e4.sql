-- Merge STVs (formerly STV-Trailer) into STV
-- Step 1: Move work_items from conflicting STVs rate_configs to STV rate_configs
UPDATE work_items 
SET rate_config_id = '1be58d31-a692-4013-9e08-1b72150574b0'
WHERE rate_config_id = 'd71a1634-ac41-4931-9faa-331f900b4382';

-- Step 2: Move work_logs from conflicting STVs rate_configs to STV rate_configs
UPDATE work_logs 
SET rate_config_id = '1be58d31-a692-4013-9e08-1b72150574b0'
WHERE rate_config_id = 'd71a1634-ac41-4931-9faa-331f900b4382';

-- Step 3: Delete the now-empty conflicting STVs rate_config
DELETE FROM rate_configs WHERE id = 'd71a1634-ac41-4931-9faa-331f900b4382';

-- Step 4: Update remaining STVs rate_configs to STV (no conflicts now)
UPDATE rate_configs 
SET work_type_id = '67a71e12-6384-48b9-ae40-38824482f8ce'
WHERE work_type_id = 'aea53ad0-a64e-4fbd-993d-8a6b9da74a63';

-- Step 5: Deactivate the STVs work type
UPDATE work_types 
SET is_active = false 
WHERE id = 'aea53ad0-a64e-4fbd-993d-8a6b9da74a63';