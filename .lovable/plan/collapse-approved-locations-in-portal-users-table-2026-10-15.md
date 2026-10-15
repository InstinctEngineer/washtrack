# Collapse Approved Locations in Portal Users table

Frontend-only change in `src/pages/admin/PortalUsers.tsx`.

- Add a small `ApprovedLocationsCell` (local expanded state per row), like the Users table.
- Collapsed by default: shows the first location name plus a "+N more" link.
- Click expands in place to the full list (wrapped, max width ~260px); becomes "Show less".
- Users with no locations still show "None"; one location shows no toggle.
- No data, backend, or other page changes. Search/filter unchanged.
