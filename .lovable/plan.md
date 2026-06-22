## What's actually happening

I checked the database. **Every identifier in your CSV is already present in `work_items`** under client `Fed Ex BMI Ramp` / location `Fed Ex BMI Ramp` with the matching work type and frequency (402640, 402987, 603498, 711717, 708954, etc. — all 25 rows already exist).

So the import isn't silently failing. The `CSVImportModal` correctly detects them as duplicates in its "already exists" check and skips them. The toast just says "Successfully imported 0 services" without making it obvious that 25 rows were skipped.

But there's a real bug behind why you can't *find* them in the Work Items UI:

### Root cause: 1000-row PostgREST cap on Work Items page

`src/pages/WorkItems.tsx` loads work items with:

```ts
supabase.from('work_items').select(`*, rate_config:rate_configs(...)`).order('identifier')
```

There's no `.range()` or pagination. PostgREST defaults to a **1000-row maximum** per request. The `work_items` table currently has **1502 rows**. The page only ever sees the first 1000 (ordered by `identifier` ASC), and the search box filters that already-truncated client-side array — so any identifier that lives beyond row 1000 is invisible, no matter what you type in search.

That's why the imported rows look "missing" even though they exist in the database.

## Plan

### 1. Fix Work Items page to see all rows
- In `src/pages/WorkItems.tsx`, change the work-items query to fetch beyond the 1000-row cap. Add `.range(0, 9999)` (and bump later if needed) so all current rows load.
- Same treatment for the `rate_configs` query on that page if it has the same shape.

### 2. Make the search actually work at scale
- Even with `.range(0, 9999)`, client-side filtering of thousands of rows is fragile. Switch the identifier search to **server-side**: when `search` is non-empty, add `.ilike('identifier', `%${search}%`)` to the Supabase query (debounced ~250ms) and drop that part of the client-side filter. Keep client/location/work-type filters as Supabase `.eq()` filters too so the page stays snappy.

### 3. Clarify CSV import summary
In `src/components/CSVImportModal.tsx`:
- The post-import toast and the results banner currently show only `success` / `failed`. Add a third count: **skipped (already exists)**, computed from rows where `isSkipped` is true (both pre-import duplicate detection and import-time 23505 skips).
- Update toast to read e.g. `"Imported 0 new services. 25 already existed and were skipped."` so a no-op import doesn't look like a successful add.

### 4. Audit other tables for the same 1000-row cap
Quick pass over the other heavy list pages (`RateCard.tsx`, `WorkTypes.tsx`, `LocationTable.tsx`, `UserTable.tsx`, `ActivityLogs.tsx`) — any query without `.range()` on a table that could exceed 1000 rows gets the same `.range(0, 9999)` fix or server-side search. I'll only touch the ones that actually risk overflow.

### Out of scope
- No schema or RLS changes.
- Not deleting or modifying the existing duplicate work_items already in the DB (e.g. the `705847.` variant) — flag only.
