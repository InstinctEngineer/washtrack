## Root cause (unconfirmed but strongly indicated)

The recovery email uses `supabase.auth.admin.generateLink({ type: 'recovery' })`, which returns an `action_link` pointing at Supabase's `GET /auth/v1/verify?token=…&type=recovery&redirect_to=…`. That endpoint consumes the one-time token on any GET, then redirects to `/change-password` with tokens in the URL hash so the client can set a session.

Two very common failure modes for this flow — both consistent with the "Auth session missing!" toast when the user clicks Update:

1. **Email scanners / link previewers prefetch the URL** (Outlook Safe Links, corporate proxies, Gmail image proxy on some clients). The GET consumes the single-use token before the human clicks. When the human then clicks, Supabase returns an error hash (`#error=…`) instead of tokens, no session is set, and `updateUser` fails with "Auth session missing!".
2. The user opens the link in a different browser/device than the one that requested it, or the tab that receives the hash never runs `detectSessionInUrl` on `/change-password` before they submit.

The fix that solves both is switching the recovery link from the legacy verify-redirect flow to the **OTP `token_hash` verify flow**, which is the pattern Supabase now recommends specifically because it is not consumed by GET-only email scanners.

## Plan

### 1. Change the recovery email link format (`supabase/functions/_shared/welcome-email.ts`)
- After calling `admin.generateLink({ type: 'recovery', email, options: { redirectTo } })`, read `data.properties.hashed_token` (Supabase returns this alongside `action_link`).
- Build our own action URL: `${appUrl}/change-password?token_hash=<hashed_token>&type=recovery`.
- Send that URL in the email instead of `action_link`.
- Keep the existing "welcome" vs "reset" copy/subject behavior unchanged.

Why: `token_hash` is only consumed when the page POSTs it via `verifyOtp`, so passive email scanners that fetch links do not burn the token.

### 2. Establish the session on the page (`src/pages/ChangePassword.tsx`)
- On mount, read `token_hash` and `type` from `window.location.search`.
- If present, call `supabase.auth.verifyOtp({ token_hash, type: 'recovery' })` and show a "Verifying reset link…" state while it runs.
  - On error: show a clear toast ("Reset link is invalid or expired — request a new one") and disable the form.
  - On success: strip `token_hash` from the URL (`history.replaceState`) and enable the form. The session is now set, so the existing `updateUser({ password })` call will succeed.
- If there is no `token_hash` in the URL, fall back to the current behavior (user is already signed in and being forced to rotate their password via `must_change_password`).

### 3. No other changes
- Do not touch `AuthContext`, routing, RLS, `create-user`, or the portal password reset paths beyond the shared helper — `send-portal-password-reset` already goes through `_shared/welcome-email.ts`, so it inherits the fix automatically.
- Leave the `redirectTo` value pointed at `/change-password` so `generateLink` still validates the redirect against the project's allow-list.

## Verification
- Trigger "Resend Email" for a test internal user and for a portal user; confirm the email link is now of the form `https://washtracking.com/change-password?token_hash=…&type=recovery`.
- Click the link, set a new password, and confirm redirect to `/` with no "Auth session missing!" toast.
- Click a link a second time and confirm the page shows an "invalid or expired" message instead of a silent failure.
