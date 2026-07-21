## What I found

`employee@test.com` still exists in **both** `auth.users` and `public.users` (created Oct 2025, last successful login 2026-07-21 05:19:51). It was never actually deleted. So there are really two things to fix:

1. Clean up this specific lingering account so testing can continue.
2. Fix the in-app delete flow so a future "Delete" click can't leave a login-capable account behind.

### Why the in-app delete can silently leave auth alive
`supabase/functions/delete-user/index.ts` today does, in order:
1. Delete rows from ~8 dependent tables — errors are only `console.error`'d, execution continues.
2. Delete from `public.users` — on failure, returns an error to the UI and **never reaches auth deletion**.
3. Delete from `auth.users`.

If step 2 fails for any FK we didn't foresee (or any RLS/permission hiccup), the auth row survives and the user can keep logging in. The UI shows "Failed to delete user record", the admin retries, same failure, account keeps working.

## Plan

### 1. Force-clean the stuck account (via migration)
Delete `employee@test.com` from every dependent table, then `public.users`, then `auth.users`, in one migration so it's gone before we redeploy anything.

### 2. Rewrite `supabase/functions/delete-user/index.ts` — auth deletion first
- After the super-admin check, **delete the `auth.users` row first**. Once auth is gone the account can never authenticate again, no matter what happens next.
- Then run the public-schema cleanup (`user_roles`, `user_locations`, `message_reads`, `message_replies`, `user_message_views`, `error_report_replies`, `error_reports`, `activity_logs`, `employee_comments` both sides, `public.users`).
- Collect per-step errors into an `errors[]` array; return `{ success: true, errors }` when auth was deleted but some cleanup failed, and `{ success: false, error }` only when auth deletion itself failed.
- Log the caller's id and target id up top for auditability.

### 3. UI feedback in `src/components/UserTable.tsx`
- On response, treat `success: true` with a non-empty `errors[]` as a warning toast ("User login disabled — some cleanup failed, see logs"), not a green success.
- Only show the plain "User deleted" toast when `errors[]` is empty.
- Always call `onRefresh()` so the row disappears from the table.

### 4. Verify
- Delete a throwaway account through the UI.
- Query `auth.users` and `public.users` by that email — both must return zero rows.
- Attempt to log in with the old password — must be rejected with "Invalid credentials".

## Out of scope
Portal-user deletion (`delete-portal-user`) — same shape, same risk. Say the word if you want the identical hardening applied there in this pass.
