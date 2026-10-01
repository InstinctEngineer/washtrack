# Remove Parent Company from the Invoice Export

## What changes

The Item(Product/Service) column currently uses the client's **parent company** as its prefix when one is set (e.g. `ParentCompany PUD 1 X / Wk`). You want the export to use the **client's own name** instead, never the parent company.

Change in `src/pages/FinanceDashboard.tsx` only:

- `buildQBItemName` currently builds the prefix as `parentCompany || clientName`. Change it to always use `clientName`.
- Resulting Item names (unchanged rules otherwise):
  - Per-unit work: `ClientName WorkType Frequency` (e.g. `ES&D PUD 1 X / Wk`)
  - Janitorial (hourly): `ClientName-Jani`
  - Other hourly: `ClientName-Addi`
  - `EPA Charges`: still stands alone, no prefix
- The `client_parent_company` value stays in the data fetch — it just stops being used in any output column. No other column (Customer, Class, etc.) uses parent company today, and no aggregation/merge key involves it, so nothing else in the export changes.

## Verification

- Run the TypeScript check.
- Live test: sign in, open Data Export & Reports, preview this week's CSV, and confirm Item names show the client's own name with no parent-company prefix.
