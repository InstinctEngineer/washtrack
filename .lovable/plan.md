# Pay Lines that build themselves, with editable rates

Today Pay Lines is an empty list that office staff have to fill in by hand, one row per employee and work type. That is backwards — the app already knows who worked and what they washed.

## What changes

The Pay Lines tab becomes a rate sheet that fills itself in.

**It lists every employee and work type combination that actually has work recorded**, pulled from the same wash records used for invoicing. Pick a time range (defaults to the last 90 days, with "This year" and "All time" options) and every washer shows up with each vehicle/work type they have done.

Each row shows:

- Washer name and employee number
- The work type, and the Future Systems code it maps to
- The current pay rate, or "Not set" in red
- When that rate took effect

**Finance and above can edit the rate right on the row.** Type a new rate, pick the date it starts from (defaults to the Monday of the current week), save. The old rate is ended the day before and the new one starts on that date, so past weeks still calculate with the rate that was in force then. A small history under each rate shows previous rates and their date ranges.

**Other details can still be edited** — department, task/location label, employee number, type — through an Edit button on the row.

**Deactivate** hides a combination that is no longer worked, without touching past pay. A "Show inactive" toggle brings them back.

Rows with no rate set are counted in a banner at the top ("12 pay rates still need setting") so nothing gets missed before a payroll run.

Manually added pay lines (salary, travel, anything with no wash records behind it) stay supported — the "Add Pay Line" button remains, and those rows appear in the same list marked as manual.

## Technical details

- New security-definer RPC `get_payroll_rate_sheet(p_start_date date, p_end_date date)`: distinct `employee_id, employee_name, provider_employee_number (users.employee_id), work_type_id, work_type_name` from `work_logs -> work_items -> rate_configs -> work_types -> locations -> clients`, excluding test data — same joins as `get_payroll_production_data`. Grant execute to `authenticated`.
- Client-side join in a new `PayrollRateSheet` component (replacing the Pay Lines tab body): rate-sheet rows left-joined to `payroll_work_type_map` (global, `location_id is null`) for the pay code, then to `payroll_employee_lines` for the active rate (`is_active`, `effective_date <= today`, `end_date` null or `>= today`), matched on `employee_id + pay_code_id`.
- Saving a rate where no pay line exists: `INSERT` into `payroll_employee_lines` with `employee_id`, `pay_code_id` from the mapping, `department` from the pay code, `task_label` = work type name, `display_name` = "Last, First", `provider_employee_number` from `users.employee_id`, `pay_type` from `payroll_pay_codes.default_pay_type`, `effective_date` = chosen date, `sort_order` 0.
- Saving a rate where one exists: `UPDATE` old row `end_date = effective_from - 1 day`, then `INSERT` the new row with the new rate. If `effective_from <= old.effective_date`, overwrite the existing row instead of splitting.
- Deactivate: `UPDATE is_active = false`, set `end_date` to the Sunday of the current week if null. Reactivate reverses it.
- Work types with no entry in `payroll_work_type_map` show "No code mapped" and link to the Work Type Codes tab — a rate cannot be saved until a code exists.
- RLS: add `INSERT` and `UPDATE` policies on `payroll_employee_lines` for `has_role_or_higher(auth.uid(), 'finance')`, plus the matching `GRANT`s.
- Log rate changes to `activity_logs` (action `payroll_rate_change`, metadata with old/new rate, work type, effective date).
- `PayrollProductionReport.tsx` needs no change — its lookup already filters on `effective_date`/`end_date`, and it becomes accurate once end dates are set properly.
