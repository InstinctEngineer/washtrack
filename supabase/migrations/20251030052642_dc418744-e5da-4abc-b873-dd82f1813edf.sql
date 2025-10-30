-- Simplify RLS policies for wash_entries
-- Remove complex soft-delete and restore policies for employees
-- Keep it simple: employees can INSERT, managers/admins can do everything

-- Drop employee soft-delete and restore policies
DROP POLICY IF EXISTS "Employees can soft delete own same-day entries" ON wash_entries;
DROP POLICY IF EXISTS "Employees can restore own same-day deleted entries" ON wash_entries;

-- Keep the simple INSERT policy for employees (already exists)
-- Keep manager and admin policies (already exist)

-- The remaining policies should be:
-- 1. Employees can create their own wash entries (INSERT)
-- 2. Employees can read their own wash entries (SELECT) 
-- 3. Managers can soft delete approved entries (UPDATE)
-- 4. Admin can update wash entries (UPDATE)
-- 5. Admin can delete wash entries (DELETE)
-- 6. Finance and admin can read all wash entries (SELECT)

-- Add comment for clarity
COMMENT ON TABLE wash_entries IS 'Employees use local state and batch INSERT. Only managers/admins can UPDATE/DELETE existing entries.';