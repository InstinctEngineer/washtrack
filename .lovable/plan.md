# Shared invoice number per invoice in the QuickBooks export

## Goal
Lines that belong to the same invoice (same customer location, same work week) share one invoice number. Example: both lines under 1006 say 1006; the second line under 1002 says 1002. The next invoice gets the next number.

## What changes
1. **Numbering** — go back to one number per invoice (customer + location + Friday of the work week), counting up per invoice, not per line.
2. **Repeated on every line** — InvoiceNo, Terms and Class are always filled on every line of an invoice, copied from that invoice's first line.
3. **Other columns** — Customer, Invoice Date, Due Date, Email etc. follow the "First row only" setting in Configure, as before.
4. Starting "Invoice #" box works as today.

## Technical details
- `FinanceDashboard.tsx` `generateCSVData`: compute `invoiceNumber` once per group (`currentInvoiceNumber++` outside `groupRows.forEach`); pass `isFirstRow = index === 0`; for each column, blank the value when `col.firstRowOnly && !isFirstRow`, except `invoice_number`, `terms`, `class` which are always output. Terms/Class taken from the group's first row.
- `ExportColumnConfigurator.tsx`: no "First row only" effect shown as forced for those three fields (checkbox ignored/disabled for them).
- No database changes.
