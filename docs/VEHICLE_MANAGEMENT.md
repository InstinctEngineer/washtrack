# Vehicle Management

## Overview
The WashTrack vehicle management system allows administrators to manage fleet vehicles, configure vehicle types with billing rates, and track vehicle activity across locations.

## Data Model

### Vehicle Types
- **type_name**: Unique name for the vehicle type (e.g., "Sedan", "SUV", "Truck")
- **rate_per_wash**: Decimal value representing the billing rate for washing this vehicle type
- **is_active**: Boolean flag to enable/disable the vehicle type
- **created_at**: Timestamp of when the type was created

### Vehicles
- **vehicle_number**: Unique identifier for the vehicle (alphanumeric, dashes, underscores only)
- **vehicle_type_id**: Foreign key reference to vehicle_types table
- **home_location_id**: Optional foreign key to locations table indicating the vehicle's primary location
- **last_seen_location_id**: Optional foreign key to locations table for tracking last known location
- **last_seen_date**: Date when the vehicle was last seen/scanned
- **is_active**: Boolean flag to enable/disable the vehicle
- **created_at**: Timestamp of when the vehicle was added

## CSV Import

### Format
CSV files should include the following columns:
```
vehicle_number,type_name,home_location_name
```

**Example:**
```csv
vehicle_number,type_name,home_location_name
V-1001,Sedan,Main Facility
V-1002,SUV,North Location
V-1003,Truck,
```

### Import Process
1. Upload CSV file through the admin interface
2. System validates:
   - Required columns are present
   - Vehicle numbers are unique (within the file and against existing records)
   - Referenced vehicle types exist
   - Referenced locations exist (if provided)
3. Preview shows first 5 rows
4. Import creates vehicle records
5. Results report shows:
   - Number of vehicles imported
   - Number skipped (duplicates)
   - Detailed error messages for any failures

### Validation Rules
- **vehicle_number**: Required, alphanumeric with dashes/underscores, max 50 characters
- **type_name**: Must match an existing vehicle type (case-insensitive)
- **home_location_name**: Optional, must match an existing location if provided (case-insensitive)

## Best Practices

### Vehicle Numbering
- Use a consistent naming convention (e.g., V-1001, V-1002)
- Include location codes if managing multiple sites (e.g., NYC-V-1001)
- Keep numbers short but meaningful

### Vehicle Types
- Create types based on wash complexity and pricing structure
- Set accurate rates that reflect labor and material costs
- Regularly review and update rates as costs change
- Deactivate unused types instead of deleting them

### Data Management
- Import vehicles in batches by location for easier management
- Review import errors and fix data issues before re-importing
- Keep vehicle records up to date by marking inactive vehicles
- Use the search and filter features to quickly find specific vehicles

### Security
- Only administrators can create, update, or delete vehicles and types
- All authenticated users can view vehicle information
- RLS policies ensure data access follows role hierarchy

## Permissions

### Read Access
- All authenticated users can view vehicles and vehicle types
- Useful for employees to look up vehicle information during wash operations

### Write Access
- Only administrators can:
  - Create, update, or delete vehicle types
  - Create, update, or delete vehicles
  - Import vehicles via CSV
  - Configure billing rates

## Indexes
The following indexes are created for optimal performance:
- `idx_vehicles_vehicle_number`: Fast lookups by vehicle number
- `idx_vehicles_home_location`: Efficient filtering by home location
- `idx_vehicles_type`: Quick filtering by vehicle type

## Future Enhancements
Potential improvements for future versions:
- Vehicle maintenance tracking
- Wash history per vehicle
- Automated location tracking via scanning
- Vehicle assignment to employees
- Bulk update operations
- Export functionality
- Advanced reporting on vehicle utilization
