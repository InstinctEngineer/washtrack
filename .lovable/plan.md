

## Fix: CSV Smart Mapping for Work Items

### Root Cause
The validation logic requires **exact** string match (after lowercasing) for clients and locations. Any minor variation (extra/missing spaces, punctuation differences) triggers an error with suggestions — even when the match is obviously correct. High-confidence fuzzy matches should be auto-accepted.

### Changes to `src/components/CSVImportModal.tsx`

#### 1. Auto-accept high-confidence fuzzy matches in `validateRow`
When exact match fails but fuzzy match scores >= 0.85, auto-resolve it instead of showing an error:

**Client resolution (lines 162-170):**
```typescript
let client_id = resolvedClientId;
if (!client_id && client_name) {
  const client = clientMap.get(client_name.toLowerCase());
  if (client) {
    client_id = client.id;
  } else {
    // Try fuzzy match - auto-accept high confidence
    const fuzzyMatches = findSimilarMatches(client_name, clientsData, 0.4, 3);
    if (fuzzyMatches.length > 0 && fuzzyMatches[0].score >= 0.85) {
      client_id = fuzzyMatches[0].item.id;
      // Set resolved name so UI shows the mapping
      row.resolvedClientId = client_id;
      row.resolvedClientName = fuzzyMatches[0].name;
    } else {
      clientError = `Client "${client_name}" not found`;
      clientSuggestions = fuzzyMatches;
    }
  }
}
```

**Location resolution (lines 181-193):** Same pattern — auto-accept >= 0.85 score.

#### 2. Add normalized matching before fuzzy matching
Before calling `findSimilarMatches`, try a normalized comparison that strips extra spaces and common punctuation:

```typescript
// Normalize: collapse spaces, remove punctuation
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

// Try normalized exact match
const normalizedName = normalize(client_name);
const normalizedClient = clientsData.find(c => normalize(c.name) === normalizedName);
if (normalizedClient) {
  client_id = normalizedClient.id;
}
```

This handles "FedEx RST" matching "Fed Ex RST", "fedex rst", etc.

### Files to Modify

| File | Change |
|------|--------|
| `src/components/CSVImportModal.tsx` | Add normalized matching + auto-accept high-confidence fuzzy matches in `validateRow` |

### Validation Order (unchanged, already correct)
1. Client validated first (line 161)
2. Location validated only if client resolved (line 182: `if (!location_id && client_id && location_name)`)
3. Work type + frequency validated during import (line 406)

### What This Fixes
- "FedEx RST" → auto-matches "Fed Ex RST" (normalized match)
- "rst" → auto-matches "RST" location (already works via toLowerCase, but normalized match adds safety)
- High-confidence fuzzy matches auto-resolve with green indicator instead of red error
- Valid exact matches remain untouched (no "reassignment")

