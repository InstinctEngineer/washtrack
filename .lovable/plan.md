

## Guided Client Setup Wizard

### Problem
Finance/Admin users currently have to navigate between 3 separate pages (Clients → Locations → Work Items) to onboard a new client, re-entering overlapping data like addresses. There's no clear 1-2-3 flow.

### Solution
Create a multi-step wizard component that guides users through the full onboarding process from one entry point.

### New File: `src/components/ClientSetupWizard.tsx`

A stepper dialog with 3 steps:

**Step 1 — Create Client**
- Same fields as current create dialog (name, parent company, contact, billing address, QB settings, tax settings)
- On submit, inserts into `clients` table and advances to step 2

**Step 2 — Add Location**
- Pre-fills: `client_id` is auto-set to the just-created client. Billing address from step 1 is pre-filled into the location address field (user can edit)
- Fields: location name, address (pre-filled), is_active
- Also shows option to select an existing location instead of creating new
- Skip button available if no location needed yet
- On submit, inserts into `locations` and advances to step 3

**Step 3 — Bulk Upload Work Items**
- Shows two options: "Upload CSV" (opens existing `CSVImportModal` pre-filtered to the new client) or "Skip / Done"
- Finishing closes the wizard and refreshes the clients list

### UI Design
- Single `Dialog` with a step indicator at top (circles: 1 → 2 → 3 with labels "Client", "Location", "Work Items")
- Current step highlighted, completed steps show checkmark
- Back button on steps 2-3, Next/Create button advances
- Minimalist — reuses existing form patterns

### Changes to `src/pages/Clients.tsx`
- Import `ClientSetupWizard`
- Add state `showSetupWizard` 
- Change the "Add Client" button to open the wizard instead of the plain create dialog
- Keep the existing create/edit dialog for editing existing clients
- Pass `onComplete` callback that calls `fetchClients()`

### Changes to `src/components/CSVImportModal.tsx`
- Add optional `defaultClientId` and `defaultClientName` props
- When provided, pre-select that client in the import flow so rows default to that client

### Files
| File | Change |
|------|--------|
| `src/components/ClientSetupWizard.tsx` | **New** — 3-step wizard component |
| `src/pages/Clients.tsx` | Wire "Add Client" button to wizard |
| `src/components/CSVImportModal.tsx` | Add optional `defaultClientId` prop for pre-filtering |

