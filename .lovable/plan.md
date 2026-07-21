## Remove "Log Dealership Wash" card from Employee Dashboard

The `DealershipWashCard` shows rate/pricing info ($ per vehicle, totals) that employees shouldn't see, and duplicates the existing scroll-wheel entry flow.

### Changes
- `src/pages/EmployeeDashboard.tsx`
  - Remove the `<DealershipWashCard />` render (line ~1039).
  - Remove its import (line 12).

### Not deleted
- `src/components/dealership/DealershipWashCard.tsx` file left in place (unused) in case it's referenced elsewhere later. Say the word if you want it deleted too.