# Plan: Fix Clients Dialog Scrolling

## Problem
The create/edit client dialog in `src/pages/Clients.tsx` has too many fields and they don't fit on screen. The current implementation uses `ScrollArea` which doesn't work properly with the flex layout constraints.

## Root Cause
The `ScrollArea` component (Radix ScrollAreaPrimitive) uses `overflow-hidden` on the Root and relies on the Viewport having proper height constraints. When combined with `flex-1` and calculated max-heights, it doesn't scroll correctly.

## Solution
Use the same pattern as other dialogs in the codebase: apply `overflow-y-auto` directly to `DialogContent`. This is simpler and more reliable.

### Evidence from Codebase
Other modals already use this pattern successfully:
- `CreateUserModal.tsx` (line 312): `max-h-[90vh] overflow-y-auto`
- `EditUserModal.tsx` (line 314): `max-h-[90vh] overflow-y-auto`
- `SuperAdminDatabase.tsx` (line 318): `max-h-[80vh] overflow-y-auto`

## Implementation Steps

### Step 1: Remove ScrollArea import
Remove the unused `ScrollArea` import from line 9:
```tsx
// Remove this line:
import { ScrollArea } from '@/components/ui/scroll-area';
```

### Step 2: Simplify DialogContent (line 321)
Change from:
```tsx
<DialogContent className="max-w-md max-h-[90vh] flex flex-col">
```
To:
```tsx
<DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
```

### Step 3: Remove ScrollArea wrapper (lines 329 and 472)
Replace:
```tsx
<ScrollArea className="flex-1 max-h-[calc(90vh-180px)] pr-4">
  <div className="space-y-4 py-4">
    {/* form fields */}
  </div>
</ScrollArea>
```
With just:
```tsx
<div className="space-y-4 py-4">
  {/* form fields */}
</div>
```

## Files to Modify
- `src/pages/Clients.tsx`

## Result
- The entire dialog content will scroll when it exceeds viewport height
- Matches the pattern used in CreateUserModal, EditUserModal, and SuperAdminDatabase
- Simpler implementation without extra wrapper components

## Critical Files for Implementation
- `src/pages/Clients.tsx` - Apply the fix (lines 9, 321, 329, 472)
- `src/components/CreateUserModal.tsx` - Reference pattern (line 312)
- `src/components/EditUserModal.tsx` - Reference pattern (line 314)
