## Goal

Add a client-facing portal at `/portal/*` where external customers can sign in (email/password or Google), request access to specific locations, and — once approved by Finance+ — view a searchable, read-only history of work performed at those locations. Client accounts must be fully isolated from internal employee data and roles.

## Design Principles

- **Hard isolation:** Portal users never receive any internal `app_role`. All gating uses a new `client_portal_users` table, not `user_roles`.
- **Default deny:** A new portal account starts with zero location access. Nothing is visible until Finance+ approves a request.
- **Read-only:** Portal can only `SELECT` work history for assigned locations. No writes, no employee names, no rates, no client financials.
- **Single auth system, separated identity:** Reuse Supabase Auth (so Google works out of the box) but keep portal identities in their own table so the internal `users`/`user_roles` tables are untouched.

## User-Facing Flow

1. New visitor goes to `/portal/login`, signs up via email/password or Google.
2. After signup, they land on `/portal/request-access`: pick one or more locations (searchable list grouped by client) and submit a request with optional note.
3. Request appears in `/admin/portal-requests` (Finance+). Reviewer approves per-location or denies with a reason.
4. Once approved, portal user lands on `/portal/dashboard` showing their assigned locations.
5. Location detail page `/portal/locations/:id` shows a week-by-week history of vehicles/units washed: week picker, date-range search, filter by work type, per-day breakdown, and CSV export of their own data.

## 90-Day Inactivity Lockout

- `client_portal_users` gets `last_login_at timestamptz` and `is_active boolean default true`.
- On every successful portal sign-in, a `record-portal-login` edge function:
  1. Looks up the `client_portal_users` row by `auth_user_id`.
  2. If `is_active = false` OR (`last_login_at` is not null AND older than 90 days): immediately sign the user out (`supabase.auth.admin.signOut`) and return `{ status: 'disabled' }`. The login page then shows a blocking dialog:
     > "Your client portal account has been disabled due to 90 days of inactivity. Please call our office at [phone] to have your account re-enabled."
  3. Otherwise update `last_login_at = now()` and return `{ status: 'ok' }`.
- A scheduled job (pg_cron daily at 03:00) runs `disable_inactive_portal_users()`:
  - Sets `is_active = false` for any portal user where `last_login_at < now() - interval '90 days'` OR (`last_login_at is null AND created_at < now() - interval '90 days'`).
  - Writes a row to `activity_logs` summarizing how many were disabled.
- `/admin/portal-users` shows `Last login`, an `Inactive (auto-disabled)` badge, and a **Re-enable** button (Finance+) that flips `is_active = true` and clears the timer by setting `last_login_at = now()`. Action is logged.
- Office phone number lives in `system_settings` under key `portal_support_phone` so admins can edit it; the disabled dialog reads it at runtime.

## Internal Admin UI

- **`/admin/portal-users`** (Admin+): list portal users with last-login, active/disabled status, assigned locations, re-enable / revoke / deactivate actions.
- **`/admin/portal-requests`** (Finance+): pending / approved / denied tabs, approve or deny per location, leave a note.
- Layout sidebar gets a "Client Portal" section with both links for Finance+ / Admin+.

## Data Model (new tables, all in `public`)

- `client_portal_users` — `auth_user_id` (FK `auth.users`, unique), `email`, `display_name`, `company_name`, `is_active boolean default true`, `last_login_at timestamptz`, timestamps.
- `client_portal_location_access` — `portal_user_id`, `location_id`, `granted_by`, `granted_at`. Unique on (portal_user_id, location_id).
- `client_portal_access_requests` — `portal_user_id`, `location_id`, `status` (`pending`/`approved`/`denied`), `note`, `reviewed_by`, `reviewed_at`, `review_note`. Unique pending row per (user, location).

All three get full GRANTs + RLS:
- Portal user can `SELECT`/`INSERT` their own rows in `client_portal_access_requests` and `SELECT` their own `client_portal_location_access` and own `client_portal_users` row.
- Finance+ can `SELECT`/`UPDATE` all rows in requests and access tables; Admin+ can `INSERT`/`UPDATE`/`DELETE` portal users.
- `SECURITY DEFINER` helpers `is_portal_user(uid)` and `portal_has_location(uid, location_id)` to avoid RLS recursion. `portal_has_location` also enforces `is_active = true`.

## Read-Only History Access

- `SECURITY DEFINER` RPC `get_portal_work_history(p_location_id, p_start, p_end)` returns aggregated `work_date`, `work_type_name`, `quantity`, `identifier`, `notes`. Internally checks `portal_has_location(auth.uid(), p_location_id)` and raises on mismatch. No employee, no rate, no client financials returned.
- Dealership: `get_portal_dealership_history(...)` returning `work_date`, `vehicle_count` only.
- Portal pages call only these RPCs.

## Routing & Guards

- New `PortalProtectedRoute`: requires session AND an **active** row in `client_portal_users`. Sessions belonging to internal users (any `user_roles` row) get redirected to `/unauthorized`.
- `ProtectedRoute` / `RootRedirect` updated: portal users redirect to `/portal/dashboard`.
- New routes:
  - Public: `/portal/login`, `/portal/signup`, `/portal/forgot-password`
  - Portal-guarded: `/portal/request-access`, `/portal/dashboard`, `/portal/locations/:id`, `/portal/account`
  - Admin-guarded: `/admin/portal-requests`, `/admin/portal-users`

## Auth Details

- Email/password signup: `create-portal-user` edge function creates `auth.users` + `client_portal_users` row in one call, refusing emails that already exist in the internal `users` table.
- Google sign-in: `ensure-portal-user` edge function on first sign-in creates the `client_portal_users` row if none exists, then routes the user to `/portal/request-access`. Uses Lovable Cloud managed Google OAuth with `redirect_uri = window.location.origin`.
- After any successful portal sign-in (password or Google), the client calls `record-portal-login`, which performs the 90-day check above before allowing the session to proceed.
- Password reset reuses existing auth-email infrastructure.

## Files to Add / Change (high level)

New:
- `supabase/migrations/*_client_portal.sql` (tables, grants, RLS, helper functions, RPCs, `disable_inactive_portal_users` + pg_cron schedule, `portal_support_phone` setting)
- `supabase/functions/create-portal-user/index.ts`
- `supabase/functions/ensure-portal-user/index.ts`
- `supabase/functions/record-portal-login/index.ts`
- `supabase/functions/approve-portal-request/index.ts`
- `src/components/PortalProtectedRoute.tsx`
- `src/contexts/PortalAuthContext.tsx`
- `src/pages/portal/PortalLogin.tsx`, `PortalSignup.tsx`, `PortalRequestAccess.tsx`, `PortalDashboard.tsx`, `PortalLocationHistory.tsx`, `PortalAccount.tsx`
- `src/pages/admin/PortalRequests.tsx`, `PortalUsers.tsx`

Changed:
- `src/App.tsx` — register new routes
- `src/components/RootRedirect.tsx`, `src/lib/roleUtils.ts` — route portal users to `/portal/dashboard`
- `src/contexts/AuthContext.tsx` — when a session has no `user_roles`, surface a `portalUser` flag instead of loading internal profile
- `src/components/Layout.tsx` — add portal admin links for Finance+/Admin+

## Out of Scope

- No messaging between portal users and internal users in v1.
- No invoices/rates exposed to portal users.
- No multi-account-per-client merging; one portal user = one auth account.
