-- Add rate snapshot column to wash_entries
ALTER TABLE wash_entries 
ADD COLUMN IF NOT EXISTS rate_at_time_of_wash numeric;

-- Backfill existing entries with current rates
UPDATE wash_entries we
SET rate_at_time_of_wash = vt.rate_per_wash
FROM vehicles v
JOIN vehicle_types vt ON v.vehicle_type_id = vt.id
WHERE we.vehicle_id = v.id
AND we.rate_at_time_of_wash IS NULL;