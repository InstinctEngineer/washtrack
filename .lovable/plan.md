

## Investigation Results

### Root Causes Found

**1. ClientSetupWizard creates duplicate clients** — `handleCreateClient` (line 112) does NOT check if a client with the same name already exists before inserting. Every time the wizard runs, it blindly creates a new client.

**2. ClientSetupWizard creates duplicate locations** — The duplicate check on line 166-175 only checks locations under the *newly created* (duplicate) client ID, so it never finds the original location.

**3. Location not in employee dashboard dropdown** — The employee dashboard loads locations from `user_locations` (a junction table mapping users to locations). New locations created via the wizard or the Locations page are never inserted into `user_locations` for any user. The admin must manually assign the location to employees via Edit User. This is by-design but the "ABR" duplicates mean the *original* ABR location (correctly assigned to users) is being ignored because the CSV import is looking at the *duplicate* ABR client/location.

### Plan

#### 1. Clean up duplicate ABR data
- Query to find duplicate ABR clients and locations
- Delete the duplicates (and any rate_configs/work_items attached to them)
- Keep the originals intact

#### 2. Fix `ClientSetupWizard.tsx` — Add duplicate client check
In `handleCreateClient`, before inserting, check for an existing client with the same name (case-insensitive). If found, offer to use the existing client instead of creating a new one.

```
Before insert:
  - Query clients table with ilike match on name
  - If match found, ask user to confirm: use existing or create new
  - If using existing, set createdClientId to existing client's ID and skip insert
```

#### 3. Fix `ClientSetupWizard.tsx` — Location duplicate check scope
The current check on line 166 correctly scopes to `createdClientId`, but since step 1 may now reuse an existing client, this naturally fixes the location duplicate issue too.

#### 4. Fix `CreateLocationModal.tsx` — Scope duplicate check to client
Line 94-98 checks for duplicate location names globally (any client). Should be scoped to the selected `client_id` to allow the same location name for different clients, while catching true duplicates.

### Files to Modify

| File | Change |
|------|--------|
| `src/components/ClientSetupWizard.tsx` | Add case-insensitive duplicate client check before insert; if match found, offer to reuse existing client |
| `src/components/CreateLocationModal.tsx` | Scope duplicate location check to selected `client_id` |
| Database cleanup | Delete duplicate ABR client/location and any orphaned rate_configs/work_items |

