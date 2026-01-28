

## Simplify Weekly Stats Card

### Overview
Strip the weekly stats card down to its essential element: the total wash count. Remove all extraneous text and visual elements.

### Current State (Too Cluttered)
- Large number + "Washes" label
- "This week at [location name]" subtitle
- "X by you" badge
- Work type breakdown badges
- Empty state message
- Truck icon in circle

### Simplified Design
```text
+---------------------------+
|   Total Washed: 45        |
+---------------------------+
```

Single line, clean and minimal:
- Label: "Total Washed"
- Value: The number
- No icon, no badges, no breakdown, no subtitle

### Changes to `src/pages/EmployeeDashboard.tsx`

Replace the current verbose card (lines 742-805) with:

```tsx
{/* Weekly Stats Summary */}
<Card className="border-primary/20">
  <CardContent className="p-4">
    {loadingLogs ? (
      <Skeleton className="h-6 w-32" />
    ) : (
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Total Washed:</span>
        <span className="text-2xl font-bold">{weeklyStats.total}</span>
      </div>
    )}
  </CardContent>
</Card>
```

### What Gets Removed
- Truck icon circle
- "This week at [location]" text
- "by you" badge
- Work type breakdown row
- Empty state encouragement message
- Background color styling

### Result
A clean, single-line stat that employees can glance at instantly without reading through clutter.

