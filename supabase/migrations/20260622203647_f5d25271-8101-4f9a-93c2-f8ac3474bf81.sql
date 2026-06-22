UPDATE public.work_types SET rate_type = 'hourly' WHERE lower(name) = 'cars washed';

UPDATE public.work_items wi SET is_active = false
WHERE wi.rate_config_id IN (
  SELECT rc.id FROM public.rate_configs rc
  JOIN public.work_types wt ON wt.id = rc.work_type_id
  WHERE lower(wt.name) = 'cars washed'
);