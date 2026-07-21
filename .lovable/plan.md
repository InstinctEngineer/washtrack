## Problem

On the Client Portal, rotating a phone to landscape (~667–932px wide, short height) makes the top header contents collide: the right-side nav ("Locations", "Messages", "Request Access", "Report Issue", "Sign Out") crowds into the left-side branding ("WT" badge + "WashTrack for [ES&D logo]"), so buttons visually cover the logos. The sticky filter/search rows on pages like Location History and Request Wash then sit right under this broken bar, which is what the user perceives as "the search field covering the logos."

Root cause is in `src/components/PortalShell.tsx`:
- The wordmark elements ("WashTrack", "for", ES&D logo image) reveal at the `sm:` breakpoint (≥640px), which includes landscape phones.
- The right-side `<nav>` shows full text labels on every button starting at `sm:` too.
- The header uses `justify-between` with no `min-w-0` / `shrink` guards, so both sides fight for space and overlap instead of truncating.

Scope per user answer: **Client Portal only**, minimal fix — stop the overlap without redesigning the header.

## Changes (frontend / presentation only)

**File: `src/components/PortalShell.tsx`**

1. Bump the wordmark reveal from `sm:` to `lg:` so landscape phones only show the compact "WT" badge:
   - `WashTrack` text span: `hidden sm:inline` → `hidden lg:inline`
   - "for" span: `hidden sm:inline` → `hidden lg:inline`
   - ES&D logo `<img>`: `hidden sm:block` → `hidden lg:block`

2. Keep nav button text labels visible but let the header handle tight widths without overlap:
   - Add `min-w-0` and `shrink-0` where appropriate so the left branding link can shrink and the right nav stays intact.
   - Add `flex-wrap` fallback on the outer header row so if it still doesn't fit (very narrow devices), the nav wraps below the branding cleanly instead of overlapping. Adjust header height from fixed `h-16` to `min-h-16` to accommodate the wrap without clipping.

No other files change. No routing, data, RLS, or logic changes. Only Tailwind class edits inside `PortalShell.tsx`.

## Verification

- Preview `/portal/dashboard`, `/portal/locations/:id`, `/portal/messages`, `/portal/request-wash` in the mobile viewport rotated to landscape (~812×375) and confirm the "WT" badge is visible with no overlap on the nav buttons.
- Confirm at `lg:` (≥1024px, tablet landscape / desktop) the full "WashTrack for [ES&D logo]" wordmark still renders as before.
- Confirm portrait phone (~375×812) is unchanged — wordmark was already hidden there.
