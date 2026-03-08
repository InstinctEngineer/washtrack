

## Fix: Work Logs Server-Side Filtering

### Problem
The query on line 115-128 fetches a page of `pageSize` rows from ALL work_logs, then filters by employee/client/location/work type client-side (lines 246-257). When an employee has 52 logs but the page size is 50, the unfiltered query returns 50 mixed rows — after client-side employee filtering, some of that employee's logs are on later pages and get excluded.

### Solution
Push all four filters into the database query so pagination operates on the already-filtered dataset. This is the correct long-term approach.

### Changes to `src/pages/FinanceThisWeek.tsx`

**1. Add server-side filters to the query (after line 119, before `.order()`):**

```typescript
// Employee filter
if (selectedEmployees.length > 0) {
  query = query.in('employee_id', selectedEmployees);
}
```

For client, location, and work type filters — these require joining through `rate_configs` which isn't possible with simple `.in()` on `work_logs`. Instead, pre-fetch matching work_item_ids and rate_config_ids:

```typescript
// If client/location/workType filters are active, resolve matching rate_config_ids first
if (selectedClients.length > 0 || selectedLocations.length > 0 || selectedWorkTypes.length > 0) {
  let rcQuery = supabase.from('rate_configs').select('id');
  if (selectedClients.length > 0) rcQuery = rcQuery.in('client_id', selectedClients);
  if (selectedLocations.length > 0) rcQuery = rcQuery.in('location_id', selectedLocations);
  if (selectedWorkTypes.length > 0) rcQuery = rcQuery.in('work_type_id', selectedWorkTypes);
  const { data: matchingRcs } = await rcQuery;
  const rcIds = (matchingRcs || []).map(r => r.id);

  if (rcIds.length === 0) {
    // No matching configs — no results possible
    setWorkLogs([]); setTotalCount(0); setLoading(false); return;
  }

  // Get work_item_ids for these rate_configs
  const { data: matchingWis } = await supabase
    .from('work_items').select('id').in('rate_config_id', rcIds);
  const wiIds = (matchingWis || []).map(w => w.id);

  // Filter work_logs: rate_config_id in rcIds OR work_item_id in wiIds
  // Supabase doesn't support OR across columns easily, so use .or()
  const orParts: string[] = [];
  if (rcIds.length > 0) orParts.push(`rate_config_id.in.(${rcIds.join(',')})`);
  if (wiIds.length > 0) orParts.push(`work_item_id.in.(${wiIds.join(',')})`);
  if (orParts.length > 0) query = query.or(orParts.join(','));
}
```

**2. Add filter states to useEffect dependency array (line 239):**
```typescript
}, [startDate, endDate, currentPage, pageSize, urlWorkLogIds.join(','),
    selectedEmployees.join(','), selectedClients.join(','),
    selectedLocations.join(','), selectedWorkTypes.join(',')]);
```

**3. Reset page to 1 when filters change — add a separate useEffect:**
```typescript
useEffect(() => {
  setCurrentPage(1);
}, [selectedEmployees, selectedClients, selectedLocations, selectedWorkTypes]);
```

**4. Update `totalPages` calculation (line 301):**
Keep using `totalCount` from the server (already correct since `{ count: 'exact' }` reflects the filtered count).

**5. Update summary stats to use `totalCount` for the count display** since `filteredAndSortedLogs` will now equal the page of data (client-side filters become no-ops as a safety net — keep them).

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/FinanceThisWeek.tsx` | Push employee/client/location/workType filters into the DB query; add deps to useEffect; reset page on filter change |

