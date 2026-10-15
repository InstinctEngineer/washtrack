# Auto-collapse the payroll weeks list when a week is open

## What changes

On the Payroll Worksheet (Weekly Run tab), the list of weeks under "Pay period" currently always shows every week. Once you open a week, that list is just clutter above the lines you're editing.

New behavior:

- **No week open yet** — the list shows every week exactly as it does today, so you can pick one.
- **A week is open** — the list collapses to a single line for the week you're working on (dates, check date, status) with a **Show all weeks (N)** button beside it.
- Clicking **Show all weeks** expands the full list again so you can jump to another week; **Collapse** closes it back down.
- Opening a different week collapses the list again automatically.
- This is view state only — nothing is saved, and refreshing returns to the full list until you open a week.

The week you're working on stays visible while collapsed, so you always know which week the lines below belong to.

## Technical details

Frontend only, in `src/pages/payroll/PayrollDashboard.tsx`:

- Add `const [weeksListOpen, setWeeksListOpen] = useState(true)` (component memory, same style as the existing `endLocked` week-ending lock).
- `selectPeriod` and `createPeriod` both set the open week — each will call `setWeeksListOpen(false)` when they succeed, so selecting or creating a week collapses the list.
- The weeks table (currently a single always-rendered `<Table>` of `periods`) becomes conditional on `weeksListOpen || !period`:
  - Expanded: today's full table, unchanged, plus a small **Collapse** button in the header area.
  - Collapsed: one compact row for the open week — `period_start – period_end`, check date, status badge — plus a **Show all weeks (N)** ghost button.
- No backend, database, or other page changes. The payroll lines table below is untouched.

## Verification

- `npx tsgo --noEmit` passes.
- Live check in the preview as a payroll user: open a week, confirm the list collapses to one line with the open week's dates and status, click **Show all weeks**, pick another week, confirm it collapses again to that week.
