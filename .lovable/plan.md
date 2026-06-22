## Goal
Make Error Report rows on the Admin Dashboard clickable to open a full-details modal.

## Changes

**`src/pages/AdminDashboard.tsx`**
- Add `selectedReport` state (`ErrorReport | null`) and a `Dialog` from `@/components/ui/dialog`.
- Make each `TableRow` in the Error Reports table clickable (`cursor-pointer hover:bg-muted/40`) — `onClick` sets `selectedReport`.
- Prevent row-click triggering when the user interacts with the status `Switch` or the screenshot viewer (wrap those cells' inner controls with `onClick={(e) => e.stopPropagation()}`).
- Render a details `Dialog` (`max-h-[90vh] overflow-y-auto`) showing:
  - Reporter name + status badge
  - Full description (not truncated)
  - Page URL, viewport, user agent, submitted time
  - Screenshot via `ErrorScreenshotViewer` (inline variant) when present
  - A "Mark resolved / Reopen" button that calls the existing `toggleReportStatus` and updates the open dialog's report state

## Notes
- No DB or RLS changes. No new components. Existing `toggleReportStatus` and `ErrorScreenshotViewer` are reused.
- Keeps the MyErrorReports collapsible on Messages unchanged.