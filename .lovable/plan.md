## Problem

New portal account signups currently surface on `/admin/portal-users` (the "Pending Approvals" card I added earlier). The user expects them on `/admin/portal-requests`, which today only lists per-location access requests (`client_portal_access_requests`) — so the page looks empty when a user signs up.

## Plan

Restructure `/admin/portal-requests` into two stacked sections so every signup and every follow-up access request lives in one place.

### 1. Account Approvals (new top section)

Pull the pending-account workflow out of `PortalUsers.tsx` and render it here instead.

- Query `client_portal_users` for all rows (pending, approved, denied) and show three tabs: Pending / Approved / Denied.
- Pending tab columns: Name, Email, Work Location (from onboarding), Signed Up, Actions. Include accounts that haven't finished onboarding yet, with an "onboarding incomplete" badge.
- Approve button opens a dialog that lists every location (grouped by client) with checkboxes; on confirm it inserts `client_portal_location_access` rows for each pick, then calls the existing `set-portal-approval` edge function with `action: 'approve'`. At least one location must be selected.
- Deny button opens a dialog with an optional reason textarea; on confirm it calls `set-portal-approval` with `action: 'deny'` and the note. The function already disables the account, clears location access, signs the user out, and stores the note in `denial_note`.
- Denied tab shows the saved denial note inline; Approved tab shows the granted locations and a Re-enable/Disable toggle plus Delete.

### 2. Location Access Requests (existing section, kept below)

Keep the current `client_portal_access_requests` tabs (Pending / Approved / Denied) underneath so per-location requests submitted by already-approved users still flow through `approve-portal-request` unchanged.

### 3. Clean up `/admin/portal-users`

Remove the duplicate "Pending Approvals" card and per-row Approve/Deny/Delete buttons. That page becomes a read-only roster of portal accounts (name, email, work location, granted locations, last login, status) so there's exactly one place to act on signups.

### 4. Button theming

Use the existing shadcn `Button` variants throughout the new dialogs and tables — `default` for primary actions (Approve, Save), `destructive` for Deny/Delete, `outline` for Cancel/Disable, `secondary`/`ghost` only where the rest of the admin pages already use them. No hardcoded color classes (`bg-*`, `text-white`, etc.); rely on the semantic tokens already defined in `index.css` and used by other admin pages like `PortalUsers.tsx` and `Users.tsx` so the new UI matches the app's theme in both light and dark mode.

## Technical notes

- Files touched:
  - `src/pages/admin/PortalRequests.tsx` — add Account Approvals section + dialogs, keep existing access-request table.
  - `src/pages/admin/PortalUsers.tsx` — strip out the approval/deny/delete UI and dialogs; keep the roster table.
- No new edge functions or migrations. Reuses `set-portal-approval`, `delete-portal-user`, `approve-portal-request`, and the existing `denial_note` column on `client_portal_users`.
- No RLS change expected: `client_portal_users` and `locations` already read fine for finance+ on the Users page; we'll confirm during build that the same queries return data here. If a `SELECT` policy is missing on `client_portal_users` for finance, add one in a follow-up migration.
