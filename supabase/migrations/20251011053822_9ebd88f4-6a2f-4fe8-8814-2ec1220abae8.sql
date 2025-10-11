-- Add a flag to identify the special "all locations" entry
ALTER TABLE locations 
ADD COLUMN is_all_locations BOOLEAN DEFAULT false;

-- Insert the special "All Locations" entry
INSERT INTO locations (name, address, is_all_locations, is_active)
VALUES ('All Locations', 'Headquarters - Access to all sites', true, true)
ON CONFLICT DO NOTHING;