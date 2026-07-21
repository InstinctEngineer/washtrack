## 1. Portal unread badge never clears

`usePortalUnreadCount` counts replies newer than `user_message_views.last_viewed_at`, but nothing calls `markAsRead` on the portal side.

- In `src/pages/portal/PortalMessages.tsx`, call `markAsRead()` from `usePortalUnreadCount` on mount (and after posting a reply) so opening Messages zeros the badge.

## 2. "Last Month" quick range on portal wash history

In `src/pages/portal/PortalLocationHistory.tsx`:
- Add a helper `monthRange(offset)` returning first/last day of the current or previous calendar month.
- Add two buttons next to "This Week / Last Week": **This Month** and **Last Month**, setting `start`/`end` accordingly.

## 3. Portal wash-request feature

### Data model (new migration)

New table `public.wash_requests`:
- `location_id` → locations, `work_item_id` → work_items, `portal_user_id` → client_portal_users
- `requested_for_week` date (Monday of the target week), `requested_at` timestamptz
- `fulfilled_at` timestamptz null, `fulfilled_work_log_id` uuid null
- Unique on (`work_item_id`, `requested_for_week`) so the same unit isn't double-starred
- GRANTs to authenticated + service_role
- RLS:
  - Portal users can SELECT/INSERT/DELETE rows for locations they have access to (via `portal_has_location`)
  - Employees can SELECT rows for locations in their `user_locations`
  - Finance+ can SELECT all
- Trigger `auto_fulfill_wash_requests` on `work_logs` AFTER INSERT: if a matching open request exists for that `work_item_id` where `requested_for_week <= work_date`, set `fulfilled_at = now()` and `fulfilled_work_log_id = NEW.id`.
- New RPC `get_portal_location_work_items(p_location_id)` (SECURITY DEFINER, checks `portal_has_location`) returning active work_items grouped by work type + identifier, plus an `is_requested` flag for the current week.

### Portal UI

New route `/portal/locations/:id/request-wash` (linked from the location card on `PortalDashboard` and from `PortalLocationHistory`):
- Lists the location's active vehicles/units grouped by work type
- Checkbox selection with a search box
- "Request wash for this week" button → inserts rows into `wash_requests` for the current Monday week, then creates one `employee_comments` thread scoped to the location with:
  - `comment_text` = "Portal wash request for week of {Mon date}:\n- {work_type}: {identifier}\n..."
  - `week_start_date` = current Monday
  - `location_id` set; `employee_id` = portal user's `auth_user_id`
- Toast confirmation, redirect back to the location page.

### Star indicator

- Requested units get a gold star (`Star` icon, `text-amber-500 fill-amber-500`) next to their identifier wherever they're listed for the current week.
- Employee Dashboard: in `WorkItemGrid` / the item picker, fetch open `wash_requests` for the employee's assigned locations for the current week and render the star. Sort requested items first.
- Star clears automatically via the trigger once a `work_log` is inserted for that `work_item_id`.

### Notifications

- The `employee_comments` insert produces a thread that already shows up in `/messages` (color-coded as portal) and, because `location_id` is set, on the employee dashboard messages section — no separate email path per the chosen option.

## Technical notes

- Reuses existing `portal_has_location`, `employee_comments`, `message_replies`, and `work_items` — no schema changes to those tables.
- All new RLS uses the existing `has_role_or_higher` and `portal_has_location` helpers to avoid recursion.
- Star lookup on the employee side is a single query per location for the active week; cached in a small hook `useWashRequestedItems(locationId)`.

## Files touched

- `supabase/migrations/<new>.sql` — `wash_requests` table, grants, RLS, trigger, RPC
- `src/pages/portal/PortalMessages.tsx` — call `markAsRead` on mount
- `src/pages/portal/PortalLocationHistory.tsx` — Last Month / This Month buttons + link to request page
- `src/pages/portal/PortalDashboard.tsx` — "Request washes" button per location
- `src/pages/portal/PortalRequestWash.tsx` — new page
- `src/App.tsx` — new route
- `src/hooks/useWashRequestedItems.ts` — new hook
- `src/components/WorkItemGrid.tsx` (+ dashboard item picker) — gold star rendering