# Search and filter on every table

## Goal
Every list/table in the app gets a search box, plus filters where a natural one exists (status, role, client, location). Pages that already have search keep it, and get filters added only where missing.

## Shared building block
A small reusable toolbar: a "Search..." box, optional filter dropdowns, and a "Showing X of Y" count with a Clear button. Filtering happens instantly on screen, nothing in the data changes.

## Pages getting search added (none today)
- Admin Dashboard tables — search by name/location; filter by status
- Portal Users — search name/email/company; filter Approved / Pending / Denied
- Portal Requests — search requester/location; filter status
- Dealership Rates — search dealership/work type
- Dealership Report — search location/work type
- Dealership Requests — search location/requester; filter status
- Employee Dashboard history table — search location/work type
- Payroll Production Report preview — search employee name/code
- Rate Card — search client/location/work type; filter client
- Super Admin Database viewer — search across visible columns
- CSV preview pop-ups (report export, CSV import) — search across columns

## Pages that already search — add missing filters
- Clients — filter Active / Inactive
- Locations — filter by client and Active / Inactive
- Work Items, Work Types, Activity Logs, Finance This Week, Payroll pages, Pay Codes, Rate Sheet, Users, Portal History — review and add a status/client filter where one is missing

## Technical details
- New `src/components/TableToolbar.tsx` (search Input + filter Selects + count/clear) and `src/hooks/useTableFilter.ts` (memoized case-insensitive match across chosen fields, filter predicates, resets pagination).
- `DataTable.tsx`: accept `searchKeys: (keyof T)[]` (multi-field) alongside existing `searchKey`, plus optional `filters` prop.
- Frontend only; no database changes. Exports keep using their own full data unless already filtered on screen.
- Verify each page in the preview after changes.
