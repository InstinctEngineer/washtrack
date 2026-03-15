

## Plan: Add "Service" Toggle with Services Group at Bottom

### Database Migration
Add `is_service boolean NOT NULL DEFAULT false` to `work_types`.

### `src/pages/WorkTypes.tsx`
- Add "Service" toggle column to table
- Add `is_service` switch to create/edit modal
- New mutation to toggle `is_service`

### `src/components/WorkItemGrid.tsx`
- Include `is_service` in the work_types query fields
- Add `is_service` to `WorkItemWithDetails` work_type shape
- Group items with `is_service === true` under `"Services"` key
- Sort order: PUD first → alphabetical → **Services last**:
```typescript
.sort((a, b) => {
  if (a === 'PUD') return -1;
  if (b === 'PUD') return 1;
  if (a === 'Services') return 1;  // always last
  if (b === 'Services') return -1;
  return a.localeCompare(b);
})
```

### `src/types/database.ts`
- Add `is_service?: boolean` to `WorkType` interface

### What does NOT change
- Work logs, reporting, rate cards, work items page, RLS policies — all untouched.

