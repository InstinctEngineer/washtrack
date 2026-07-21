No code changes needed — the dropdown already exists.

## Where to find it

1. Open the left sidebar and click **Reports & Tables** (under Dashboards). This is `/finance/dashboard`.
2. On that page, in the **Report Settings** card, look for the **Report Output** dropdown just below the date range picker.
3. Options: **Weekly item totals** (default) and **Daily detail**.

## Why you may have missed it

The sidebar item is labeled **"Reports & Tables"**, not "Finance Dashboard" or "Data Export & Reports". The page title once you're inside is "Data Export & Reports".

## If it's still not visible after navigating there

Possible causes to check next (I'd verify in build mode):
- A stale bundle — hard refresh (Cmd/Ctrl+Shift+R).
- The `Report Settings` card is collapsed above the fold — scroll just below the date range inputs.
- A template was loaded that hides part of the settings UI — click **New Template** or reset.

Want me to switch to build mode and either rename the sidebar link to "Data Export & Reports" for clarity, or verify the dropdown renders live via a browser check?