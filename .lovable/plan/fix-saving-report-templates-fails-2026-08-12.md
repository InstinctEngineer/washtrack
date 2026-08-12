# Fix: Saving report templates fails

## Confirmed root cause

I reproduced the failure against the live database while signed in as an admin. The insert is rejected with:

`23514 — new row for relation "report_templates" violates check constraint "report_templates_report_type_check"`

## What `report_type` actually is

`report_type` is not the template's name. It is an internal category tag that says which screen a template belongs to, so the Reports & Tables export screen only lists templates built for it. The name you type in the dialog is stored separately in `template_name`, and you can still create as many differently named templates as you want.

The category list was locked down to four old values (`wash_entries`, `client_billing`, `employee_performance`, `revenue_analysis`) before the QuickBooks export screen existed. That screen tags its templates `quickbooks_export`, which the old list forbids, so every save fails.

## Fix

1. Database migration: drop the outdated hard-coded category check constraint on `report_templates.report_type`, so current and future report screens can register their own category without another migration. Keep the column required and non-empty.
2. Re-run the save as an admin in the browser and confirm it succeeds (no error returned), then remove the diagnostic row.
3. Verify the saved template appears in the "Load template" list, loads its column config correctly, and can be deleted.

## Notes

- No UI changes: template names stay fully user-defined.
- I will not report this as fixed until a real save actually returns without error and the template shows up in the list.
