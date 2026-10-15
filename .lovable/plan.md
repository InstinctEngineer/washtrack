# Collapsible sidebar sections (burger menu)

## What the user wants
Each section header in the burger/side menu ("Dashboards", "Administration", "Client Portal", "Admin Only", "Super Admin", "Payroll") should be collapsed by default, and clicking a header expands that section's links.

## Current state (verified)
- The side menu lives in `src/components/Layout.tsx` only. Nav items are grouped by `section` (`groupedNavItems`) and every section renders as a static `<h3>` label with all its links always visible (lines ~288–333). Nothing about sections is collapsible today.
- The client portal shell (`PortalShell.tsx`) has no sections, so it is untouched.

## Change (frontend only, one file)
In `src/components/Layout.tsx`:

1. Track expanded sections in local state: `expandedSections` as a `Set<string>` (section names), toggled by clicking a header.
2. Render each section header as a clickable button row:
   - Section name (same styling as today).
   - A chevron icon (ChevronDown/ChevronRight from lucide) that rotates with state.
   - Full-width click target with `aria-expanded`, so it is keyboard-accessible.
3. Links under a section render only when that section is expanded.
4. Default: all sections collapsed **except** the section containing the currently active page — the user must always see where they are. Implement by initializing the expanded set with the active section, and on navigation (when `location.pathname` changes) auto-expand the section containing the new active item (add it to the set; do not collapse others).
5. Clicking a header toggles its section (expand/collapse), independent of navigation auto-expansion.
6. Keep existing behavior otherwise: active link highlighting, badge counts (messages/tickets/portal requests) still show on links when their section is expanded, mobile overlay close-on-click unchanged, "Install App" button untouched.

## Verification
- `npx tsgo --noEmit` passes.
- Playwright check against localhost:8080 as an admin user: open the burger menu, confirm sections are collapsed by default except the active one, click a header to expand/collapse, navigate to a page and confirm its section expands.
