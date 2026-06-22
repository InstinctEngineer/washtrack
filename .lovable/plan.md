## Goal
Ensure every user with role `admin` or `super_admin` is assigned to every location in the `user_locations` table — retroactively now, and automatically going forward whenever a new location is created or a user is granted one of those roles.

## Current behavior
- `AuthContext` grants finance/admin/super_admin access to all active locations *in memory only* — no rows exist in `user_locations`.
- Anything that queries `user_locations` directly (reports, manager assignments, RLS policies, etc.) does not see admins as assigned.

## Scope clarification
Spec says "Admin or Above" → `admin` and `super_admin` only (not finance). Confirm if finance should also be included — otherwise we'll proceed with admin + super_admin.

## Plan

### 1. Database migration
Create a single migration that does:

**a. Backfill** — insert a row into `user_locations` for every (admin/super_admin user × every location) pair that doesn't already exist.

**b. Trigger on `locations` insert** — when a new location row is created, insert `user_locations` rows for every current admin/super_admin user.

**c. Trigger on `user_roles` insert** — when a user is granted the `admin` or `super_admin` role, insert `user_locations` rows for every existing location.

Both triggers use `ON CONFLICT DO NOTHING` against the existing `(user_id, location_id)` uniqueness.

### 2. No frontend changes required
- `CreateLocationModal` and `Locations.tsx` keep their current insert logic — the trigger handles the assignments server-side.
- `AuthContext`'s fallback that grants all locations to admins stays as a safety net (and still covers finance per existing behavior).

### Open question
Should `finance` also be auto-assigned to every location, or strictly `admin` + `super_admin`?
