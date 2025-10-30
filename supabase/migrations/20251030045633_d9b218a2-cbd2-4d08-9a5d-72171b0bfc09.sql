-- Remove date check from employee soft delete policy to fix timezone issues
DROP POLICY IF EXISTS "Employees can soft delete own same-day entries" ON wash_entries;

-- Allow employees to soft delete their own active entries
-- Frontend handles the same-day vs past-day logic
CREATE POLICY "Employees can soft delete own same-day entries" 
ON wash_entries 
FOR UPDATE 
USING (
  auth.uid() = employee_id 
  AND deleted_at IS NULL  -- Can only soft-delete active entries
)
WITH CHECK (
  auth.uid() = employee_id 
  AND wash_date = CURRENT_DATE  -- Still enforce same-day on the check
);