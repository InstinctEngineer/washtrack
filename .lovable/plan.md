

## Activity Logger for Debugging & Auditing

### Recommendation

Your instinct to keep this outside the main app flow is correct. The best approach for this type of system is:

1. **A lightweight client-side logger** that captures user actions (clicks, navigations, form submissions, data mutations) and batches them into a database table asynchronously — so it never blocks the UI.
2. **A dedicated `activity_logs` table** in the database with RLS restricted to `super_admin` only — no other role can read these logs.
3. **A Super Admin Activity Logs page** (accessible from the existing `/admin/database` area) to search, filter, and browse the logs.

This is the standard pattern used by production apps. Storing logs in `localStorage` or files is fragile and unsearchable. A database table with proper RLS is both secure and queryable.

### Privacy & Security

- Logs will record **action type, page, element context, and user ID** — never passwords or sensitive field values.
- Sensitive fields (pay_rate, SSN, DOB, etc.) will be redacted automatically before logging.
- Only `super_admin` can view the logs via RLS policy.
- Logs are inserted asynchronously (fire-and-forget) so they never slow down the UI.

### Database

**New table: `activity_logs`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | Who performed the action |
| action | text | e.g. `page_view`, `button_click`, `data_create`, `data_update`, `data_delete` |
| page | text | Current route path |
| target | text | Button label, form name, table name, etc. |
| metadata | jsonb | Additional context (record IDs, field names — sensitive values redacted) |
| created_at | timestamptz | When it happened |

RLS: Only `super_admin` can SELECT. INSERT open to all authenticated users (so the logger can write). No UPDATE/DELETE.

### Files

| File | Change |
|------|--------|
| `src/lib/activityLogger.ts` | **New** — Lightweight logger utility with batched async inserts, sensitive field redaction, and helper functions (`logPageView`, `logAction`, `logDataChange`) |
| `src/hooks/useActivityLogger.ts` | **New** — React hook that auto-logs page views on route changes and provides `logAction`/`logDataChange` helpers to components |
| `src/components/Layout.tsx` | Add `useActivityLogger()` hook call to capture page views for all authenticated users |
| `src/pages/ActivityLogs.tsx` | **New** — Super Admin page with searchable/filterable table of all activity logs (user filter, action type filter, date range, text search) |
| `src/pages/SuperAdminDatabase.tsx` | Add nav link to Activity Logs page |
| `src/App.tsx` | Add route for `/admin/activity-logs` with `super_admin` protection |

### How It Works

**Logger utility** (`activityLogger.ts`):
- Collects log entries in a memory buffer
- Flushes to database every 5 seconds or when buffer reaches 10 entries
- Uses `navigator.sendBeacon` on page unload to avoid losing logs
- Redacts known sensitive fields from metadata before storage

**Integration points** — the logger is called from:
- `Layout.tsx` — automatic page view logging on every route change
- Key mutation points (client create, location create, work log submit, user edit, etc.) — manually add `logDataChange()` calls to existing handlers

The initial implementation will auto-log page views. Data mutation logging can be incrementally added to specific forms/handlers as needed, keeping the initial change lightweight.

