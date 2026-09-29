# Client Portal: Summary Totals by Category

## Goal
The client portal wash-history page currently shows only one grand total. Add a summary that breaks totals down by category (work type) so clients can see, at a glance, how many of each service was performed in the selected date range.

## Changes

### `src/pages/portal/PortalLocationHistory.tsx`
1. **Per-category totals (non-dealership locations):**
   - Add a memoized summary that groups the filtered rows by `work_type_name` and sums `quantity` for each.
   - Render a summary strip above the history table: one small stat block per work type — name plus total count — sorted by count descending.
   - The summary respects the date range and the text filter, so it always matches what the table shows.
   - The existing grand-total banner stays as-is.

2. **Dealership locations:**
   - These have a single category (vehicles washed per day), so the existing grand total already covers it; add a "Days washed" count alongside the vehicle total for a bit more context.

3. **CSV export:** append a `summary` section at the bottom of the exported CSV listing each work type and its total, so downloads match the on-screen summary.

## Technical notes
- Pure frontend change: group/sum the rows already returned by `get_portal_work_history` / `get_portal_dealership_history`; no new RPCs or database changes.
- Styling follows the existing portal card/banner pattern (muted background, tabular numbers), no new dependencies.

## Verification
- `npx tsgo --noEmit` passes; build OK.
- Open a portal location history page, confirm per-work-type totals match the table rows, and confirm the filter and date range update the summary.
