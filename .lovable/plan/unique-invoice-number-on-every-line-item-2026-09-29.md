# Unique invoice number on every line item

## Goal
In the QuickBooks report download, every line item gets its own invoice number, counting up from the starting number (e.g. 1001, 1002, 1003...). No number is repeated.

## What changes
1. **Numbering** — the invoice number goes up by one on every line, not once per customer/location/week.
2. **Every row filled in** — since each line is now its own invoice in QuickBooks, Customer, Invoice Date, Due Date, Terms, Class and Email are filled on every row too. Otherwise QuickBooks would reject lines with no customer or date.
3. **Defaults and QuickBooks Template** — the "First row only" boxes start unticked for these fields.
4. **Saved templates** — existing saved templates (Default Template, ZDBQ, Mobile Wash, etc.) are updated so they behave the same way without reconfiguring.

Invoice date stays the Friday of the work week for each line. The "Next invoice number" starting value works as today.

## Technical details
- `FinanceDashboard.tsx` `generateCSVData`: keep grouping for ordering, but assign `invoiceNumber = currentInvoiceNumber++` per row; treat every row as a first row (ignore `firstRowOnly`). Default columns: `firstRowOnly: false`.
- `ExportColumnConfigurator.tsx`: `suggestFirstRowOnly` removed from fields; QB template all `firstRowOnly: false`.
- Data update on `report_templates`: set `firstRowOnly` false in every stored column config.
