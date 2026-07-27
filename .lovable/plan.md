## What I verified
- **Anthony Gigliardi** appears to be **Anthony Gagliardi**: `agagliardi@esd2.com`, employee ID `2602000`.
- **Lincoln Grim** appears to be **Lincoln Grimm**: `Lgrimm2442@gmail.com`, employee ID `2605013`.
- **Jalin Tolonder** appears to be **Jalen Tolander**: `jalentolander09@gmail.com`, employee ID `2605004`.
- **Johnny Manning** exists: `ManningJohn4247@gmail.com`, employee ID `2607004`.
- **Austin Goodrich** exists: `austingoodrich27@gmail.com`, employee ID `2605012`.
- The checked accounts are active and have backend email-login records, so this does not look like deleted app profiles.

## Plan

### 1. Restore the old manual reset option in User Management
- Add a **Set temporary password** action in the Users table.
- Open a confirmation dialog where an admin can either:
  - use an auto-generated temporary password, or
  - type a temporary password manually.
- After reset, show the temporary password once so the admin can copy it and share it with the employee.

### 2. Update the backend reset function to support forced password change
- Keep backend-only password setting; no reset email required.
- Require admin-level permissions for normal users.
- Keep the existing protection that only a super admin can reset a super admin.
- After setting the temporary password, mark the account as requiring a password change on next login in both auth metadata and the app user record.

### 3. Make the next-login change-password flow work for manual resets
- When users log in with the temporary password, redirect them to `/change-password`.
- Allow `/change-password` to work for signed-in forced-password-change users without requiring an email recovery token.
- After they choose their own password, clear the forced-reset flags.

### 4. Keep email reset available but secondary during troubleshooting
- Keep the existing email reset button available.
- Label the manual option clearly so admins know it bypasses the broken email-link path.
- This gives immediate access recovery while we continue diagnosing why email reset links are failing.

### 5. After implementation, reset the listed users
- Once the manual reset path is restored, use it for the five matched users above.
- Use one temporary password pattern or generated per-user passwords, depending on what is safest in the UI flow.
- Make sure each account is forced to change password on next login.

### 6. Continue diagnosis without blocking access
- Add non-secret logging around manual resets and forced-password-change completion.
- Do not log temporary passwords.
- Use backend auth logs after the next failed email reset to distinguish expired links, email scanner interference, stale live code, or account-specific auth rejection.

## Verification
- Admin can set a temporary password for one test user.
- That user can sign in with the temporary password.
- The app forces them to change it immediately.
- After changing it, they land back on the correct dashboard and can log in with the new password.
- The five affected users are reset and marked for next-login password change.

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
</presentation-actions>

<presentation-actions>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>