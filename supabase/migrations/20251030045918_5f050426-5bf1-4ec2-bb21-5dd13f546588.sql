-- Fix the INSERT policy to be more permissive for authenticated users
-- The issue is that auth.uid() must match employee_id, but we need to ensure this works

-- First, let's check if there are any issues with the current policy
-- Drop and recreate the policy with better error handling

DROP POLICY IF EXISTS "Employees can create their own wash entries" ON wash_entries;

-- Create policy that allows authenticated users to insert wash entries
-- where they are the employee
CREATE POLICY "Employees can create their own wash entries" 
ON wash_entries 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = employee_id);