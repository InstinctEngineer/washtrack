
## Add Total Washes Tracker to Employee Dashboard

### Overview
Add a prominent summary card to the Employee Dashboard that shows the total number of washes (work logs) completed at the employee's assigned locations for the current week. This gives employees visibility into overall team productivity.

### Current Behavior
- The dashboard already fetches `recentLogs` for the current week at the selected location
- These logs include work from ALL employees at that location (not just the current user)
- The data is displayed in a table but lacks a summary statistic

### Implementation

#### 1. Add Summary Card Above Vehicle Grid
Insert a new Card component between the location selector and the Vehicles/Equipment section that displays:
- **Total washes this week** at the selected location (count of all per-unit work logs)
- **Breakdown by work type** (optional - e.g., "12 PUD, 5 Box Truck")
- **My contributions** - how many the current user logged

#### 2. Compute Statistics
Add a `useMemo` hook to calculate:
```typescript
const weeklyStats = useMemo(() => {
  const perUnitLogs = recentLogs.filter(log => log.work_item_id !== null);
  const myLogs = perUnitLogs.filter(log => log.employee_id === user?.id);
  
  // Group by work type
  const byType: Record<string, number> = {};
  perUnitLogs.forEach(log => {
    const typeName = log.work_item?.rate_config?.work_type?.name || 'Unknown';
    byType[typeName] = (byType[typeName] || 0) + 1;
  });
  
  return {
    total: perUnitLogs.length,
    myTotal: myLogs.length,
    byType
  };
}, [recentLogs, user?.id]);
```

#### 3. UI Design
```text
+----------------------------------------------+
| This Week at [Location Name]                 |
+----------------------------------------------+
|                                              |
|    [ICON]  45 Washes          [12 by you]    |
|                                              |
|    PUD: 30  |  Box Truck: 10  |  Trailer: 5  |
+----------------------------------------------+
```

- Large, prominent number for total
- Subtle highlight showing the user's contribution
- Breakdown by work type using badges

#### 4. Add Missing Data to Work Logs Query
The current `fetchRecentLogs` query needs to include `employee_id` to identify who performed each wash. Looking at line 262, it already includes `employee_id` in the select - good!

#### 5. Handle Multiple Locations
If the user has multiple assigned locations:
- Show stats for the **currently selected location** (matches existing behavior)
- The card updates when they switch locations via the dropdown

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/EmployeeDashboard.tsx` | Add `weeklyStats` useMemo, add summary Card component |

### UI Placement
The summary card will be inserted after the location selector (around line 722) and before the Vehicles/Equipment section (line 725). This puts it in a prominent position that employees will see immediately.

### Visual Styling
- Use existing Card component with a subtle highlight color (e.g., `border-primary/20`)
- Large, bold total number with Truck icon
- "by you" portion in a subtle secondary color
- Work type breakdown using Badge components in a flex row

### Edge Cases
- **No washes this week**: Show "0 Washes" with encouraging message
- **Loading state**: Show skeleton while `loadingLogs` is true
- **Single work type**: Don't show breakdown row if only one type exists
