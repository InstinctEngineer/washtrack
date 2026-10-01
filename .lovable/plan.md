# Remove the Client Name Prefix from Item(Product/Service)

## What changes

In the invoice export, the Item(Product/Service) name will no longer start with the client name. It becomes just the work type plus frequency:

- Per-unit work: `WorkType Frequency` — e.g. `Fed Ex Contract Vehicles 1 X / MO`, `Fed Ex PUD 1 X / Wk`
- Hourly work: the work type name alone — e.g. `Janitorial`, `Skid Loader` (the `-Jani` / `-Addi` suffixes only existed to tag the client name, which is gone)
- `EPA Charges`: unchanged, still stands alone
- All other frequency formatting rules stay: `1 X / Wk`, `2 X /Wk` vs `2 X / Wk` spacing, pluralizing 2x work types that end in a letter, `1 X / MO`

The client name still appears in the *Customer column — only the Item name loses the prefix. Nothing else in the export changes: shared invoice numbers, Terms, Class, aggregation, and filtering all stay as they are.

## Technical details

- Single change in `src/pages/FinanceDashboard.tsx`: `buildQBItemName` drops the `clientName` parameter and the prefix logic; per-unit returns `` `${workType} ${freqSuffix}` ``, hourly returns the work type name.
- The `client_name` value remains in the report data for the Customer column and invoice grouping.

## Verification

- Run the TypeScript check.
- Live test: preview this week's CSV and confirm Item names read like `Fed Ex Contract Vehicles 1 X / MO` with no client name in front, and the Customer column still shows the client.
