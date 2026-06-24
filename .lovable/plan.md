## Goal

Add Google sign-in to the client portal alongside the existing email/password flow, while preserving full isolation from internal employees and the 90-day inactivity lockout.

## Approach

Use Lovable Cloud managed Google OAuth via the `@lovable.dev/cloud-auth-js` helper (`lovable.auth.signInWithOAuth("google", ...)`). This auto-provisions the `src/integrations/lovable/` module and installs the package — no manual Supabase OAuth setup needed.

Internal `/login` stays email/password-only. Google is portal-only.

## Flow

1. User clicks **Continue with Google** on `/portal/login` or `/portal/signup`.
2. `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/portal/auth/callback" })` runs.
3. Browser redirects to Google, then back to `/portal/auth/callback`.
4. The new `PortalAuthCallback` page waits for `supabase.auth.getSession()`, then calls a new edge function `ensure-portal-user`:
   - If the email already belongs to an internal employee → sign the user out, redirect to `/portal/login` with an error toast ("This email is registered as an employee — use the internal sign-in").
   - If a `client_portal_users` row already exists → continue.
   - Otherwise → insert a new `client_portal_users` row using the Google profile name/email, then continue.
5. Calls existing `record-portal-login` to run the active/90-day check and stamp `last_login_at`. If `disabled`, show the disabled dialog with the support phone (same UX as password login).
6. Redirect:
   - If portal user has no `client_portal_location_access` rows yet → `/portal/request-access`.
   - Otherwise → `/portal/dashboard`.

## Changes

### New
- `supabase/functions/ensure-portal-user/index.ts` — auth-required; reads caller from JWT, checks for internal-employee collision, upserts `client_portal_users` row from `auth.users.user_metadata` (name) + `email`.
- `src/pages/portal/PortalAuthCallback.tsx` — handles the post-OAuth handshake described above, shows a spinner and the disabled-account dialog on lockout.
- `supabase/config.toml` entry: `[functions.ensure-portal-user] verify_jwt = true`.

### Updated
- `src/pages/portal/PortalLogin.tsx` and `PortalSignup.tsx` — add a **Continue with Google** button above the email/password form (divider with "or"), wired to `lovable.auth.signInWithOAuth`. On `result.error` show inline error; on `result.redirected` just return.
- `src/App.tsx` — register `/portal/auth/callback` as a public route rendering `PortalAuthCallback`.

### Tool calls during build
- `supabase--configure_social_auth` with `providers: ["google"]` to enable Lovable-managed Google OAuth and scaffold `src/integrations/lovable/`.

## Out of Scope

- Internal `/login` does NOT get Google — employees stay on email/password.
- No domain restriction (`hd`) on the Google call — clients sign in with any Google account.
- No automatic location grants from Google — new portal users still go through the same Finance+ approval workflow.
- 90-day lockout, support-phone dialog, and admin re-enable behavior are unchanged.
