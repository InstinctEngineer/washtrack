# Fix the 4 open error reports (revised)

## 1. Portal account creation errors (Ben Maus report)

**What's happening:** bmaus01@yahoo.com already exists as an internal employee (Ben Maus, Employee ID CONTRACTOR, inactive). Portal creation correctly refuses it, but the screen only shows "Edge Function returned a non-2xx status code".

**Fix — two audiences, two messages:**
- **External visitors (public portal sign-up):** a safe, generic message that reveals nothing about how the system works: "We couldn't create an account with this email. Please contact our office."
- **Internal staff (signed in with an employee role, Manager and above):** a plain-text explanation, e.g. "This email already belongs to an internal employee account (Ben Maus, Employee ID CONTRACTOR, inactive). One email can't be both an employee and a portal user. Change or remove the employee account's email in User Management first, then try again."
- The server decides which message to send based on who is signed in — the detailed text never reaches an external visitor.
- Other failure cases (portal account already exists, weak password, unexpected error) follow the same rule: generic for visitors, specific for staff.

**No automatic correction.** Ben Maus's employee record is left untouched. The staff member who attempted the creation must fix the employee record themselves, so they see why the conflict happened.

## 2. Deery Brothers Ford shows 0 washes in the client portal

**Confirmed:** 97 washes on 10/5 and 92 on 10/12 are recorded in the wash records, but the portal's dealership view reads an old, empty table.

**Fix:** the dealership history view reads the same wash records used for invoicing (daily vehicle totals per date), with the same location access check. The client will see the 97 and 92 washes and all earlier history.

## 3. Payroll "Week ending" lock

- Add a lock icon next to "Week ending" on the Weekly Run and Washer Production screens.
- **Locked (default):** week ending is automatically Monday + 6 days, read-only — today's behavior.
- **Click the lock to unlock:** week ending becomes an editable date (cannot be before the start date) for a one-time report.
- **Always resets:** the unlocked state is never saved. Refreshing the page, leaving and coming back, or reopening the tab returns it to the week lock.
- Changing the week starting date while unlocked keeps the custom end date only if it is still after the start; otherwise it snaps back to the full week.

## 4. Check date "non functional"

- The check date box does nothing until a week is created or opened. Disable it with the hint "Create or open a week first" until a week is selected, and show a confirmation when a change is saved (or an error if it fails).

## 5. Close out the reports

- Post a reply on each report explaining the fix, and mark all 4 resolved after verifying in the preview.

## Technical details

- `create-portal-user`: read optional bearer token; if it resolves to a user with `has_role_or_higher(uid, 'manager')`, return `{ error, detail }` with the employee name / ID / status; otherwise return only the generic message. Same status codes (409 etc.).
- `PortalSignup.tsx` (and any staff caller): on `FunctionsHttpError`, read `await err.context.json()` and display `error`; never display the raw library message.
- Migration: `CREATE OR REPLACE FUNCTION get_portal_dealership_history` → `SUM(wl.quantity)` from `work_logs` joined via `COALESCE(wi.rate_config_id, wl.rate_config_id)` to `rate_configs` where `rc.location_id = p_location_id`, grouped by `work_date`; keep `portal_has_location` check and return type.
- `PayrollDashboard.tsx` / `PayrollProductionReport.tsx`: `const [endLocked, setEndLocked] = useState(true)` + custom end state, component memory only (no localStorage/DB). Lock/Unlock icons from lucide.
- Add a small test for the end-date rule (locked = start + 6; unlocked custom end must be ≥ start).
