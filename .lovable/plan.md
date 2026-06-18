## Problem

The CSV import is silently failing because:

1. **Every identifier in the upload already exists** in `work_items` under the same `rate_config_id` (Fed Ex BMI Ramp / Fed Ex Trailers / Weekly, and the one PUD config). The table has a unique index on `(rate_config_id, identifier)`, so each `INSERT` throws a duplicate-key error and the row is counted as "failed".
2. **The CSV has an internal duplicate** — identifier `708954` is listed twice. Even on a clean import, the second copy would fail.
3. The current importer catches the error per row, increments `failedCount`, logs to console, and shows a generic toast — the user has no way to know *why* rows failed.

## Fix

Make the importer treat already-present work items as a **skip with a clear reason**, not a failure, and surface CSV-internal duplicates during the preview step so the user sees them before clicking Import.

### Changes to `src/components/CSVImportModal.tsx`

**1. Detect CSV-internal duplicates during `parseCSV`**
- After parsing all rows, build a map of `client_name|location_name|work_type|frequency|identifier` (case-insensitive, trimmed) → row numbers.
- Any key appearing more than once: mark the 2nd+ occurrences with a warning `Duplicate of row N in this file — will be skipped`, and flag them so they are excluded from the import loop (treat as "skipped", not "valid" and not "error").

**2. Detect already-existing work items during `parseCSV`**
- Fetch existing `work_items` joined with `rate_configs` for the clients/locations referenced in the upload, keyed by `(rate_config_id, identifier)` and also by `(client_id, location_id, work_type_name_lower, frequency_lower, identifier)` so we can match before the rate_config is created.
- Simpler: after resolving `client_id` + `location_id` for each row, query `rate_configs` for matching `(client_id, location_id, work_type, frequency)` and check whether `(rate_config_id, identifier)` already exists. Cache results per (client, location).
- Mark matched rows with a warning `Already exists — will be skipped` and exclude from the import loop.

**3. Improve per-row error capture in `handleImport`**
- Replace the bare `console.error` + `failedCount++` with capturing the Postgres error message onto the row (`row.importError`) and re-rendering the row in red with that message after import finishes.
- Specifically detect Postgres error code `23505` (unique violation) and surface a friendly message: `Already exists in the system`.

**4. Update the summary UI**
- Show three counters after import: **Imported**, **Skipped (duplicates / already exist)**, **Failed (with errors)**.
- In the preview table, add a "Skipped" pill (gray) alongside the existing Valid/Warning/Error pills.

### Why not just change the DB?
The unique constraint on `(rate_config_id, identifier)` is correct — you don't want two active work items with the same trailer number under the same rate config. The bug is purely in how the importer presents this to the user.

### What this won't change
- No schema changes.
- No change to how rates, work_types, rate_configs, locations, or clients are created/matched.
- The fuzzy-match flow for clients/locations is untouched.
- Existing successful import paths remain identical.

## After this lands

When you re-upload the BMI Ramp file, the preview will show 14 rows as **Skipped — already exists**, 1 row as **Skipped — duplicate of row 8**, and 0 rows ready to import. You'll know immediately that the file has nothing new in it, instead of seeing a generic "15 failed" toast.
