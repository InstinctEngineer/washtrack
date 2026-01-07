-- Merge CTV-Rentals into CTV work type
-- CTV work_type ID: 844bbe68-a1c3-4941-8289-0eb2d31d1a51
-- CTV-Rentals work_type ID: 919577b9-ca44-489b-816a-f12dcb47acba

-- Step 1: For each location that has BOTH CTV and CTV-Rentals rate_configs,
-- move work_items from CTV-Rentals config to CTV config
DO $$
DECLARE
    rental_config RECORD;
    ctv_config_id UUID;
BEGIN
    -- Find all CTV-Rentals rate_configs
    FOR rental_config IN 
        SELECT rc.id, rc.client_id, rc.location_id, rc.frequency
        FROM rate_configs rc
        WHERE rc.work_type_id = '919577b9-ca44-489b-816a-f12dcb47acba'
        AND rc.is_active = true
    LOOP
        -- Find matching CTV rate_config for same client/location/frequency
        SELECT id INTO ctv_config_id
        FROM rate_configs
        WHERE work_type_id = '844bbe68-a1c3-4941-8289-0eb2d31d1a51'
        AND client_id = rental_config.client_id
        AND location_id = rental_config.location_id
        AND COALESCE(frequency, '') = COALESCE(rental_config.frequency, '')
        AND is_active = true
        LIMIT 1;
        
        IF ctv_config_id IS NOT NULL THEN
            -- Move work_items to CTV config
            UPDATE work_items
            SET rate_config_id = ctv_config_id
            WHERE rate_config_id = rental_config.id;
            
            -- Update work_logs that reference the old rate_config directly
            UPDATE work_logs
            SET rate_config_id = ctv_config_id
            WHERE rate_config_id = rental_config.id;
            
            -- Deactivate the CTV-Rentals rate_config
            UPDATE rate_configs
            SET is_active = false
            WHERE id = rental_config.id;
        ELSE
            -- No matching CTV config exists, just change the work_type reference
            UPDATE rate_configs
            SET work_type_id = '844bbe68-a1c3-4941-8289-0eb2d31d1a51'
            WHERE id = rental_config.id;
        END IF;
    END LOOP;
END $$;

-- Step 2: Deactivate the CTV-Rentals work type
UPDATE work_types
SET is_active = false
WHERE id = '919577b9-ca44-489b-816a-f12dcb47acba';