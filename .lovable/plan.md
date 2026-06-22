## Payroll Section — Implementation Plan

A separate **Payroll** experience that lives alongside the current Invoicing/Work Entry app. Same database, same employees, but a clearly different mode with its own theme, navigation, and tools. Visible only to Finance, Admin, and Super Admin.

---

### 1. Mode switching & theming

- **Header switcher**: Two pills in the top bar — "ES&D Invoicing" and "ES&D Payroll". Visible only to Finance+. Clicking one navigates to that side and persists the choice (`localStorage`).
- **Routing**: All payroll pages live under `/payroll/*`. A route guard requires `has_role_or_higher(auth.uid(), 'finance')`.
- **Theme**: Add a `data-mode="payroll"` attribute to `<html>` when on payroll routes. In `index.css`, override the semantic tokens under `[data-mode="payroll"]` with the green palette (`#15803D` primary, `#0F1F17` background-deep, `#22C55E` accent, `#86EFAC` highlight). Every shadcn component re-themes automatically — no per-component edits.
- **Branding**: Logo text/word swaps to "ES&D Payroll" in payroll mode. Sidebar/nav items are completely different from invoicing.

### 2. Pages (under `/payroll`)

1. **Dashboard** — current open period summary, totals by department, employees with missing pay, recent runs.
2. **Pay Periods** — list, create, lock, mark paid. Default week is Mon–Sun matching the invoicing work week; pay date is configurable (sample shows check date a few days after period end).
3. **Period Detail / Worksheet** — the operational page. Mirrors the uploaded spreadsheet layout: one row per employee × pay code × department × task line, with Rate, Hrs/Units, OT Hours, Type, Total Gross. Editable inline. "Recompute from work logs" button.
4. **Employee Pay Rules** — manage each employee's pay lines (one employee can have 10+). Reused as the seed when creating each new period.
5. **Pay Codes** — admin CRUD for the `E01/E11/E12/E23/E25/E26/E28/E45/E53/E58/E59/E68/E99` codes seen in the sheet.
6. **Departments** — admin CRUD for `FedEx / Lawn / Snow / Mobile Wash / Office` (decoupled from invoicing locations).
7. **Export** — download CSV for a locked period (column layout matching the uploaded sheet so it can be handed to your payroll provider as-is). Provider-specific templates can be added later.

### 3. Data model (new tables, all in `public`)

- `payroll_pay_codes` — `code` (E25, etc.), `description`, `is_active`.
- `payroll_departments` — `name`, `is_active`.
- `payroll_pay_rules` — per employee pay line template:
  - `employee_id`, `pay_code_id`, `department_id`, `task_label` (free text like "MLI PUD", "ABR W700-900"), `rate_type` (`hourly | unit | salary`), `rate numeric`, `default_quantity numeric null`, `effective_date`, `end_date null`, `is_active`, `notes`.
- `payroll_periods` — `start_date`, `end_date`, `check_date`, `status` (`open | locked | paid`), `locked_at`, `locked_by`, `paid_at`.
- `payroll_period_lines` — the actual editable worksheet rows:
  - `period_id`, `employee_id`, `pay_code_id`, `department_id`, `task_label`, `rate_type`, `rate`, `quantity`, `ot_hours`, `gross_pay` (generated `rate * quantity + ot_hours * rate` or stored, TBD), `source` (`rule_seed | work_logs | manual`), `source_rule_id null`, `notes`, `delete_before_submit boolean` (matches the "Delete Before Submitting" note in the sheet).
- All tables: `GRANT SELECT, INSERT, UPDATE, DELETE … TO authenticated; GRANT ALL … TO service_role;` RLS on, policies using `has_role_or_higher(auth.uid(), 'finance')`. Locked periods become read-only via policy `USING (status = 'open')` on UPDATE/DELETE.

### 4. Computation

A SECURITY DEFINER function `payroll_seed_period(period_id)`:
1. Copies every active `payroll_pay_rules` row for every active employee into `payroll_period_lines` with `quantity = default_quantity` (or null).
2. Where a rule maps cleanly to invoicing data, sums `work_logs.quantity` for that employee/date range/work_type into the seeded line's `quantity`.
3. Skips employees already seeded (idempotent re-runs append nothing).

A second function `payroll_recompute_line(line_id)` recalculates `gross_pay`. Triggers keep `gross_pay` in sync on insert/update.

### 5. CSV export

Edge function `export-payroll-period` returns a CSV with columns matching your sheet header: `Notes, Code, Department, Task, Name, Employee Number, Rate, Hrs or Units, OT Hours, Type, Total Gross Pay`. Rows flagged `delete_before_submit = true` are excluded. Finance+ only.

### 6. Shared / unchanged

- Employees, locations, roles, work_logs, work_types, clients — untouched and shared between both modes.
- Invoicing routes, theme, and behavior — unchanged.
- Only AuthContext / header / route tree / `index.css` change in the existing app.

### 7. Open questions to resolve during build

- **Payroll provider for export**: any specific format (Gusto, ADP, QuickBooks Payroll, Paychex), or just the spreadsheet-style CSV above?
- **OT handling**: OT column in the sheet sometimes holds a flag (`1`) rather than hours. Confirm: is OT a multiplier flag, an hours value, or both depending on `Type`?
- **Auto-pull from work_logs**: which pay codes map to which `work_types`? (Can be set up via a small mapping table later; v1 can be manual-entry-friendly.)
- **Salary handling**: salary rows in the sheet use `quantity = 1` and `rate = full pay` for the period — confirm we treat salary lines as fixed-amount per period.

### Technical notes

- Theme override pattern: `[data-mode="payroll"] { --primary: 142 71% 29%; --ring: 142 71% 45%; --gradient-primary: linear-gradient(...); --shadow-elegant: 0 10px 30px -10px hsl(142 71% 29% / .3); }` in `index.css`. No component code touches color tokens.
- Switcher component sets the attribute via `useEffect` based on `location.pathname.startsWith('/payroll')`.
- New folder: `src/pages/payroll/`, `src/components/payroll/`, `src/contexts/PayrollModeContext.tsx` (if needed for the switcher animation).
- Migration order: pay_codes + departments + pay_rules first (lets you seed rules), then periods + period_lines + functions + RLS, then UI.
- Build incrementally: ship #1 (theme + switcher + empty payroll dashboard) first so you can visually confirm the mode switch before any data work.
