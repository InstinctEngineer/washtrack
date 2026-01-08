# Plan: Update SuperAdminDatabase TABLES Constant

## Problem
The `TABLES` constant in `src/pages/SuperAdminDatabase.tsx` (lines 18-31) contains references to tables that no longer exist in the database:
- `client_locations` (removed)
- `vehicles` (removed)
- `vehicle_types` (removed)
- `work_entries` (removed)
- `service_categories` (removed)
- `wash_frequencies` (removed)
- `location_service_rates` (removed)

This causes errors when users try to select these non-existent tables.

## Solution
Replace the `TABLES` constant with the list of tables that actually exist in the database.

## Implementation Steps

### Step 1: Update TABLES constant (lines 18-31)
Replace the current TABLES array:
```typescript
const TABLES = [
  'users',
  'user_roles',
  'locations',
  'clients',
  'client_locations',
  'vehicles',
  'vehicle_types',
  'work_entries',
  'service_categories',
  'wash_frequencies',
  'location_service_rates',
  'system_settings'
];
```

With the corrected list (alphabetically sorted for easier navigation):
```typescript
const TABLES = [
  'audit_log',
  'clients',
  'employee_comments',
  'locations',
  'manager_approval_requests',
  'message_reads',
  'message_replies',
  'rate_configs',
  'report_templates',
  'system_settings',
  'system_settings_audit',
  'user_locations',
  'user_roles',
  'users',
  'work_items',
  'work_logs',
  'work_types'
];
```

## Files to Modify
- `src/pages/SuperAdminDatabase.tsx` - Update TABLES constant (lines 18-31)

## Critical Files for Implementation
- src/pages/SuperAdminDatabase.tsx - Contains the TABLES constant to update

## Testing
After implementation, verify:
1. Navigate to /super-admin/database
2. All table tabs should load without errors
3. Each table should display its data correctly
