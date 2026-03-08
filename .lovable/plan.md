

## Bug Fix: Recent Entries List Missing Items Due to Row Limit

### Root Cause
`fetchRecentLogs` (line 278) has `.limit(50)`. With ~52 vehicles per day across multiple weekdays, total weekly logs easily exceed 50 rows. The query returns the most recent 50, silently dropping older entries. Since `weeklyStats.total` and the Recent Entries table both derive from `recentLogs`, both show incorrect counts.

### Secondary Issue
`fetchCompletedItems` (lines 220-224) doesn't filter by location — it fetches ALL work_logs for the date across all locations, which could incorrectly mark items as "Done" if the same work_item_id appears elsewhere.

### Fix

**File: `src/pages/EmployeeDashboard.tsx`**

1. **Increase limit** on `fetchRecentLogs` from `.limit(50)` to `.limit(500)` — a week of data for 52 vehicles across 7 days = 364 max rows, well within the 500 limit and Supabase's 1000 default.

2. **Filter `fetchCompletedItems` by location** — add a filter so only work_logs for work_items at the selected location are returned, preventing cross-location false "Done" marks.

### Impact
- "Total Washed" count will be accurate
- Recent Entries table will show all entries for the week
- Truck 271745 (and any other missing items) will appear correctly

