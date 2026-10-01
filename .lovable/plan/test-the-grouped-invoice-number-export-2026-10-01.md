# Test the grouped invoice-number export

Verify the QuickBooks export now gives every line on the same invoice the same invoice number, with Terms and Class copied down.

## Steps

1. Sign in to the preview as an admin and open the Finance / invoice report page.
2. Run a weekly export over a date range known to have multiple work types at the same location in the same week (so one invoice has several lines).
3. Check the downloaded file:
   - Lines belonging to the same location + work week share one invoice number (e.g. the line under 1002 also says 1002; both lines under 1006 say 1006).
   - The next location/week gets the next number, counting up from the starting number with no gaps or repeats.
   - Terms and Class are filled on every line, matching the invoice's first line.
   - Customer, dates, and Email still follow the "First row only" boxes in Configure.
4. Repeat with a saved template (e.g. Default Template) to confirm templates behave the same way.
5. Report findings; fix anything that doesn't match.

## Technical details

- Verification is read-only: Playwright against localhost:8080, restoring a minted admin session, capturing the generated CSV and inspecting rows.
- Code under test: `generateCSVData` in `src/pages/FinanceDashboard.tsx` (invoice number assigned per location+week group; `ALWAYS_FILLED` set forces invoice_number/terms/class on every row).
- No code changes unless the test reveals a bug.
