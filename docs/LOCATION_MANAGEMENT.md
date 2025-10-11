# Location Management Guide

## Overview
The Location Management system allows administrators to create, edit, and manage wash locations within WashTrack. Each location can have an assigned manager, employees, and vehicles.

## Accessing Location Management
**Path:** `/admin/locations`  
**Required Role:** Admin

Navigate to the Admin Dashboard and click on the "Locations" card, or use the sidebar navigation to access "Locations" under Administration.

## Creating a New Location

### Quick Setup
If no locations exist in the system, you'll see a "Quick Setup" button that creates 3 sample locations:
- Location A (123 Main St)
- Location B (456 Oak Ave)
- Location C (789 Pine Rd)

This is helpful for initial testing and demonstration purposes.

### Manual Creation
1. Click the "Add Location" button in the top-right corner
2. Fill in the location details:
   - **Location Name** (required): Unique name, max 100 characters
   - **Address** (optional): Full address, max 250 characters
   - **Assign Manager** (optional): Select from active managers
   - **Active** (default: checked): Whether location is operational

3. Click "Create Location"

### Validation Rules
- Location name must be unique (case-insensitive)
- Location name is required and cannot be empty
- Address is optional but limited to 250 characters
- Only users with the "manager" role can be assigned as location managers

### Common Errors
- **Duplicate Location**: A location with the same name already exists
- **Invalid Manager**: Selected user must have manager role and be active

## Viewing Location Details

Click on any location name in the table to open a detailed view showing:

### Statistics
- **Total Employees**: Number of active employees assigned
- **Total Vehicles**: Number of active vehicles with this as home location
- **Monthly Washes**: Total wash entries logged at this location (current month)
- **Last Wash Date**: Most recent wash entry date

### Employee List
Table showing all employees assigned to this location with:
- Employee name
- Employee ID
- Email address
- Active/Inactive status

### Vehicle List
Table showing all vehicles with this location as home location:
- Vehicle number
- Vehicle type
- Active/Inactive status

### Actions
- Click "Edit" button to modify location details
- View manager assignment and contact information

## Editing a Location

1. Click the "Edit" icon (pencil) next to any location
2. Modify any of the following:
   - Location name
   - Address
   - Manager assignment
   - Active status

3. Click "Save Changes"

### Manager Reassignment
If you change the assigned manager, a confirmation dialog will appear:
- Shows old manager name and new manager name
- Confirms the reassignment before saving
- Can be cancelled at any time

### Duplicate Name Prevention
The system prevents duplicate location names. If you try to rename a location to a name that already exists, you'll receive an error message.

## Activating/Deactivating Locations

### Deactivating a Location
1. Click the "Power" icon next to the location
2. A confirmation dialog appears showing:
   - Location name being deactivated
   - Warning if active employees are assigned
   - Number of affected employees

3. Confirm to deactivate

**Effects of Deactivation:**
- Employees at this location cannot log new wash entries
- Location remains in database with is_active = false
- Can be reactivated at any time
- Historical data is preserved

### Reactivating a Location
1. Filter to show "Inactive Only" locations
2. Click the "Power" icon next to the inactive location
3. Confirm activation
4. Location becomes operational again

## Filtering and Searching

### Status Filter
Use the dropdown to filter locations:
- **All Locations**: Show both active and inactive
- **Active Only**: Show only operational locations
- **Inactive Only**: Show only deactivated locations

### Search
Type in the search box to filter by:
- Location name (partial match)
- Address (partial match)
- Case-insensitive search

## Sorting

Click on column headers to sort the table:
- **Location Name**: Alphabetical (A-Z or Z-A)
- **Active Vehicles**: By count (ascending or descending)
- **Active Employees**: By count (ascending or descending)

The sort direction indicator (↑ or ↓) shows current sort order.

## Location Statistics in Table

Each row in the table displays:
- **Location Name**: Click to view details
- **Address**: Full address or "-" if not specified
- **Assigned Manager**: Manager name or "Unassigned"
- **Active Vehicles**: Count of vehicles with this as home location
- **Active Employees**: Count of employees assigned here
- **Status**: Active (green badge) or Inactive (gray badge)
- **Actions**: View, Edit, and Activate/Deactivate buttons

## Best Practices

### When to Create a Location
Create a new location when:
- Opening a new physical wash site
- Reorganizing operations into zones
- Setting up a new depot or station

### Manager Assignment
- Assign managers who will oversee that specific location
- Managers can view data for their assigned location and employees
- Only one manager per location
- Managers must have the "manager" role

### Deactivation vs. Deletion
**Locations cannot be deleted** - they can only be deactivated. This preserves:
- Historical wash entry data
- Vehicle location history
- Employee assignment records
- Reporting accuracy

### Employee and Vehicle Assignment
- Employees are assigned to locations via User Management
- Vehicles are assigned home locations via Vehicle Management
- Changes to location assignment should be done through those respective interfaces

## Integration with Other Features

### Employee Dashboard
- Employees can only log washes at their assigned location
- Employee's location determines which location is recorded for wash entries
- Inactive locations prevent new wash entries

### Manager Dashboard
- Managers see data for their assigned location
- Can view employee performance at their location
- Access to location-specific reports

### Finance Dashboard
- Location data used in revenue reports
- Wash counts aggregated by location
- Performance comparisons across locations

### Vehicle Tracking
- Each vehicle has a home location (base assignment)
- Last seen location tracked separately (where it was washed)
- Helps identify vehicles washing at non-home locations

## Troubleshooting

### Cannot Create Location
**Problem:** "Duplicate location" error  
**Solution:** Choose a different location name - names must be unique

**Problem:** Cannot select any managers  
**Solution:** Create users with "manager" role first via User Management

### Cannot Deactivate Location
**Problem:** Location won't deactivate  
**Solution:** Check for active employees - you may need to reassign them first

### Location Not Showing in Dropdown
**Problem:** Location doesn't appear in selection lists  
**Solution:** Ensure location is active - inactive locations are hidden from most dropdowns

### Statistics Not Updating
**Problem:** Employee/vehicle counts seem wrong  
**Solution:** Refresh the page - counts are calculated in real-time but may need a refresh

## Security and Permissions

### Admin-Only Access
- Only users with "admin" role can access Location Management
- Other roles cannot create, edit, or deactivate locations
- Protects operational integrity

### Row Level Security (RLS)
The locations table has the following security policies:
- **SELECT**: All authenticated users can read locations
- **INSERT**: Only admins can create locations
- **UPDATE**: Only admins can modify locations
- **DELETE**: Not allowed (use deactivation instead)

### Data Privacy
- Location addresses are visible to all authenticated users
- Manager assignments are visible across the system
- No sensitive personal data stored in locations table

## API and Database Structure

### Table Schema
```sql
locations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  manager_user_id UUID REFERENCES users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
)
```

### Related Tables
- **users**: Employees and managers assigned to locations
- **vehicles**: Vehicles with home_location_id
- **wash_entries**: Wash records with actual_location_id

### Common Queries
- Get active locations: `WHERE is_active = true`
- Get location employees: `users WHERE location_id = :location_id`
- Get location vehicles: `vehicles WHERE home_location_id = :location_id`
- Get monthly washes: `wash_entries WHERE actual_location_id = :location_id AND wash_date >= :start_of_month`

## Future Enhancements

Planned features for location management:
- Bulk import/export of locations
- Location hierarchy (regions, districts)
- Custom operating hours per location
- Location-specific wash rates
- GPS coordinates for mapping
- Photo uploads for location identification
- Capacity limits and scheduling
