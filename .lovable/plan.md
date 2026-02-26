

## Fix: Duplicate Location Creation During CSV Bulk Upload

### Root Cause
The CSV import modal includes a "Create new location" button (line 649) in the validation UI. When a location name doesn't match exactly, users see an error with suggestions AND a "Create new" option. Clicking "Create new" calls `CreateLocationInlineModal`, which INSERTs a new location — even if one with the same name already exists for that client. There's no duplicate check in `CreateLocationInlineModal.handleSubmit`.

The `handleImport` function itself is clean — it only does SELECT lookups for locations, never INSERT.

### Data Cleanup
Delete the duplicate ABR location (`ddd6e9de-2d30-4c14-97fb-ff67122f5c89`) and its 3 orphaned `user_locations` entries.

### Code Fix

**File: `src/components/CreateLocationInlineModal.tsx`**
Add a duplicate check before INSERT: query `locations` for matching name + client_id. If found, show error "Location already exists" instead of creating a duplicate.

```typescript
// Before INSERT, check for existing
const { data: existing } = await supabase
  .from("locations")
  .select("id, name")
  .eq("client_id", clientId)
  .ilike("name", name.trim())
  .maybeSingle();

if (existing) {
  toast({ title: "Error", description: `Location "${existing.name}" already exists for this client`, variant: "destructive" });
  return;
}
```

### Files to Modify

| File | Change |
|------|--------|
| `src/components/CreateLocationInlineModal.tsx` | Add duplicate name check before INSERT |
| Database cleanup | Delete duplicate ABR location + orphaned user_locations |

