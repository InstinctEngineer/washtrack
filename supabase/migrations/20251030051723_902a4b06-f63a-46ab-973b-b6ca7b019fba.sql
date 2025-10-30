-- Allow employees to restore (un-delete) their own same-day entries
-- This policy allows setting deleted_at back to NULL to re-enable the wash entry

CREATE POLICY "Employees can restore own same-day deleted entries" 
ON wash_entries 
FOR UPDATE 
TO authenticated
USING (
  auth.uid() = employee_id 
  AND deleted_at IS NOT NULL  -- Can only restore deleted entries
  AND wash_date = CURRENT_DATE -- Only same-day entries
)
WITH CHECK (
  auth.uid() = employee_id
  AND deleted_at IS NULL  -- Must be setting it back to NULL (restoring)
);