## Goal
Stop the password reset page from showing “Auth session missing!” by ensuring every reset-link format establishes a session before the password update runs.

## What I verified
- `/change-password` is a public route and currently tries the newer `token_hash` flow.
- Reset emails are intended to link to `/change-password?token_hash=...&type=recovery`.
- There is still an older internal reset function that manually sets a password, but the reported toast happens on the `/change-password` page when `updateUser()` runs without a valid recovery session.
- Recent auth logs provided to me did not include a fresh recovery verification failure, so the exact failing link format is not confirmed from logs yet.

## Plan
1. **Make `/change-password` handle all valid reset-link formats**
   - Keep the `token_hash` + `verifyOtp()` flow.
   - Add support for the legacy hash-token flow (`#access_token=...&refresh_token=...&type=recovery`) using `setSession()`.
   - Detect explicit error hashes/search params from invalid or expired links and disable the form with a clear message.

2. **Block password submission until a trusted recovery session exists**
   - If the page was opened from an email link, require successful verification/session setup before enabling “Update Password”.
   - If no recovery token exists, allow the existing forced-password-change flow only when `getUser()` confirms the user is already signed in.
   - This prevents `updateUser()` from being called while signed out, which is what produces “Auth session missing!”.

3. **Move the profile flag update after the auth password update**
   - First call the auth password update.
   - Then clear `must_change_password` / reset metadata after the password is successfully changed.
   - This avoids partially clearing flags when the actual password update fails.

4. **Add diagnostic logging for one cycle**
   - Log only non-secret reset-link state: whether the page saw `token_hash`, hash tokens, an error hash, and whether verification succeeded.
   - Do not log tokens, passwords, or user secrets.
   - This gives us useful console signal if a specific email client or link format still fails.

5. **Redeploy affected reset-email functions after the code change**
   - Deploy the functions that generate/send setup and reset links so new emails definitely use the current helper.

## Verification
- Test `/change-password?token_hash=bad&type=recovery` shows an invalid-link state and cannot submit.
- Test a signed-out `/change-password` page cannot submit and shows a clear “request a reset link” state.
- Send a fresh reset/setup email, open it, confirm the form enables only after verification, update password, and confirm redirect to `/` without the auth-session toast.