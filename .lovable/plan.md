# Fix: Moving Vehicles missing from the payroll sheet

## What's wrong (confirmed in the data)
- Moving Vehicles work is logged under the work type **Move Vehicle** (hourly), mapped to E59. Since Aug 1 there are 26 entries, 288 hours total. Invoicing picks them all up.
- **Cause 1:** Payroll only finds a log's work type through its *work item* (vehicle/unit). Move Vehicle entries, like Cars Washed, are logged straight to a rate with no work item. Payroll can't find their work type, so it skips them without saying anything. Invoicing checks both links, which is why the two don't match.
- **Cause 2:** Trevin Engesser's E59 line is set to **Hourly**. Hourly lines take their hours only from the uploaded timecard, never from the logged work. Even with Cause 1 fixed, his line would show 0 unless the timecard has his hours. Sam Prather's E59 line ("GRI ISP Moves", Unit) would fill correctly once Cause 1 is fixed.

## Fix
1. When Generate Run reads logged work, it will use the work item's rate if there is one and the log's own rate if not. That's the same rule invoicing uses, so every entry invoicing counts, payroll counts too.
2. For hourly lines whose E code is mapped to a work type that washers log in hours (like Move Vehicle): use the logged hours for that code. Use the timecard hours only when the line's code has no logged work. That keeps logged moving hours from being counted twice.
3. Check the Washer Production report's data source for the same work-item-only gap and fix it the same way if it has one.
4. Add a small test: a log with no work item still counts toward its mapped code.

## Verify
- Regenerate the most recent week. The E59 lines should match the Move Vehicle totals invoicing shows for that week.

## Technical details
- `PayrollDashboard.tsx` `generateRun`: select `rate_config_id, direct_rc:rate_configs(work_type_id), work_item:work_items(rate_config:rate_configs(work_type_id))` and resolve `work_item?.rate_config?.work_type_id ?? direct_rc?.work_type_id`. Move the totaling into a pure helper in `src/lib/` with a bun test.
- Hourly quantity: `unitTotals` for the line's code if it is > 0, otherwise the imported hours.
- Look at `get_payroll_production_data` / `get_payroll_rate_sheet` and change the join to `COALESCE(wi.rate_config_id, wl.rate_config_id)` if needed.
