## Problem
The report currently shows one row per **work date** per item. Fed Ex SFM has PUD logged on two different days (31 + 31) and Rentals on two days (4 + 5), producing 4 line items. QuickBooks should receive **one line per item per invoice week** — so 62 PUDs and 9 Rentals as 2 lines.

## Root cause
`get_report_data` groups by `work_date`, and `generateCSVData` in `src/pages/FinanceDashboard.tsx` keeps every returned row. The invoice bucketing only assigns them all to the same Friday but never collapses same-item rows.

## Fix
In `src/pages/FinanceDashboard.tsx` `generateCSVData`, after grouping rows into invoice buckets (client + location + Friday), merge rows within each bucket by item identity and sum quantities.

**Merge key** per invoice bucket:
`work_type_id | rate | frequency | rate_type`

**Aggregation:**
- `total_quantity` = SUM across merged rows
- All other fields (client info, location, work type, rate, frequency, terms, class, email, tax) are identical within the merge key, so keep the first row's values
- Drop `work_date` from the merged row (it's no longer meaningful once aggregated across the week)

The preview table and CSV export both flow through `generateCSVData`, so both update in one place. No RPC or schema change needed.

## Expected result for the screenshot's date range
Fed Ex SFM becomes 2 lines:
- Fed Ex PUD – 2x/week — Qty 62 — $905.20
- Rental – 2x/week — Qty 9 — $131.40

Other clients/locations aggregate the same way.

## Out of scope
- Aspirational features (zero-quantity rows, per-user templates) mentioned earlier.
- No changes to the RPC — aggregation stays client-side so we don't disturb other consumers.
