CREATE OR REPLACE FUNCTION public.can_delete_report_template(_creator uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN auth.uid() IS NULL THEN false
      WHEN _creator = auth.uid() THEN true
      WHEN public.has_role(auth.uid(), 'super_admin') THEN true
      WHEN public.has_role(auth.uid(), 'admin')
        AND NOT (_creator IS NOT NULL AND public.has_role(_creator, 'super_admin')) THEN true
      ELSE false
    END
$$;

DROP POLICY IF EXISTS "Creators can delete their templates (not system templates)" ON public.report_templates;

CREATE POLICY "Template deletion by owner or higher role"
ON public.report_templates
FOR DELETE
TO authenticated
USING (is_system_template = false AND public.can_delete_report_template(created_by));