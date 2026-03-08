

## Two Issues: Summary Stats & Missing Entry

### Issue 1: Summary Stats Show Page Count, Not Total

**Root cause**: Lines 333-337 compute `summaryStats` from `filteredAndSortedLogs`, which only contains the current page's rows. So "52 entries" shows as "50 entries" on page 1 and "2 entries" on page 2.

**Fix**: 
- Use `totalCount` (from server `{ count: 'exact' }`) for the entry count display
- Add a separate server-side query to sum `quantity` across all matching logs (not just the current page) for total units
- For total dollar value: since rate lives on `rate_configs` (not `work_logs`), compute this via a join query or accept showing `totalCount` + total quantity only

Concretely:
1. Add a parallel aggregate query in the `fetchWorkLogs` function that runs the same filters but does `SELECT SUM(quantity)` instead of paginated rows
2. Store result in new state `totalQuantity`
3. Update `summaryStats` to use `totalCount` for count and `totalQuantity` for units
4. For total value, add a server-side function or compute via joined query (sum of `quantity * rate` across rate_configs)

**Simpler alternative**: Since the display just shows "X entries | $Y", change count to use `totalCount` and add a lightweight aggregate query for the sum. The dollar total can stay page-scoped with a note, or we add a DB function.

### Issue 2: 51 vs 52 Entries — Database Has Only 51

**Investigation results**:
- Vehicle 271745 **IS** in the database for March 4 (work_log id: `8d14aaeb-384c-4bb9-b521-3e980ea34b42`)
- March 4 has exactly 14 PUD entries — matches user's claim
- Total entries for this employee for the week: **51** (14 + 10 + 12 + 15 across Mar 4-7)
- The original display issue about 271745 "not showing in bottom list" was the pagination bug (now fixed)

**Conclusion**: The database genuinely has 51 entries, not 52. This is not a query/display bug — one entry either wasn't submitted or failed silently during submission. Since 271745 is confirmed present, the "missing" entry is on a different day. The user would need to identify which specific entry they believe is missing so we can check if submission failed.

### Plan

**File: `src/pages/FinanceThisWeek.tsx`**

1. Add new state: `totalQuantity` and `totalValue` for cross-page aggregates
2. In `fetchWorkLogs`, after the main paginated query, run a second lightweight query with the same filters but selecting `SUM(quantity)` — or fetch all quantities without pagination using a separate call
3. For total value, create a small DB function `get_work_logs_summary(start_date, end_date, employee_ids[], ...)` that returns `{count, total_qty, total_value}` by joining work_logs → rate_configs
4. Update the summary display (line 501-504) to use `totalCount` and the aggregate values instead of `filteredAndSortedLogs`

**Simpler approach without a new DB function:**
- Run the same filtered query but with `.select('quantity, rate_config_id, work_item_id')` without `.range()` to get all rows' quantities
- This is fine for <1000 rows; for larger datasets we'd need a DB function
- Compute totals from this full result set

Given this employee has 51 entries (well under 1000), the simpler approach works. For the dollar total, we already have rate_configs cached — we can sum quantity × rate from the full (unpaginated) lightweight query.

### Regarding the 51 vs 52 discrepancy

This is a **data issue**, not a code bug. The database has exactly 51 entries. I'll flag this finding so you can follow up with the employee about which specific entry they believe is missing.

