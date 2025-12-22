
-- Add foreign key constraints to work_entries table
-- These are required by the PostgREST queries that use foreign key hints

-- Add foreign key from work_entries.employee_id to users.id
ALTER TABLE work_entries 
ADD CONSTRAINT work_entries_employee_id_fkey 
FOREIGN KEY (employee_id) REFERENCES users(id);

-- Add foreign key from work_entries.location_id to locations.id
ALTER TABLE work_entries 
ADD CONSTRAINT work_entries_location_id_fkey 
FOREIGN KEY (location_id) REFERENCES locations(id);
