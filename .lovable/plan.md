## Current behavior

There is not currently a report-template setting that lets a user choose how rows are aggregated. Templates save column configuration and invoice start number, but not a report output mode.

The export code already has weekly invoice bucketing and now collapses same item rows inside each weekly invoice. However, the preview table still displays the raw rows returned by the report query, which are grouped by work date. That is why users still see day-separated rows before export.

## Goal

Add a configurable report output mode so Finance users can choose between:

1. **Daily detail** — keep rows separated by work date/location/item for detailed review.
2. **Weekly totals** — aggregate quantities by invoice week + location + item, so ABM trucks entered as 8 Tuesday and 7 Wednesday become one weekly row showing 15.

This setting should be saved in report templates.

## Implementation plan

1. **Add report aggregation setting**
   - Extend the report template config with an `aggregationMode` value.
   - Default new and older templates to `weekly_item_totals` so QuickBooks exports do not split the same item into multiple day-based lines.
   - Keep support for `daily_detail` when a user wants the current date-by-date view.

2. **Add a small UI control in Report Settings**
   - Add a simple selector/toggle labeled for output detail, for example:
     - `Weekly item totals`
     - `Daily detail`
   - Place it near the existing report settings so users can set it before previewing/exporting.

3. **Use one shared aggregation function**
   - Create a helper in `FinanceDashboard.tsx` that transforms raw report rows based on the selected mode.
   - For weekly totals, group by:
     - Client
     - Location
     - Friday invoice week
     - Work type/item identity
     - Rate
     - Frequency
     - Rate type
   - Sum `total_quantity` and keep the first row’s client/location/rate/tax/accounting fields.
   - Remove the row-level `work_date` meaning for aggregated weekly rows.

4. **Update preview and export together**
   - Feed the transformed rows into the preview table.
   - Use the same transformed rows for CSV preview and CSV export.
   - This ensures what users see in the preview matches what goes into the downloaded file.

5. **Save/load with templates**
   - Include `aggregationMode` in `currentConfig` when saving a report template.
   - Load it back when a template is selected.
   - Existing templates without this value will still work and will fall back to weekly item totals.

## Result

Users will be able to choose and save whether a report exports daily detail or weekly item totals. For the ABM example, weekly mode will show one location/item row with quantity 15 instead of separate Tuesday/Wednesday rows.