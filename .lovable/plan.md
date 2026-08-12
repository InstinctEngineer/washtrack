# Fix: Saving report templates fails

## Confirmed root cause

I reproduced the failure against the live database while signed in as an admin. The insert is rejected with:

`23514 — new row for relation "report_templates" violates check constraint "report_templates_report_type_check"`

The table only allows these `report_type` values:
`wash_entries`, `client_billing`, `employee_performance`, `revenue_analysis`

The QuickBooks export template manager saves with `report_type = 'quickbooks_export'`, which is not in that list. Grants and access rules are fine (the earlier grant fix was not the actual problem).

## Fix

1. Database migration: replace the `report_type` check constraint so it also allows `quickbooks_export`.
2. Re-run the same insert test in the browser as an admin to confirm the save succeeds, then delete the diagnostic row.
3. Also verify loading and deleting a saved template still work.

## Notes

- No UI changes needed; the app's value stays `quickbooks_export`.
- I will not report this as fixed until the test insert actually returns without error.
