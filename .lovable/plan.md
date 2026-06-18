
# Plan: Add Car Dealership Platform (isolated from FedEx flow)

Goal: support local car-dealership lot washing alongside the existing FedEx-style per-vehicle tracking. Employees submit one total count per location per day at a configurable per-car rate (default $5.25). Built as a separate code path and separate tables so nothing existing changes behavior — but the **client/location creation and selection flows are designed around how the crews actually work in the field**, not just what's technically possible.

---

## 1. How a dealership gets into the system

There are two realistic entry points. Both go through the same back-end so we can't end up with two parallel "dealership lists."

### A. Admin/Finance creates it ahead of time (preferred)
We extend the existing **Guided Client Setup Wizard** with a step 0: "Business Type" → FedEx or Dealership. Choosing Dealership:
- Step 1 (Client): same form, but skips FedEx-only fields (QB class, Oracle export prefs). Adds "Default rate per vehicle" (pre-filled $5.25).
- Step 2 (Locations): same mapping flow — address auto-fills from billing address. Multiple lots for one dealer group (e.g. "Walser Toyota — Bloomington", "Walser Toyota — Burnsville") are added here.
- Step 3 (Skip): no bulk work-item upload for dealerships — there's nothing to upload, washes are counted not enumerated.

### B. Employee creates it in the field ("Add new dealership")
Crews discover new lots all the time, so the employee dashboard must let them add one without calling the office. **But this is the highest-risk place for duplicates**, so it's gated:

- Button is labeled **"Request new dealership location"** — wording matters; it sets expectations.
- Tapping it opens a 2-step modal:
  1. **Search first (mandatory)**: type the dealership name. We run a fuzzy search (reusing `src/lib/fuzzyMatch.ts`, threshold 0.7) across ALL dealership clients + locations in the system — not just ones they're assigned to. Results show "Walser Toyota — Bloomington (already exists, ask your manager to assign you)" with a clear "This is it" button. **They cannot proceed to step 2 until they've seen results for at least 3 characters.**
  2. **Create**: only enabled if search returned no close matches OR the user explicitly checks "None of these match." Fields: dealership name, lot address (Google Places autocomplete if available, otherwise plain text + city/state), optional notes.
- Submission does NOT immediately create live records. It writes to a new `dealership_location_requests` table with status `pending`. Finance/admin sees these in a queue (badge on admin nav) and approves → creates the actual client + location, or merges into an existing one ("This is the same as Walser Bloomington" → assigns employee to existing location instead).
- This gives us field velocity without trust-falling on duplicate prevention.

### Duplicate prevention layers (defense in depth)
1. **Database**: case-insensitive unique index on `clients.name` where `business_type='dealership'`, and on `(client_id, lower(name))` for `locations` of dealership clients.
2. **Wizard / admin create**: same case-insensitive + normalized (strip punctuation/whitespace) check that already exists in `location-creation-validation` memory — reused, not reimplemented.
3. **Field request flow**: forced search step described above.
4. **Approval queue**: human review on every field-originated record.
5. **Merge tool**: admin page shows clients flagged as "possible duplicate" (fuzzy match score ≥ 0.85 against another dealership client) with a merge action that re-points batches + locations and soft-deletes the loser.

---

## 2. How employees select client/location when logging washes

The submit form has to be one-thumb fast — a tech standing in a parking lot in winter is the design target.

- **Default behavior**: dashboard remembers their last-used dealership location and pre-selects it. ~80% of submissions are at the same lot they were at yesterday.
- **Selection control**: single combined "Location" picker, not separate client+location dropdowns. Options render as `Walser Toyota — Bloomington` (Client em-dash Location) so they never have to think about hierarchy. List is sorted by most-recent-use, then alphabetical.
- **Scope**: only locations where (a) the client is `business_type='dealership'` AND (b) the employee has a `user_locations` assignment. Admins/finance see all (consistent with existing `administrative-location-access` rule).
- **If they have only one assigned dealership location**, the picker collapses to a static label — no dropdown to fight with.
- **"Wrong lot?"** link under the picker opens the same "Request new dealership location" flow described above, so the unhappy path is obvious.

After picking location, the rest is: date (defaults today), count, optional notes, Submit. The rate is shown as read-only (`$5.25 × 47 = $246.75`) so they see what they're billing for.

---

## 3. Data model (new tables, FedEx tables untouched)

- `clients.business_type` — new column, text, default `'fedex'`. Only edit to existing tables. All existing rows = FedEx, so current behavior unchanged.
- `dealership_rates` — `client_id`, `location_id` (nullable = client-wide), `rate_per_vehicle` (default 5.25), `effective_date`, `is_active`.
- `dealership_wash_batches` — `client_id`, `location_id`, `employee_id`, `work_date`, `vehicle_count` (int > 0), `rate_applied` (snapshotted at submit so rate edits don't rewrite history), `notes`, `created_at`. Unique partial index on `(location_id, employee_id, work_date)` — re-submitting the same day edits the existing row instead of duplicating.
- `dealership_location_requests` — `requested_by`, `proposed_client_name`, `proposed_location_name`, `address`, `notes`, `matched_client_id` (nullable, set during review), `status` (pending/approved/merged/rejected), `reviewed_by`, `reviewed_at`, `created_at`.
- `system_settings.dealership_default_rate` seeded to `5.25` for the global default.

RLS mirrors `work_logs`: employees insert/select their own location's data; finance+ full access; admin can delete. All with proper GRANTs.

### Rate precedence
1. Active row in `dealership_rates` for (client, location)
2. Active row for (client, null) — client-wide
3. `system_settings.dealership_default_rate`

---

## 4. Reporting (separate, FedEx reports untouched)

New route **/finance/dealership** with its own builder, parallel SQL function `get_dealership_report_data(...)` that only reads `dealership_wash_batches`. Same Mon–Sun week / Friday invoice date convention as the FedEx reports for QB consistency. CSV/Excel export via the existing `excelExporter`. Existing `/finance/dashboard` and `get_report_data` are not modified — FedEx invoicing is guaranteed unchanged.

---

## 5. Navigation & routing

- `/employee/dashboard` — conditional dealership card appears only if employee is assigned to ≥1 dealership location. FedEx-only employees see no change.
- `/admin/dealership-rates` (finance + admin) — rate management table.
- `/admin/dealership-requests` (finance + admin) — approval queue with badge.
- `/finance/dealership` (finance + admin) — reports.
- Business-type selector added to Create/Edit Client modal + Clients table column + filter.

---

## 6. Safety / non-breaking guarantees

- Zero changes to: `work_logs`, `work_items`, `rate_configs`, `work_types`, their RLS, existing Finance dashboard, existing employee FedEx flow.
- Only schema change to existing data: `clients.business_type` with default `'fedex'`.
- All new functionality gated on `business_type = 'dealership'`. FedEx clients never appear in dealership UI; dealership clients never appear in FedEx rate cards / work items pages.

---

## 7. Implementation order

1. Migration: `clients.business_type`, 4 new tables, RLS + GRANTs, seed default rate, create `get_dealership_report_data`.
2. Extend Client create/edit + wizard with business-type selector + dealership default rate.
3. Build admin dealership-requests approval queue.
4. Build employee dealership submission card (selection UX described in §2) + "Request new location" modal.
5. Build admin dealership-rates page + merge-duplicates tool.
6. Build finance dealership report page + export.
7. QA matrix: FedEx-only employee (no change), dealership-only employee, mixed employee, finance reviewing requests, finance running both reports.

---

## Technical notes

- New code under `src/components/dealership/` and `src/pages/dealership/` to keep the boundary obvious.
- Types added to `src/types/database.ts`: `BusinessType`, `DealershipRate`, `DealershipWashBatch`, `DealershipLocationRequest`.
- Reuse `cutoff`, `activityLogger`, `useAuth`, `fuzzyMatch` — no new infra.
- One INSERT per batch (not per vehicle) — a 200-car day is a single network call.
- "Last-used location" persists in `localStorage` keyed by user id (non-sensitive, just UX).
