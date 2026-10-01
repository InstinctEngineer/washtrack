# Collapse locations in User Management

## Problem
On the Users (User Management) page, the Location column renders every assigned location as a badge in a wrapping row. Users assigned to many locations (managers, multi-site staff) push the table extremely wide, and the page is set to `min-w-max` (never shrink), so you must scroll horizontally to reach the end of the page.

## Change — `src/components/UserTable.tsx` (Location column cell only)

1. **Collapsed by default**: each user's Location cell shows only their primary location badge (or first location if none marked primary) plus a small "+N more" toggle button when the user has additional locations.
2. **Expand on click**: clicking "+N more" expands that row's cell in place to show all location badges; it becomes "Show less" to collapse again. Each row tracks its own expanded state (local component state; nothing saved to the database).
3. **Bounded width**: give the Location cell a max width (e.g. `max-w-[220px]`) so even an expanded list wraps inside a fixed column instead of stretching the table.
4. **Sorting unchanged**: the Location sort still uses the first/primary location name, same as today.

No data, backend, or other pages change. The full location list remains visible in Edit User for anyone who needs it.

## Verification
- `npx tsgo --noEmit` type check passes.
- Playwright check of /users: a multi-location user's row shows one badge + "+N more", table fits on screen without horizontal scrolling, expand/collapse works.
