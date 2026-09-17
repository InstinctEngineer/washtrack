# Editable Employee IDs

## What you asked about

You want Employee IDs in WashTrack to match the IDs in your other system.

Good news: nothing in the data is tied to the Employee ID text. Every wash record, ticket, message and payroll line points at the user's internal account, not this ID. Payroll's Future Systems number is a separate field. So changing an ID never orphans history.

Three things would break without care, and this plan handles each:

1. **Duplicates and blanks.** The ID must be unique and can't be empty. Today the edit screen doesn't check, so a clash shows a raw database error.
2. **The auto-numbering for new users.** New IDs are built as year+month plus a 3-digit counter, read off the highest ID for the current month. A hand-typed ID that starts with the same year/month but ends in letters can make the next creation fail or reuse a number.
3. **Old paperwork.** Reports print whatever the ID is right now, so a re-run of a past week shows the new ID.

## What changes

**Anyone Finance and above can edit an Employee ID.** The field becomes editable on the Edit User screen for finance, admin and super admin. Everyone else still sees it greyed out.

**Creating a user requires typing an Employee ID.** Auto-generation is removed. The create screen asks for the ID up front and won't let the account be created without one, so it always matches your other system from day one.

**Clear checks instead of error codes.** Before saving, the app confirms the ID isn't blank and isn't already in use, and tells you exactly which person has it if it is.

**Every change is recorded.** Each Employee ID change is written to the activity log: who changed it, the old ID, the new ID, and when. Viewable on the Activity Logs page, so an ID on an older printout can always be traced.

## Technical notes

- `src/components/EditUserModal.tsx`: gate the Employee ID input on `has_role_or_higher(finance)` (client check via `currentUserRole` in `['finance','admin','super_admin']`); trim + non-empty + max-length validation; pre-save uniqueness query on `users.employee_id` excluding the current user; friendly toast on `23505`; on success write an `activity_logs` row with action `employee_id_change` and metadata `{ user_id, old_employee_id, new_employee_id }`.
- `supabase/functions/create-user/index.ts`: remove `generateEmployeeId` and its call; add `employee_id` to the Zod schema as a required trimmed string (1–32 chars, alphanumeric plus `-`/`_`); return a 409 with a clear message when the insert hits the unique index.
- `src/components/CreateUserModal.tsx`: add a required Employee ID field, pass it through to the edge function, surface the duplicate error inline.
- `src/pages/CreateUser.tsx` already collects the ID; align its validation and duplicate messaging with the modal.
- No schema migration needed — `users_employee_id_key` (unique) and NOT NULL already exist, and no foreign key references this column.
