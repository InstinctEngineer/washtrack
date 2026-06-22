
-- Backfill: assign every admin/super_admin to every location
INSERT INTO public.user_locations (user_id, location_id, is_primary)
SELECT ur.user_id, l.id, false
FROM public.user_roles ur
CROSS JOIN public.locations l
WHERE ur.role IN ('admin'::app_role, 'super_admin'::app_role)
ON CONFLICT (user_id, location_id) DO NOTHING;

-- Trigger function: when a new location is created, assign all admins/super_admins
CREATE OR REPLACE FUNCTION public.assign_admins_to_new_location()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_locations (user_id, location_id, is_primary)
  SELECT ur.user_id, NEW.id, false
  FROM public.user_roles ur
  WHERE ur.role IN ('admin'::app_role, 'super_admin'::app_role)
  ON CONFLICT (user_id, location_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_admins_to_new_location ON public.locations;
CREATE TRIGGER trg_assign_admins_to_new_location
AFTER INSERT ON public.locations
FOR EACH ROW
EXECUTE FUNCTION public.assign_admins_to_new_location();

-- Trigger function: when a user is granted admin/super_admin, assign all locations
CREATE OR REPLACE FUNCTION public.assign_all_locations_to_new_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IN ('admin'::app_role, 'super_admin'::app_role) THEN
    INSERT INTO public.user_locations (user_id, location_id, is_primary)
    SELECT NEW.user_id, l.id, false
    FROM public.locations l
    ON CONFLICT (user_id, location_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_all_locations_to_new_admin ON public.user_roles;
CREATE TRIGGER trg_assign_all_locations_to_new_admin
AFTER INSERT ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.assign_all_locations_to_new_admin();
