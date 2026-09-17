# Payroll Production Report (washer output by week)

## Goal
A weekly payroll report showing, for each washer: the facility, the vehicle/work type, how many they washed, and their pay for it. The numbers come from the exact same work records that feed the invoicing reports, so an invoice and a payroll report can never disagree.

## What it shows on screen
One line per washer, per location, per vehicle type, for the chosen week:

```text
Washer            Location        Vehicle / Work Type        Qty    Rate     Pay
Alex Richards     ATW             Cars Washed                 42    1.75    73.50
Alex Richards     ATW             W900 Trucks                  8    6.00    48.00
Alex Richards     Republic        Cars Washed                 11    1.75    19.25
                                                Washer total            140.75
```

- Week picker defaults to the payroll week already selected (Monday–Sunday), with quick "This week" / "Last week" buttons.
- Optional filters for a single washer or a single location.
- Subtotal per washer and a grand total for the week.

## Output file format
The downloaded file is the ES&D Payroll Worksheet, identical to the Payroll xlsx example — same title block, Pay Period and Check Date lines, header row, columns (Notes, Code, Department, task, Name, Employee Number, Rate, Hrs or Units, E02 OT Hours, Type, Total Gross Pay), fonts, currency/accounting formats and total row. It is produced by the existing workbook builder, not a new format:

- Each screen line becomes one worksheet row: Code = the E code the vehicle type maps to, Department and task label from that pay code, Name = washer, Rate = the washer's per-unit rate, Hrs or Units = the count washed, Type = per-unit.
- Rows are ordered by washer, then by code, matching the example file's grouping.
- No CSV variant — the xlsx is the deliverable.

## Keeping it identical to invoicing
The report reads the same work records, joined the same way and filtered the same way as the invoicing report: the same wash logs, the same rate setup linking them to a facility and vehicle type, and the same exclusion of test accounts and test facilities. The only difference is that payroll groups by washer while invoicing groups by customer. Totalling every washer's counts for a week gives the same counts the invoice report shows for that week.

## Pay column
- Per-vehicle pay comes from the washer's saved payroll pay lines (their per-unit rate for the pay code the vehicle type maps to).
- If a washer has no saved rate for that vehicle type, the row shows "No rate set" instead of a made-up number, and it is listed in a short warning above the table so it can be fixed before exporting.
- Hourly work is not priced here; hourly hours stay on the existing hours import.

## Technical notes
- New security-definer RPC `get_payroll_production_data(p_start_date, p_end_date, p_employee_ids text[] default null, p_location_ids text[] default null)`:
  - Body copies `get_report_data`'s FROM/WHERE (`work_logs` → `work_items` → `rate_configs` → `work_types` → `locations` → `clients`, `l.is_test = false AND c.is_test = false`, date BETWEEN), joins `users` on `wl.employee_id`, adds employee to SELECT/GROUP BY, drops client/rate columns.
  - Returns `employee_id, employee_name, provider_employee_number, location_id, location_name, work_type_id, work_type_name, total_quantity`.
  - `GRANT EXECUTE ... TO authenticated`; Finance+ gate in the page as with other payroll screens.
- New `production` tab in `src/pages/payroll/PayrollDashboard.tsx` (same pattern as `codes`), with a `PayrollProductionReport` component under `src/pages/payroll/` for filters, table, totals, and the download button.
- Export reuses `buildPayrollWorkbook` / `downloadPayrollWorkbook` from `src/lib/payrollExport.ts` unchanged, mapping each report row into a `PayrollExportLine` (`pay_type: 'per unit'`, `ot_hours: 0`).
- Pay lookup client-side: `payroll_work_type_map` (global, `location_id is null`) maps work type → pay code; `payroll_employee_lines` active for the week (`effective_date <= period_end`, `end_date` null or `>= period_start`) gives the per-unit rate for that employee + pay code.
- No changes to invoicing code or to `get_report_data`.
