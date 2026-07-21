## Goal
Let portal users cancel their own pending wash requests from the Designate Weekly Washes screen.

## UX
- A starred/"Requested" tile becomes clickable again. Clicking it opens a small confirm ("Remove this wash request?") and, on confirm, un-requests the unit.
- Constraints: only pending requests (`fulfilled_at IS NULL`) can be cancelled, only for the current week, and only by the portal user who owns them.
- Tile immediately returns to the normal unselected state; toast confirms removal.
- No changes to the employee dashboard star behavior — a cancelled request just disappears from their view.

## Backend
- Add RLS policy on `wash_requests` allowing `DELETE` where `portal_user_id` matches the caller's portal user id AND `fulfilled_at IS NULL`.
- Post a short follow-up message in the location's message thread noting which units were un-requested (mirrors the existing request notification), so office staff sees the change.

## Frontend (`src/pages/portal/PortalRequestWash.tsx`)
- Replace the `disabled` behavior on already-requested tiles with an `onClick` that opens an AlertDialog to confirm cancellation.
- On confirm: `delete from wash_requests where work_item_id=? and requested_for_week=? and portal_user_id=?`, then reload and insert the notification message.
- Keep the gold star + "Requested" badge styling; add a subtle "click to cancel" hint on hover.

## Out of scope
- Internal-staff cancel controls (option 2 from the earlier choice).
- Cancelling requests for past weeks or already-fulfilled requests.
