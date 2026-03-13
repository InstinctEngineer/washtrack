

## Plan: Refactor Error Reports to Dedicated Table

### Verified Pre-conditions
- `is_super_admin()` function already exists in Postgres.
- `error-reports` storage bucket exists, with INSERT policy allowing all authenticated users. Upload will continue to work.
- Reporter names come from the `users` table (has `name` column), not `auth.users`. No issue there.

### Changes

#### 1. Database Migration
Create `error_reports` table with RLS:

```sql
CREATE TABLE public.error_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description text NOT NULL,
  screenshot_url text,
  page_url text,
  user_agent text,
  viewport text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.error_reports ENABLE ROW LEVEL SECURITY;

-- INSERT: any authenticated user, own rows only
CREATE POLICY "Users can insert own reports"
  ON public.error_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reported_by);

-- SELECT: users see own, super admins see all
CREATE POLICY "Users can read own reports"
  ON public.error_reports FOR SELECT TO authenticated
  USING (auth.uid() = reported_by);

CREATE POLICY "Super admins can read all reports"
  ON public.error_reports FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()));

-- UPDATE: super admins only (status toggle)
CREATE POLICY "Super admins can update reports"
  ON public.error_reports FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid()));
```

#### 2. Refactor `ErrorReportButton.tsx`
- Remove all messaging logic: no `user_roles` query, no `employee_comments` insert, no `get_super_admin_id` RPC.
- After screenshot upload, insert directly into `error_reports` with `reported_by = userProfile.id`, `description`, `screenshot_url` (storage path), `page_url`, `user_agent`, `viewport`.
- Keep `logAction('error_report', ...)` for activity logs.
- Add error handling: if insert fails, show error toast instead of success.

#### 3. Add Error Reports Section to `AdminDashboard.tsx`
- New section below existing cards: "Error Reports" with an alert icon.
- Query `error_reports` joined with `users` table on `reported_by = users.id` for reporter name.
- Display a table: reporter name, description (truncated), page URL, timestamp, screenshot preview via `ErrorScreenshotViewer`, and a status badge/toggle (open/resolved).
- Show open report count in the stats row as a fifth card.

#### 4. Add `error_report` to Activity Logs
- Add to `ACTION_GROUPS`: `{ label: '── Reports', actions: ['error_report'] }`
- Add to `ACTION_COLORS`: bold red (`bg-red-500 text-white`)
- Add to `ACTION_LABELS`: `'Error Report'`

#### 5. Clean Up Messages Page
- Remove `ErrorScreenshotViewer` and `extractScreenshotPath` import (line 25).
- Remove the screenshot viewer rendering block (lines 771-779).

### Files Modified
- New migration SQL
- `src/components/ErrorReportButton.tsx`
- `src/pages/AdminDashboard.tsx`
- `src/pages/ActivityLogs.tsx`
- `src/pages/Messages.tsx`

