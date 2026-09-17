# Auto-fill payroll check date

## Goal
When a payroll week is created or opened, the check date fills in automatically as 5 days after the week ending date. It stays editable if a different date is needed.

## Behavior
- Creating a week (week ending Sunday) sets the check date to that Sunday + 5 days (Friday).
- Opening an existing week that has no check date saves the same default so the export and the week list show it.
- A check date already entered is never overwritten.

## Technical notes
- `src/pages/payroll/PayrollDashboard.tsx`:
  - Add a helper that returns `addDays(period_end, 5)` in `YYYY-MM-DD` form using the existing `addDays` / `asDateInput` utilities (no timezone drift).
  - In the period create/upsert call, include `check_date` with that default.
  - In `selectPeriod`, if the loaded period's `check_date` is null, update the row with the default and reflect it in local state.
  - Leave the existing check date input and its manual save path unchanged.
- No schema change; `payroll_periods.check_date` already exists and is nullable.
