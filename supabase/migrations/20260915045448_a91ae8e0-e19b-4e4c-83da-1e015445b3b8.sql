CREATE UNIQUE INDEX IF NOT EXISTS payroll_work_type_map_work_type_unique
  ON public.payroll_work_type_map (work_type_id)
  WHERE location_id IS NULL;