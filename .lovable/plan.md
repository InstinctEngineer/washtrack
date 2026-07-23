## Goal
Add optional GPS coordinates to facility locations so the mobile app can perform its own 50-mile geofence check. No enforcement in the web app.

## 1. Database migration
Add two nullable columns to `public.locations`:
- `latitude` — `double precision`, nullable
- `longitude` — `double precision`, nullable

Existing rows remain valid (NULL). No changes to RLS — current policies already return all columns to authenticated readers, so the mobile app will receive `latitude`/`longitude` automatically. No grants change.

## 2. Create Location modal (`src/components/CreateLocationModal.tsx`)
Add two decimal number inputs under the Address field:
- "Latitude" — `type="number"`, `step="any"`, optional
- "Longitude" — `type="number"`, `step="any"`, optional
- "Look up from address" button next to them (see §4)

Save values (or `null` when blank) alongside the existing insert payload.

## 3. Edit Location modal (`src/components/EditLocationModal.tsx`)
Same two inputs + lookup button, pre-populated from the row. Include them in the update payload.

## 4. "Look up from address" button (OpenStreetMap Nominatim)
Client-side fetch to `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=<address>`.
- Disabled unless the Address field has text.
- Sends a `User-Agent`-style identifier via the required `Referer` (browser sets automatically) and includes an `email` query param placeholder for Nominatim usage policy compliance.
- On success, fills Latitude/Longitude inputs (user can still tweak/clear before saving).
- Toast on empty results or network error.
- Note: Nominatim has a ~1 req/sec fair-use limit; fine for occasional single-location lookups.

## 5. Types
`src/integrations/supabase/types.ts` regenerates after the migration is approved, so `Location` picks up the new fields. `src/types/database.ts` — extend the `Location` type with `latitude: number | null` and `longitude: number | null` after the migration lands.

## Out of scope
- No geofence enforcement in the web app (mobile app handles the 50-mile check; managers+ exempt per the note).
- No changes to any other locations behavior, table structure, or unrelated screens.
