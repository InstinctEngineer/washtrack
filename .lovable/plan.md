## Goal

When an admin creates a user, automatically email them a secure one-time link that lands on the existing `/change-password` screen. No auth setting changes, no impact on existing users or login flow.

## Approach

One new email-sending edge function, called by `create-user` after success and re-callable from a "Resend invite" button in the success dialog. Email failures never block account creation.

## What gets built

### 1. New edge function: `supabase/functions/send-welcome-email/index.ts`

Inputs (POST JSON): `{ email, name }`.

Logic:
- CORS + verify caller session has `finance`/`admin`/`super_admin` (same pattern as `create-user`).
- Use service-role client to call `supabaseAdmin.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo: `${APP_URL}/change-password` } })`. This produces a one-time link that signs the user in via the recovery flow and lands them on the existing change-password page (which already clears `must_change_password`).
- POST to `https://api.resend.com/emails` with `Authorization: Bearer ${RESEND_API_KEY}`:
  - `from`: `"WashTrack <noreply@mail.esd2.com>"`
  - `to`: user email
  - `subject`: `Welcome to WashTrack — set your password`
  - `html`: branded message with a CTA button linking to the generated `action_link`, plain-text fallback link, expiry note.
- Returns `{ success: true }` on send, `{ success: false, error }` (HTTP 200) on Resend/link failure so callers can show a soft warning.

Registered in `supabase/config.toml` with `verify_jwt = true` (admin-only).

### 2. Wire into `create-user` (non-blocking)

After the user/role/locations inserts succeed, fire the email send inline using the service-role client (no extra auth hop): same `generateLink` + Resend POST helper, wrapped in try/catch. Result returned to the client as `{ success, user, email_sent: boolean, email_error?: string }`. Any failure is logged and swallowed — the 200 response still goes out.

Refactor: extract the send logic into `supabase/functions/_shared/welcome-email.ts` so both `create-user` and `send-welcome-email` use the same code path.

### 3. UI: `src/components/CreateUserModal.tsx`

In the existing success dialog (which still shows the temp password for admin reference):
- Show a small status line: "Welcome email sent to {email}" (green check) or "Email failed to send" (amber) based on `email_sent` from the response.
- Add a **Resend invite** button next to it. On click, invoke the new `send-welcome-email` function with the created user's email/name; toast success/failure. Button shows a spinner while sending and is enabled regardless of initial status.

No changes to the form, validation, password generation, or the `must_change_password = true` behavior (already set server-side).

### 4. Nothing else changes

- No auth config tool calls, no migrations, no changes to `ChangePassword.tsx`, no changes to existing-user flows.
- `APP_URL` and `RESEND_API_KEY` secrets already in place.
- Domain `mail.esd2.com` reused as-is.

## Files

- Add: `supabase/functions/send-welcome-email/index.ts`
- Add: `supabase/functions/_shared/welcome-email.ts`
- Edit: `supabase/functions/create-user/index.ts` (call helper, return `email_sent`)
- Edit: `supabase/config.toml` (register new function)
- Edit: `src/components/CreateUserModal.tsx` (status line + Resend invite button)

## Recovery link → change-password behavior

The Supabase `recovery` link redirects to `/change-password?...` with a recovery session attached. Existing `ChangePassword.tsx` already calls `supabase.auth.updateUser({ password, data: { password_reset_required: false } })` and clears `must_change_password` in the users table, so the new user lands authenticated, sets a password, and the flag clears automatically.
