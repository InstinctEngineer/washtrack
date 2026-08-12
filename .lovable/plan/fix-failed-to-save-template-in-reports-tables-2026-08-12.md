# Fix "Failed to save Template" in Reports & Tables

## What's wrong
The `report_templates` table has row-level security policies (finance and above can view/create, creators can edit/delete), but it was never granted API access. Without that grant, every read and write from the app is rejected before the policies are even evaluated — so saving a template errors out and the "Load template..." dropdown stays empty.

## The fix
One database change that grants the app's signed-in users access to the report templates table:

- Allow signed-in users to read, create, edit, and remove report templates (the existing rules still restrict this to finance-and-above, and to templates they created).
- Allow backend/admin processes full access.
- No anonymous access.

No table structure, policy, or UI changes are needed.

## Technical detail
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_templates TO authenticated;
GRANT ALL ON public.report_templates TO service_role;
```

## Verification
After the change: open Reports & Tables, save a template, reload the page, and confirm it appears in the template dropdown and loads the saved column config.
