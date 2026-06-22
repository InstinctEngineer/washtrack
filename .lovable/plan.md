## What I found

- DB: identifier `710750` exists (Fed Ex BMI Ramp / Fed Ex Trailer / Weekly / $37.50, rate_config active).
- UI `/admin/items` search for `710750` returns **"No work items match your filters"**, and the page badge shows `Work Items 1000`.
- Network: the `work_items` request returns `Content-Range: 0-999/*` — the server enforces a hard `max-rows=1000` cap that overrides my `.range(0, 49999)`. There are 1502 rows; alphabetically `710750` sits past row 1000, so the client never receives it.

The previous fix doesn't work. I need to filter server-side.

## Plan

Rework `src/pages/WorkItems.tsx` so the visible rows come from server filters instead of "fetch-all-then-filter-in-JS".

### 1. Server-side filtering for the `work_items` query
- Make the query key depend on `search`, `filterClient`, `filterLocation`, `filterWorkType` so it re-runs when they change.
- Debounce `search` ~250 ms (small helper hook) so each keystroke doesn't fire a request.
- Apply filters on the server:
  - `search`: `.ilike('identifier', `%${debouncedSearch}%`)`
  - `filterClient` / `filterLocation` / `filterWorkType`: pre-resolve the matching `rate_config_id`s from the already-loaded `rateConfigs` array (132 rows total — cheap) and add `.in('rate_config_id', ids)` to the `work_items` query. If the resolved list is empty, short-circuit to `[]` without hitting the network.
- Keep `.range(0, 999)` (server cap). With filters applied, results virtually always fit; if a filter set ever exceeds 1000, surface a "Refine filters to see more" hint at the bottom of the table.
- Drop the now-redundant client-side `filteredItems` filtering; sorting via `useTableSort` stays.

### 2. Same fix for the `rate_configs` selection list on this page
- `rate-configs-all` (used by the Add/Edit form) is also server-capped at 1000. Confirmed only 132 rows today, so it's fine — leave as is but add a brief comment that it's bounded.

### 3. Tighten the import toast (carry-over)
Already in place from last turn, no change.

### Verification (after build)
- Reload `/admin/items`, type `710750`, confirm the row appears.
- Clear search, pick "Fed Ex BMI Ramp" client filter, confirm all 25 imported identifiers (402640, 402987, 603498, …, 711717) show up.
- Spot-check sorting still works on identifier/work-type/rate.

### Out of scope
- No pagination UI (server filters make the visible set small).
- No schema changes; no edit to the global `max-rows` setting.
- Other pages with large tables (`activity_logs` is already paginated; `work_logs`/`rate_configs` are under 1500 and date-filtered in their pages) — not touching this turn.
