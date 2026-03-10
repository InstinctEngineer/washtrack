

## Plan: End-to-End Data Flow Tracing in Activity Logs

### The Problem

Right now, if someone adds a work type, the logs would show:
- A `click` on "Add Work Type" button (with dialog context)
- `input_change` entries for the name field
- A `form_submit` event
- A `db_insert` to `work_types` with just the HTTP status

**Missing**: The DB insert log doesn't include *what data was sent*, *which modal triggered it*, or *which form fields were submitted*. There's no way to connect the dots from UI action to database write.

### What Changes

**1. Capture request body on database mutations (`activityLogger.ts`)**

In the fetch interceptor, clone and parse the request body for POST/PATCH/DELETE calls to Supabase REST. Run it through `redactSensitive()` before logging. This gives you the actual data payload (e.g., `{name: "Sprinter", rate_type: "per_unit"}`).

**2. Capture query filters on updates/deletes**

Parse the URL query string (e.g., `?id=eq.abc123`) to show which records were targeted. This tells you "updated `work_types` where `id = abc123`".

**3. Add a UI context tracker**

Maintain a lightweight "context stack" that tracks:
- The currently open modal/dialog title (via MutationObserver watching `[role="dialog"]` elements)
- The current page route

Attach this context to every DB operation log automatically, so a `db_insert` entry includes `{modal: "Add Work Type", page: "/admin/work-types", body: {name: "Sprinter", rate_type: "per_unit"}}`.

**4. Add a correlation ID for form flows**

Generate a short ID when a `form_submit` fires, and attach it to the subsequent DB operations within a short time window (~2 seconds). This links the form submission to the exact database calls it triggered.

**5. Update the detail drawer**

In the Activity Logs detail sheet, render the request body as a formatted key-value list (like metadata already is), and show the modal/context and correlation ID when present.

### Technical Details

**Fetch interceptor enhancement** (`activityLogger.ts`):
- Clone the request `init.body` before sending, parse as JSON, run through `redactSensitive()`
- Extract URL query params like `id=eq.xxx` into a `filters` metadata field
- Attach `currentDialogContext` and `correlationId` to the metadata

**Dialog context tracking**:
- A MutationObserver watches for `[role="dialog"][data-state="open"]` additions/removals
- Extracts the dialog title text and stores it in a module-level variable `currentDialogContext`
- Zero performance impact — passive observation only

**Correlation ID**:
- On `form_submit`, generate a 6-char random ID, store it with a 2-second TTL
- The fetch interceptor checks if a correlation ID is active and attaches it

### Files Modified
- `src/lib/activityLogger.ts` — request body capture, dialog context observer, correlation IDs
- `src/pages/ActivityLogs.tsx` — render body/context/correlation in detail drawer

### Example Log Output After Changes

For "add a new work type called Sprinter":

| Action | Target | Metadata |
|--------|--------|----------|
| click | Add Work Type | `{element_type: "button", dialog: null}` |
| input_change | [name field] | `{value: "Sprinter", dialog: "Add Work Type"}` |
| click | Per Unit | `{element_type: "toggle", dialog: "Add Work Type"}` |
| form_submit | unnamed_form | `{fields: ["name"], correlation: "a3f2x1"}` |
| db_insert | work_types | `{body: {name: "Sprinter", rate_type: "per_unit"}, modal: "Add Work Type", correlation: "a3f2x1", status: 201}` |

