

## Plan: Merge Hourly Items into Services Section with Quantity Input

### Problem
Hourly services (like "Move Vehicle") appear in a separate "Hourly Services" card with rate badges and a "Log Hours" button. The user wants them merged into the existing "Services" collapsible section in the `WorkItemGrid`, without rate tags, and with a quantity input popup when tapped.

### Key Constraint
Hourly items are `rate_configs` (no `work_items` rows), while the grid currently only renders `work_items`. They need to be injected into the grid as virtual tiles.

### Changes

#### 1. `WorkItemGrid.tsx` — Accept and render hourly configs as service tiles
- Add new prop: `hourlyConfigs?: RateConfigWithDetails[]`
- Add new callback prop: `onSelectHourly?: (config: RateConfigWithDetails) => void`
- After fetching per-unit work items, merge hourly configs into the grouped items under the "Services" key, rendering them as tiles using `work_type.name` as the display label
- When an hourly tile is tapped, call `onSelectHourly(config)` instead of `onToggle`
- These tiles skip the batch-selection checkmark styling (not part of batch flow)

#### 2. `EmployeeDashboard.tsx` — Wire hourly configs into the grid, remove separate section
- Pass `hourlyConfigs` and `onSelectHourly={handleHourlySelect}` to `WorkItemGrid`
- Remove the entire "Hourly Services" card (lines ~880–919) and related loading skeleton
- Keep the existing `LogWorkModal` wiring for hourly — `handleHourlySelect` already opens it

#### 3. `LogWorkModal.tsx` — Relabel for hourly items used as quantity entries
- When opened for an hourly `rateConfig`, change "Hours" label to "Quantity" and "Log Hours" to "Log Work"
- Remove the `$/hr` rate badge display for these items

### What doesn't change
- Database schema, RLS, work_logs structure
- Per-unit batch selection flow
- Per-unit service items (they stay as normal toggle tiles)
- The modal itself still submits to `work_logs` with `rate_config_id`

