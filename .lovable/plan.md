

## Bug: "Please select a rate configuration" when adding work items

### Root Cause

The frequency selector (line 676) is **hidden** when there's only one frequency option for the selected location + work type combination. When hidden, `formFrequency` stays as empty string `''`.

The rate config matching logic (lines 243-251) then evaluates:
```
rc.frequency === (formFrequency || null)
// becomes: rc.frequency === null
```

If the single available frequency is something like `"2x/week"` (not null), the match fails. `selectedRateConfig` is `undefined`, and the mutation throws "Please select a rate configuration."

### Fix

**File: `src/pages/WorkItems.tsx`**

**Auto-select the rate config when there's exactly one frequency option.** When `formWorkTypeId` changes and only one matching rate config exists, auto-set `formFrequency` to that config's frequency (or auto-set `formRateConfigId` directly).

Concretely, update the `onValueChange` handler for Work Type (line 655) to also auto-select when there's only one match:

```typescript
onValueChange={(v) => {
  setFormWorkTypeId(v);
  setFormFrequency('');
  // Auto-select if only one rate config matches
  const matching = rateConfigs.filter(
    rc => rc.location_id === formLocationId && rc.work_type_id === v
  );
  if (matching.length === 1) {
    setFormFrequency(matching[0].frequency || '');
  }
}}
```

Also fix the `selectedRateConfig` matching to handle the single-frequency case — when the frequency dropdown is hidden (only one option), use the single available frequency for matching instead of relying on `formFrequency`:

```typescript
const selectedRateConfig = rateConfigs.find(rc => {
  if (formRateConfigId) return rc.id === formRateConfigId;
  if (formLocationId && formWorkTypeId) {
    const matchesBase = rc.location_id === formLocationId && rc.work_type_id === formWorkTypeId;
    if (!matchesBase) return false;
    // If only one frequency available, auto-match it
    if (availableFrequencies.length <= 1) return true;
    return rc.frequency === (formFrequency || null);
  }
  return false;
});
```

### Files to Change

| File | Change |
|------|--------|
| `src/pages/WorkItems.tsx` | Fix `selectedRateConfig` matching when frequency dropdown is hidden; auto-select single frequency |

