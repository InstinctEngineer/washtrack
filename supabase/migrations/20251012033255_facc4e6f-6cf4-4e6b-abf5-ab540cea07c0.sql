-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Admin can insert vehicles" ON vehicles;

-- Create new policy allowing admins to insert
CREATE POLICY "Admin can insert vehicles" ON vehicles
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create new policy allowing employees to insert vehicles for their location
CREATE POLICY "Employees can create vehicles for wash entries" ON vehicles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Must be an employee
    has_role(auth.uid(), 'employee'::app_role) AND
    -- Can only set home_location to their own location
    home_location_id IN (
      SELECT location_id 
      FROM users 
      WHERE id = auth.uid()
    )
  );