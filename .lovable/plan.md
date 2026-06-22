# Cars Washed → scroll-wheel count entry

Treat the work type named **"Cars Washed"** (matched case-insensitively) as a count-based service everywhere instead of a per-vehicle list. Employees record a single number 0–999 per day per location via a polished iOS-style scroll wheel.

## 1. Data model

Migration (schema + cleanup):

- Update the `work_types` row where `lower(name) = 'cars washed'`: set `rate_type = 'hourly'` (the existing "rate_config-only, no work_items" path the codebase already supports for hourly services). No new enum value needed; this reuses the proven `direct_rate_config` flow used by hourly entries.
- For every active `rate_config` whose `work_type` is Cars Washed, leave the rate untouched (it becomes the per-car rate, applied to `quantity`).
- Soft-deactivate (`is_active = false`) all `work_items` whose `rate_config.work_type` is Cars Washed. Historical `work_logs` rows that reference those `work_item_id`s are kept as-is for reporting continuity.
- One-time validation: if any location has a Cars Washed work_type but no `rate_config`, surface it in the migration output (don't auto-create — admin needs to set the rate).

## 2. Employee dashboard UI

In `src/pages/EmployeeDashboard.tsx` + `src/components/WorkItemGrid.tsx`:

- Detect `carsWashedConfig` from the already-loaded rate_configs for the selected location (work_type name matches Cars Washed, `rate_type = 'hourly'` post-migration).
- If present, render a new `CarsWashedWheelCard` **above** the WorkItemGrid sections, styled to match the existing collapsible section headers.
- Remove the "Cars Washed" group from `WorkItemGrid` entirely when this card is shown (it would be empty after the migration anyway, since work_items are deactivated).
- The wheel card:
  - Heading: "Cars Washed"
  - Center: iOS-style scroll wheel column showing the selected number large; adjacent numbers dimmed/blurred above and below.
  - Range 0–999, snap-to-integer, momentum scroll on touch + scroll-wheel on desktop, +/− buttons on the sides for accessibility, tap-to-edit numeric input as a fallback.
  - Reads/writes a `pendingEntries` entry keyed by `cars-washed:<rate_config_id>` (extend `PendingEntry` to also allow `rateConfigId` instead of `workItemId`).
- `handleBatchSubmit` extended: when an entry has `rateConfigId` (no `workItemId`), insert a `work_logs` row with `work_item_id = null`, `rate_config_id = <id>`, `quantity = wheel value`. Skip insert when wheel = 0. Honors the existing "one log per day" uniqueness via a pre-fetch + upsert/update path: if a Cars Washed log already exists for `(employee_id, rate_config_id, work_date)`, UPDATE its quantity instead of INSERT.
- The card shows today's currently-saved value (fetched alongside `completedWorkItemIds`) and pre-fills the wheel.

## 3. Other places "Cars Washed" appears

- **Admin Work Items page** (`src/pages/WorkItems.tsx`): add a notice banner explaining Cars Washed is count-based and hide rows whose work_type is Cars Washed from the table (server-side filter via the resolved `rate_config_id` list already computed there). Adding/editing items under that work type is disabled.
- **WorkItemGrid** (`src/components/WorkItemGrid.tsx`): also used elsewhere — filter out Cars Washed work_items defensively so legacy tiles never appear even before the migration runs.
- **Logs/recent entries table** (employee dashboard, finance, reports): already renders both work_item and direct-rate-config logs via `getLogDisplayInfo`; no change beyond confirming the "Cars Washed" label renders correctly for the direct-rate-config branch.
- **CSV import** (`src/components/CSVImportModal.tsx`): reject rows whose work_type is Cars Washed with a clear error ("Cars Washed is count-based, no items to import").

## 4. Scroll-wheel component

New `src/components/ui/scroll-wheel.tsx`:

```text
┌─────────────────┐
│       37        │  ← faded, +1
│       38        │  ← faded, current+? 
│ ▌▌▌▌  39  ▌▌▌▌ │  ← selected (large, accented border lines)
│       40        │
│       41        │
└─────────────────┘
   −   [ 39 ]   +
```

- Pure CSS scroll-snap + `IntersectionObserver` to detect the centered item — no extra deps.
- Props: `min`, `max`, `value`, `onChange`, `itemHeight` (default 56px).
- Mobile-first (touch momentum), works with mouse wheel and keyboard arrows.
- A tap on the center number opens a small numeric input for fast jumps.

## 5. Verification

- Migration runs; Cars Washed work_type becomes `hourly`, related work_items inactive.
- Employee dashboard: wheel appears above the tile grid; setting it to 25 and clicking Submit inserts one `work_logs` row with `quantity = 25`, `rate_config_id` set, `work_item_id` null. Editing later updates the same row.
- Admin → Work Items: Cars Washed rows hidden; banner explains why.
- Reports: a date range covering today shows the Cars Washed quantity rolled into totals correctly (already supported via `get_report_data` joining on `wl.rate_config_id`).

## Out of scope

- No new enum value (`'count'`) or schema additions beyond reusing `rate_type = 'hourly'`.
- No bulk back-fill of historical per-vehicle Cars Washed logs into aggregate rows — history stays as-is.
- No changes to dealership Cars Washed flow (that already uses `dealership_wash_batches`).
