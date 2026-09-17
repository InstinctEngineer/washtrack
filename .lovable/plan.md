# Make every E code list read the live E Codes table

## What's actually happening

Nothing in the app has a hardcoded list of E codes — every dropdown already reads the same `payroll_pay_codes` table the E Codes sheet writes to. The problem is timing: each payroll area loads its copy of the code list once, when the page first opens. Adding a code on the E Codes tab saves it to the table, but the Work Type Codes dropdown, the Add Pay Line dropdown and the Pay Rates sheet keep showing the copy they loaded earlier, so the new code looks missing until the whole page is reloaded.

There is also a second, older "Pay Code" quick-add button on the Pay Rates tab that creates codes without a description — a duplicate of the new E Codes page, and another way for the two views to drift apart.

## What changes

1. **One shared, live list of E codes.** All payroll screens draw from a single shared source instead of their own copies. Saving, editing, retiring or restoring a code on the E Codes tab immediately updates every dropdown and table on the page — no reload, no tab switching.

2. **Retire the duplicate add-code form.** The "Pay Code" button on the Pay Rates tab goes away; the E Codes tab becomes the only place codes are created or changed. The Pay Rates description points there.

3. **Retired codes stay readable.** Dropdowns offer only active codes for new assignments, but a work type or pay line already pointing at a retired code still shows that code's name rather than going blank, with a "Retired" note so it can be reassigned deliberately.

4. **Consistent labels everywhere.** Every E code dropdown shows the same text — `E25 · FedEx · PUD` (code, department, description) — so the E Codes sheet and the dropdowns visibly match.

## Technical notes

- Add `src/hooks/usePayCodes.ts`: a small shared store (module-level cache plus subscriber set) exposing `payCodes`, `activePayCodes`, `payCodeById`, `refreshPayCodes()`. It queries `payroll_pay_codes` (all rows, `order('code')`) once and notifies every subscribed component on refresh.
- `PayrollPayCodes.tsx` uses the hook for its list and calls `refreshPayCodes()` after insert, update and active-toggle instead of its local `load()`.
- `PayrollDashboard.tsx` drops `payCodes` from `loadSetup` and its `addPayCode`/`newPayCode`/`showPayCodeForm` state and form markup; the Work Type Codes and Add Pay Line selects read `activePayCodes` from the hook, with the assigned-but-retired code appended as an option when relevant.
- `PayrollRateSheet.tsx` and `PayrollProductionReport.tsx` drop their own `payroll_pay_codes` queries and read `payCodeById` from the hook, so code and department shown against rates always match the E Codes sheet.
- No database change: `payroll_pay_codes` is already the single source, with Finance+ policies covering select, insert and update.
