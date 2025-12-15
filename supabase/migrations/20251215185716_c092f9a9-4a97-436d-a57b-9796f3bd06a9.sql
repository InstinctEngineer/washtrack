-- Drop the restrictive policy
DROP POLICY IF EXISTS "Employees can read their own record" ON public.users;

-- Create a new policy that allows ANY user to read their own record
CREATE POLICY "Users can read their own record" 
ON public.users 
FOR SELECT 
USING (auth.uid() = id);