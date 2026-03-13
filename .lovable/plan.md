

## Plan: Fix Error Report for Non-Admin Users + Flag in Activity Logs

### Root Causes

**1. Non-admins can't find the super admin (CRITICAL)**
Line 90-94 queries `user_roles` for `role = 'super_admin'`, but the RLS policy only lets employees see their **own** roles. The query returns zero rows, so `superAdminId` is `null`, and the message is never inserted. The code silently skips the insert (no error toast).

**2. Storage upload may fail silently**
The upload error is caught but not reported to the user — the report still shows "submitted successfully" even if the screenshot didn't upload.

**3. `error_report` missing from Activity Logs UI**
It's not in `ACTION_GROUPS`, `ACTION_COLORS`, or `ACTION_LABELS`, so error reports blend in with other log entries and can't be filtered.

### Fixes

**A. Create a database function to get the super admin ID securely**
A `SECURITY DEFINER` function that returns the super admin user_id without exposing the `user_roles` table to unprivileged users. This is the same pattern used for `has_role()` and `is_super_admin()`.

```sql
CREATE OR REPLACE FUNCTION public.get_super_admin_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM public.user_roles 
  WHERE role = 'super_admin' LIMIT 1;
$$;
```

**B. Update ErrorReportButton.tsx**
- Replace the direct `user_roles` query with an RPC call to `get_super_admin_id()`
- Add proper error handling — if message insert fails, show an error toast instead of silently succeeding
- Log upload failures in metadata

**C. Add `error_report` to Activity Logs UI**
- Add to `ACTION_GROUPS` under a new "Reports" group
- Give it a bold red color in `ACTION_COLORS` so it stands out immediately
- Add label "Error Report" in `ACTION_LABELS`
- Highlight the entire row in the table when the action is `error_report`

### Files Modified
- New migration SQL — `get_super_admin_id()` function
- `src/components/ErrorReportButton.tsx` — use RPC, better error handling
- `src/pages/ActivityLogs.tsx` — add error_report styling and filter group

