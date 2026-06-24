## Goal

1. Fix the failing Google sign-in (Supabase signups are currently disabled, blocking the `id_token` grant — that's why you see "failed to sign in with vendor").
2. Let clients self-create portal accounts (Google or email/password) through a short **onboarding wizard** that collects **first name**, **last name**, and **work location** (free-text).
3. New accounts land in a **pending** state. They can sign in but only see a "Pending Approval" screen.
4. Internal staff see the wizard answers in `/admin/portal-users`, approve the account, and then manually assign locations. Approved users can use the portal normally.

## Onboarding wizard (`/portal/onboarding`)

A 3-step wizard shown the first time a portal user authenticates and has no `client_portal_users` row yet (or has one with `onboarding_completed = false`):

1. **Your name** — `first_name` and `last_name` (both required, trimmed, max 100 chars, zod-validated).
2. **Where do you work?** — `work_location` free-text (required, max 200 chars). Helper text: "Company name and/or address — we'll use this to match you to the right locations."
3. **Review & submit** — shows what they entered, submits, then routes to `/portal/pending`.

Flow:

- Google sign-in → `/portal/auth/callback` → if no portal row OR `onboarding_completed = false` → `/portal/onboarding`. Otherwise existing routing (pending / dashboard / request-access).
- Email/password signup → `/portal/signup` collects email + password only, then routes to `/portal/onboarding` after the auth session is set. The current signup form's name/company fields move into the wizard so Google and email users go through the **same** wizard.

## Database (one migration)

Add to `public.client_portal_users`:

- `first_name text`
- `last_name text`
- `work_location text` (the free-text answer from the wizard)
- `onboarding_completed boolean NOT NULL DEFAULT false`
- `approval_status text NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','denied'))`
- `approved_by uuid REFERENCES auth.users(id)`
- `approved_at timestamptz`

Backfill: existing rows → `onboarding_completed = true`, `approval_status = 'approved'` (so today's admin-created user keeps working).

Helpers/policies:

- Update `public.is_portal_user(uuid)` to require `is_active AND approval_status = 'approved'` — this automatically blocks pending users from history RPCs and location-access RLS.
- New `public.is_portal_approved(uuid)` security-definer helper.
- Tighten "Portal users create own requests" RLS on `client_portal_access_requests` to require `is_portal_approved(auth.uid())` so pending users cannot insert access requests.
- New RPC `get_portal_account_status()` returning `{ approval_status, is_active, onboarding_completed, disabled_reason }` for the frontend gate (single round-trip).

## Edge functions

- **`ensure-portal-user`** (Google callback): if no row exists, create one with `onboarding_completed = false`, `approval_status = 'pending'`, no name/work_location yet (wizard fills those). Employee-email collision still returns `employee_conflict` and signs out.
- **`create-portal-user`** (email/password): create the auth user + an empty `client_portal_users` row (pending, onboarding not completed). Drop the `display_name` / `company_name` body params — the wizard collects that next.
- **New `submit-portal-onboarding`** (verify_jwt = true): body `{ first_name, last_name, work_location }`. Server-side zod validation, updates the caller's `client_portal_users` row, sets `onboarding_completed = true`. Idempotent — re-submitting overwrites and stays pending.
- **New `set-portal-approval`** (verify_jwt = true, finance+ only): body `{ portal_user_id, action: 'approve' | 'deny', note? }`. Sets `approval_status`, `approved_by`, `approved_at`; deny also sets `is_active = false`, `disabled_reason = 'denied'`.
- **`record-portal-login`**: also return `approval_status` and `onboarding_completed` so the login pages route correctly.

## Frontend

- Run `supabase--configure_auth` with `disable_signup: false` (keep `auto_confirm_email: false`, `external_anonymous_users_enabled: false`). This unblocks Google.
- **New `src/pages/portal/PortalOnboarding.tsx`** — 3-step wizard above, zod-validated, calls `submit-portal-onboarding`, routes to `/portal/pending` on success.
- **New `src/pages/portal/PortalPending.tsx`** — "Your account is pending approval. We'll review your details and enable your access shortly." Includes a Sign Out button.
- **`PortalProtectedRoute`** — read `{ approval_status, onboarding_completed }` from `AuthContext`. Order of checks: `!onboarding_completed` → `/portal/onboarding`; `pending` → `/portal/pending`; `denied` or `!is_active` → sign out + disabled dialog; `approved` → existing behavior.
- **`PortalLogin`, `PortalSignup`, `PortalAuthCallback`** — route based on the new status fields after `record-portal-login`. Strip the name/company inputs out of `PortalSignup` (now handled by the wizard).
- **`AuthContext`** — include `approval_status` and `onboarding_completed` in the portal-user fetch.
- **`src/pages/admin/PortalUsers.tsx`**:
  - Add columns for **First name**, **Last name**, **Work location**, and **Approval status**.
  - Add a "Pending Approvals" section at the top with each user's wizard answers + **Approve** / **Deny** buttons that call `set-portal-approval`.
  - Keep the existing enable/disable controls (for the 90-day inactivity lockout) separate from approval.
  - The existing per-location request approval UI in `/admin/portal-requests` is unchanged — admins can still grant locations there after they approve the account, exactly as today.

## Out of scope

- No email notification when approved/denied (can add via Resend later).
- No domain restriction on Google sign-in.
- Internal `/login` and the dealership/employee flows are unchanged.

## Testing

After implementation, run a Playwright check against the live preview: sign in with Google as a new email → land on `/portal/onboarding` → fill the 3 steps → land on `/portal/pending`. As admin, open `/admin/portal-users`, see the new wizard answers, click Approve. Sign in again as the portal user and confirm `/portal/request-access` is reachable.