# Show reporter names for client portal error reports

## Cause (confirmed)
Error reports look up the reporter only in the employee list. Reports sent by client portal users (for example tzamora7@esd2.com) have no employee record, so they show "Unknown". Employee reports already show names correctly.

## Fix
- Admin Dashboard error reports: when no employee matches, look the reporter up among portal users and show their name (first + last, or display name, or email), followed by "(Client Portal)".
- Use the same lookup for reply authors in the report thread, so portal users' replies stop showing "Unknown".
- The error report email sent to nwarder@esd.com gets the same fallback, so the email stops saying "Unknown user".
- Search and sorting by Reporter work on the new names.

## Technical details
- `src/pages/AdminDashboard.tsx`: after the `users` query, query `client_portal_users` (`auth_user_id, first_name, last_name, display_name, email`) for ids still missing; same fallback in the replies loader.
- `supabase/functions/send-error-report-email/index.ts`: fall back to `client_portal_users` via the admin client; redeploy.
- No database changes. Check in the preview that the portal report shows a name.
