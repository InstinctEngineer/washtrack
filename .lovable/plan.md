# Editing pay rates in Payroll

Today office staff can only add a pay line. Nothing in the list can be changed, ended, or turned off, so a raise leaves two active lines for the same person and code — and the new production report may pick the wrong one.

## What office staff will be able to do

In Payroll > Pay Lines, each row gets an Edit button and a Deactivate button.

**Edit** opens the row's details: code, department, task/location label, employee number, type, and rate.

- Changing anything other than the rate updates the line in place.
- Changing the rate asks for an "effective from" date (defaults to the Monday of the current week). The old line is ended the day before, and a new line starts on that date with the new rate. Past weeks keep calculating with the rate that was in force then.
- A short history under each employee shows previous rates with their date ranges.

**Deactivate** stops the line appearing in future weeks and in the production report, without removing past pay. A deactivated line can be reactivated.

Anyone who can open Payroll today (finance and above) can do this. Every change is recorded so it is clear who changed a rate and when.

## Keeping the reports honest

The Washer Production report and weekly run already pick the pay line that was active for the week being viewed. Once ending dates are set properly, an old week will show the old rate and the current week the new one, instead of whichever duplicate line happened to be found first.

## Technical details

- No schema change needed: `payroll_employee_lines` already has `rate`, `effective_date`, `end_date`, `is_active`.
- Rate change = `UPDATE` old row `end_date = effective_from - 1 day`, then `INSERT` a new row copying all fields with the new rate and `effective_date = effective_from`. Guard against `effective_from <= old.effective_date` (in that case overwrite the existing row instead of splitting it).
- Non-rate edits = plain `UPDATE` on the row.
- Deactivate = `UPDATE is_active = false` plus `end_date` = the Sunday of the current week if not already set. Reactivate clears `end_date` and sets `is_active = true`.
- RLS: add `UPDATE` and `INSERT` policies on `payroll_employee_lines` for `has_role_or_higher(auth.uid(), 'finance')`, matching the existing read policy, with the matching `GRANT`s.
- Load in `PayrollDashboard.tsx` currently filters `.eq('is_active', true)`; add an "Show inactive" toggle so deactivated lines can be found and reactivated.
- Add an `EditPayLineDialog` component under `src/pages/payroll/`, `max-h-[90vh] overflow-y-auto`.
- Audit: insert into `activity_logs` on rate change (action `payroll_rate_change`, metadata with old/new rate and effective date).
- `PayrollProductionReport.tsx` rate lookup stays as-is — it already filters by `effective_date <= weekEnd` and `end_date >= weekStart`.
