# Cutoff Date Management System

## Overview

The Cutoff Date Management system controls when employees can enter wash records. This prevents employees from making entries for dates that have already been closed for processing, while allowing administrators and finance users to override these restrictions when necessary.

## Key Concepts

### Cutoff Date
The **cutoff date** is the earliest date/time for which employees can enter wash records. Any wash entries with a `wash_date` before the cutoff will be blocked for regular employees.

**Default Behavior:**
- Cutoff is automatically set to the previous Saturday at 23:59:59
- This provides a weekly cycle where data entry closes every Saturday night
- Admin users can extend or modify this date as needed

### User Roles and Permissions

**Employee:**
- Cannot enter washes before the cutoff date
- Sees prominent banner indicating entry period status
- Must contact manager for corrections to closed periods

**Manager:**
- Same restrictions as employees for wash entries
- Can coordinate with admin/finance for override entries

**Finance & Admin:**
- Can override cutoff restrictions
- Can enter washes for any date, including past cutoff
- Entries made past cutoff are flagged as "Override Entry"

## Admin Settings Page

### Location
`/admin/settings`

### Features

#### 1. Cutoff Date Display
Shows the current cutoff date with visual indicators:
- **Green**: More than 2 days until cutoff
- **Yellow**: 2 days or less until cutoff  
- **Red**: Past cutoff date

#### 2. System Statistics
- Active Employees count
- Active Vehicles count
- Days until next automatic cutoff

#### 3. Cutoff Management Actions

**Extend Cutoff by 1 Week:**
- Adds 7 days to current cutoff date
- Requires confirmation showing date range extension
- Logs change in audit trail

**Reset to Last Saturday:**
- Sets cutoff to previous Saturday at 23:59:59
- Closes entry period for data already entered
- Requires confirmation before applying

**Manual Date Selection** (Future):
- Custom date/time picker
- Validation: Cannot set more than 30 days in future
- Warning if setting date in past

#### 4. Audit Trail
Displays last 20 cutoff changes with:
- User who made the change
- Old cutoff value
- New cutoff value
- Reason for change (optional)
- Timestamp

## Employee Dashboard Integration

### Cutoff Banner
Prominent banner at top of employee dashboard showing:

**Green (More than 2 days):**
```
✓ Entry period open until Saturday, October 12, 2024 at 11:59 PM
```

**Yellow (2 days or less):**
```
⚠ Entry deadline approaching: Saturday, October 12, 2024 at 11:59 PM
```

**Red (Past cutoff):**
```
✖ Entry period closed as of Saturday, October 5, 2024 at 11:59 PM. 
Contact your manager for corrections.
```

## Wash Entry Enforcement

### Employee Restrictions
When an employee attempts to enter a wash:

```typescript
if (wash_date < cutoff_date && user.role === 'employee') {
  throw new Error('Cannot enter washes before cutoff date. Contact manager.');
}
```

**Validation happens:**
- Before form submission
- On date selection (disabled dates before cutoff)
- On server-side (via RLS policies - future enhancement)

### Finance/Admin Override
- Finance and Admin users bypass the cutoff check
- Their entries past cutoff are flagged with "Override Entry" badge
- System tracks who made the override entry

## Database Schema

### system_settings Table
```sql
CREATE TABLE system_settings (
  id UUID PRIMARY KEY,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMP WITH TIME ZONE,
  description TEXT
);
```

**Default Record:**
```sql
setting_key: 'entry_cutoff_date'
setting_value: '2024-10-05T23:59:59Z'
description: 'Employees cannot enter washes before this date/time'
```

### system_settings_audit Table
```sql
CREATE TABLE system_settings_audit (
  id UUID PRIMARY KEY,
  setting_key TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMP WITH TIME ZONE,
  change_reason TEXT
);
```

### RLS Policies

**system_settings:**
- SELECT: All authenticated users
- UPDATE/INSERT: Admin only

**system_settings_audit:**
- SELECT: All authenticated users
- INSERT: System (via trigger)

## Utility Functions

Located in `/src/lib/cutoff.ts`:

### getCurrentCutoff()
Fetches the current cutoff date from system_settings.

```typescript
const cutoff = await getCurrentCutoff();
// Returns: Date | null
```

### isBeforeCutoff(date)
Checks if a given date is before the cutoff.

```typescript
const isPastCutoff = await isBeforeCutoff(washDate);
// Returns: boolean
```

### getLastSaturday()
Calculates the previous Saturday at 23:59:59.

```typescript
const lastSaturday = getLastSaturday();
// Returns: Date
```

### canUserOverrideCutoff(userRole)
Checks if user role can override cutoff restrictions.

```typescript
const canOverride = canUserOverrideCutoff(user.role);
// Returns: boolean (true for admin/finance)
```

### getDaysUntilNextCutoff()
Returns days until next Saturday (automatic cutoff).

```typescript
const days = getDaysUntilNextCutoff();
// Returns: number
```

### getCutoffStatusColor(cutoffDate)
Returns visual status indicator color.

```typescript
const color = getCutoffStatusColor(cutoff);
// Returns: 'green' | 'yellow' | 'red'
```

### updateCutoffDate(newDate, userId, reason?)
Updates cutoff date in system_settings.

```typescript
const result = await updateCutoffDate(
  new Date('2024-10-15T23:59:59Z'),
  userId,
  'Extension requested by payroll'
);
// Returns: { success: boolean; error?: string }
```

### extendCutoffByDays(days, userId, reason?)
Extends current cutoff by specified days.

```typescript
const result = await extendCutoffByDays(7, userId, 'Extended by 1 week');
// Returns: { success: boolean; error?: string; newDate?: Date }
```

## Common Scenarios

### Scenario 1: Weekly Payroll Cycle
**Default Setup:**
- Cutoff resets every Saturday at 23:59:59
- Employees enter washes Mon-Sat for previous week
- Saturday night: Period closes automatically
- Sunday morning: Payroll can process without new entries

### Scenario 2: Extending for Corrections
**Situation:** Employee finds error on Monday after period closed

**Process:**
1. Employee contacts manager
2. Manager requests admin to extend cutoff
3. Admin clicks "Extend Cutoff by 1 Week"
4. Employee makes corrections
5. Admin resets cutoff when done

### Scenario 3: Emergency Override Entry
**Situation:** Critical wash was missed during closed period

**Process:**
1. Finance user logs in
2. Enters wash despite cutoff (bypass enabled)
3. Entry flagged as "Override Entry"
4. Audit trail records finance user and timestamp

## Best Practices

### For Admins
1. **Communicate cutoff dates** to all users in advance
2. **Review audit trail** regularly for unusual patterns
3. **Use extensions sparingly** to maintain data integrity
4. **Document reasons** when extending cutoff periods
5. **Monitor override entries** by finance users

### For Employees
1. **Check banner status** daily on dashboard
2. **Enter washes promptly** before deadline
3. **Review entries** before cutoff closes
4. **Contact manager immediately** if corrections needed after closure

### For Finance Users
1. **Use override capability responsibly**
2. **Document reason** for past-cutoff entries
3. **Notify relevant parties** of override entries
4. **Verify accuracy** before submitting override entries

## Troubleshooting

### Issue: Employee can't see cutoff banner
**Solution:**
- Check that system_settings table has entry_cutoff_date record
- Verify user is authenticated
- Check browser console for errors

### Issue: Cutoff date won't update
**Solution:**
- Verify user has admin role in user_roles table
- Check RLS policies on system_settings
- Review database logs for errors

### Issue: Override entries not flagged
**Solution:**
- Confirm user role is finance or admin
- Check wash entry component logic
- Verify canUserOverrideCutoff() function

## Future Enhancements

1. **Email notifications** when cutoff is extended
2. **Custom cutoff schedules** (bi-weekly, monthly)
3. **Location-specific cutoffs** for multi-site operations
4. **Automated approval workflow** for override entries
5. **Bulk entry imports** with cutoff validation
6. **RLS policy enforcement** at database level
7. **Mobile app notifications** for cutoff deadlines

## Security Considerations

### Data Integrity
- Cutoff prevents retroactive data manipulation
- Override entries are tracked and auditable
- Audit trail is append-only (no deletions)

### Access Control
- Only admin can modify cutoff settings
- Finance/admin overrides are logged
- RLS policies enforce permission boundaries

### Compliance
- Audit trail provides compliance documentation
- Change reasons support regulatory requirements
- Historical cutoff data preserved for auditing

## Integration Points

### Employee Dashboard
- CutoffBanner component displays status
- Wash entry forms check cutoff before submission

### Manager Dashboard
- View cutoff status for employee coordination
- No direct cutoff management access

### Finance Dashboard
- Override capability for corrections
- Audit trail visibility

### Admin Dashboard
- Full cutoff management interface
- System statistics and monitoring
- Audit trail review

## API Reference

### Supabase Queries

**Fetch Cutoff:**
```typescript
const { data } = await supabase
  .from('system_settings')
  .select('setting_value')
  .eq('setting_key', 'entry_cutoff_date')
  .single();
```

**Update Cutoff:**
```typescript
const { error } = await supabase
  .from('system_settings')
  .update({
    setting_value: newDate.toISOString(),
    updated_by: userId,
    updated_at: new Date().toISOString(),
  })
  .eq('setting_key', 'entry_cutoff_date');
```

**Fetch Audit Trail:**
```typescript
const { data } = await supabase
  .from('system_settings_audit')
  .select('*')
  .eq('setting_key', 'entry_cutoff_date')
  .order('changed_at', { ascending: false })
  .limit(20);
```

---

**Version:** 1.0  
**Last Updated:** October 2024  
**Maintained By:** Development Team
