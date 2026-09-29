# Invoice number on every line item in report downloads

## Goal
When a report is downloaded for QuickBooks, every line item row shows its invoice number in the `*InvoiceNo` column, not just the first row of each invoice.

## Changes
1. **Default export settings** — the Invoice Number column is set to repeat on every row by default.
2. **QuickBooks Template button** — applying the template sets Invoice Number to every row.
3. **Field default** — adding the Invoice Number field manually no longer defaults to "First row only".
4. **Saved templates** — existing saved templates (e.g. Default Template, ZDBQ, Mobile Wash) are updated so Invoice Number repeats on every row, without anyone reconfiguring them.
5. **Safety net** — the download always fills the invoice number on every row, even if an older template still has "First row only" ticked for it.

Customer, Invoice Date, Due Date, Terms, Class and Email stay first-row-only as they are today.

## Technical details
- `ExportColumnConfigurator.tsx`: `invoice_number` → `suggestFirstRowOnly: false`; QB template `qb-1` → `firstRowOnly: false`.
- `FinanceDashboard.tsx`: default columns `invoice_number` → `firstRowOnly: false`; in the row builder, ignore `firstRowOnly` when `fieldKey === 'invoice_number'` (applies to CSV preview and xlsx export).
- Data update on `report_templates`: set `firstRowOnly` to false for the `invoice_number` entry in each template's stored column config (data update, not schema change).
