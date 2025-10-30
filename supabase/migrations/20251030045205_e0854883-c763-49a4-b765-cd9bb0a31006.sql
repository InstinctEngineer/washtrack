-- Drop all existing update policies for wash_entries
DROP POLICY IF EXISTS "Admin can update wash entries" ON wash_entries;
DROP POLICY IF EXISTS "Employees can soft delete own same-day entries" ON wash_entries;
DROP POLICY IF EXISTS "Managers can soft delete approved entries" ON wash_entries;

-- Allow admins to update any entry
CREATE POLICY "Admin can update wash entries" 
ON wash_entries 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow employees to soft-delete their OWN entries from TODAY only
CREATE POLICY "Employees can soft delete own same-day entries" 
ON wash_entries 
FOR UPDATE 
USING (
  auth.uid() = employee_id 
  AND wash_date = CURRENT_DATE
  AND deleted_at IS NULL
)
WITH CHECK (
  auth.uid() = employee_id 
  AND wash_date = CURRENT_DATE
);

-- Allow managers to soft-delete entries for approval workflow
CREATE POLICY "Managers can soft delete approved entries" 
ON wash_entries 
FOR UPDATE 
USING (
  has_role_or_higher(auth.uid(), 'manager'::app_role)
  AND deleted_at IS NULL
)
WITH CHECK (
  has_role_or_higher(auth.uid(), 'manager'::app_role)
);