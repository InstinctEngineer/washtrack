# Mark payroll weeks as completed

## Today
Every week is created as "draft" and nothing in the app ever changes that. The lock button was removed earlier, so all 4 existing weeks sit at "draft" forever. Editing hours, notes and regenerating only works on drafts, so a "completed" state would naturally protect a finished week.

## What you'll get (Payroll > Run tab)
- A **Mark completed** button on the selected week, with a confirm step ("No further edits to hours, notes or regeneration. You can reopen it later.").
- Once completed: the week's status shows as **Completed** (with a green badge in the weeks list), run-line hours, OT and notes become read-only, and Generate / Import hours are disabled with a short "This week is completed" note.
- A **Reopen week** button (Finance and above) that puts it back to draft, so a mistake isn't a dead end.
- Exports (Future Systems xlsx, production report) keep working on completed weeks.
- The weeks list gets a status badge instead of plain text, and the completion is recorded in the activity log (who, which week, completed/reopened).

## Technical details
- `src/pages/payroll/PayrollDashboard.tsx`: add `completePeriod` / `reopenPeriod` updating `payroll_periods.status` to `'completed'` / `'draft'` (and `locked_at` / `locked_by` set or cleared); extend the existing `status !== 'draft'` guards to Generate and Import; call `logAction`.
- Existing columns `status`, `locked_at`, `locked_by` are reused; no schema change. Existing policy (Finance and above manage periods) already covers it.
- Add a small test for the rule: only draft weeks are editable.
