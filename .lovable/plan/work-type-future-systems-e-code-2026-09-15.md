# Work Type = Future Systems E Code

Make the E code a property of the work type itself — global, never per location. Any "PUD" work anywhere rolls into E25; any Janitorial work rolls into E26, and so on.

## What changes

1. **Seed the E code list** from the payroll worksheet you uploaded:

```text
E01  Office        Office
E03  Office        PTO
E11  Snow          Snow Removal
E12  Lawn          Lawncare
E23  FedEx         Travel
E25  FedEx         PUD
E26  FedEx         Janitorial
E28  Mobile Wash   Republic
E45  FedEx         Mobile Wash (FedEx hourly)
E53  FedEx         W700-W1200 Trucks
E58  Mobile Wash   Mobile Wash
E68  FedEx         Interior Cleaning
E99  FedEx         Subcontractor
```

2. **Add a "Work Type Codes" tab** to the Payroll workspace (Finance+). One row per active work type, one dropdown per row to pick its E code. No location column — the mapping is global. Unmapped work types show a warning chip so nothing silently drops out of a run.

3. **Pre-map the obvious ones** so you only clean up the leftovers:

```text
E25  PUD, Fed Ex PUD, Fed Ex PUDs Washed once/week, once/month, twice/week
E26  Janitorial
E68  Contracted Interior Cleaning
E53  W700, W900, W1200, W1000-1200 Trucks Washed once/week
E23  Travel to and from Jobsite, Travel Fee, Republic Travel Fee
```

Everything else (Republic loads, Tractors, Trailers, Misc., etc.) is left blank for you to assign in the new tab.

4. **Run generation uses the mapping.** When a weekly run is built, unit work from `work_logs` is grouped by employee + E code, and the Code / Department columns in the Future Systems export come straight from the mapped pay code. The Task Label stays what it is today (site + item label, e.g. "MLI PUD").

## Technical notes

- `payroll_work_type_map` already exists with a nullable `location_id`; it will be used with `location_id` always null, and a unique index added on `work_type_id` to enforce one code per work type. Existing location-aware lookup code in `PayrollDashboard.tsx` collapses to a plain work-type lookup.
- Pay codes are seeded into `payroll_pay_codes` (`code`, `department`, `default_pay_type`), which is currently empty.
- Mapping edits write to `payroll_work_type_map` via upsert; Finance+ RLS already covers both tables.
