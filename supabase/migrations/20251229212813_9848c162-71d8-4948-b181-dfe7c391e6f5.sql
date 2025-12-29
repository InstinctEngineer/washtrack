-- Add unique constraint to prevent duplicate work_item entries on the same date
CREATE UNIQUE INDEX work_logs_work_item_date_unique 
ON work_logs (work_item_id, work_date) 
WHERE work_item_id IS NOT NULL;

-- Drop existing restrictive SELECT policy
DROP POLICY IF EXISTS "Employees can view own work_logs" ON work_logs;

-- Create new policy: employees can see logs at their assigned locations
CREATE POLICY "Employees can view work_logs at assigned locations" 
ON work_logs FOR SELECT USING (
  employee_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM work_items wi
    JOIN rate_configs rc ON rc.id = wi.rate_config_id
    JOIN user_locations ul ON ul.location_id = rc.location_id
    WHERE wi.id = work_logs.work_item_id
    AND ul.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM rate_configs rc
    JOIN user_locations ul ON ul.location_id = rc.location_id
    WHERE rc.id = work_logs.rate_config_id
    AND ul.user_id = auth.uid()
  )
);