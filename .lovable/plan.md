# Sandboxed App Reviewer Test Account

Goal: give Apple/Google reviewers a login that fully exercises the employee flow but is walled off from real client data, billing, invoices, exports, and reports.

## 1. Database migration

Add an `is_test` flag and seed one isolated test client + location.

- `ALTER TABLE public.locations ADD COLUMN is_test boolean NOT NULL DEFAULT false;`
- `ALTER TABLE public.clients ADD COLUMN is_test boolean NOT NULL DEFAULT false;` (needed because `locations.client_id` is NOT NULL — the test location must belong to a test client so real client rollups stay clean).
- Insert one `clients` row: name `"ZZ TEST — App Review (do not bill)"`, `is_test = true`, minimal required fields.
- Insert one `locations` row tied to that client: name `"ZZ TEST — App Review (do not bill)"`, `is_test = true`, `latitude = NULL`, `longitude = NULL`, `is_active = true`.
- Add one active `rate_configs` row + a couple of `work_items` under the test location so the reviewer has something to log against (e.g. an hourly "Cars Washed" config and 2–3 unit identifiers). All non-billable because the location is `is_test`.

## 2. Exclude test data from every billing / report path

Update the two SECURITY DEFINER report RPCs to skip test rows:

- `public.get_report_data(...)` — add `AND l.is_test = false AND c.is_test = false` to the WHERE.
- `public.get_dealership_report_data(...)` — same filter.
- `public.get_portal_dealership_history` / `get_portal_work_history` — unaffected (portal users can't reach the test location anyway), but add the same guard for safety.

Client-side aggregations that don't go through those RPCs also need the filter:

- `src/pages/FinanceDashboard.tsx`, `src/pages/FinanceThisWeek.tsx`, `src/pages/AdminDashboard.tsx`, `src/pages/dealership/DealershipReport.tsx` — when they read `locations` / `dealership_wash_batches` / `work_logs`, add `.eq('is_test', false)` on the locations join or filter joined rows out in memory.
- Any location/client picker used for real billing (Reports filters, rate cards, invoice exports) hides `is_test = true` rows. The employee dashboard location picker still shows them.

Net effect: any work logs, wash batches, invoices, CSV exports, and admin reports that touch a test location are dropped before totals are computed. Reviewer activity can never bill or appear in production reports.

## 3. Create the reviewer user

- Email: `appreview@washtracking.com`
- Initial password: `WashTest2026!` (set via the existing `create-user` edge function so the auth user, `public.users` row, and `user_roles` entry are all created consistently).
- Role: `employee` only.
- `must_change_password = false` so the reviewer isn't forced through the change-password flow.
- Insert one `user_locations` row linking the user to ONLY the test location. No other locations, ever.

Because the employee dashboard already scopes work-item pickers, wash requests, and history to the user's assigned locations, this alone confines the reviewer to the sandbox. They can log wash work, view their own history, and use the internal Messages page — all against the test location only.

## 4. Deliverable to you

After the migration and user creation run:

- Login email: `appreview@washtracking.com`
- Initial password: `WashTest2026!`
- The test location shows up in the employee dashboard as "ZZ TEST — App Review (do not bill)".
- No changes to existing users, real locations, RLS on real data, or billing logic for non-test rows.

## Technical notes

- The `is_test` columns are additive and default `false`, so every existing row is treated as real data — no behavior change for current users.
- Filtering happens at the query layer (RPCs + client reads) rather than via RLS, because finance/admin RLS already grants broad location access and we don't want to invalidate that model. RPCs are `SECURITY DEFINER`, so the added WHERE clause is authoritative.
- No changes to the mobile-side geofence: leaving `latitude`/`longitude` NULL matches the existing "skip geofence when coords missing" behavior you described.
- Reviewer's messages will still be visible to internal staff on the Messages page (expected — reviewers may need to test messaging), but they carry no billing implication.
