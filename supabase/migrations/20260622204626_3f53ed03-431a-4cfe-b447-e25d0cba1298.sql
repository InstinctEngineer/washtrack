
ALTER TABLE public.error_reports
  ADD COLUMN IF NOT EXISTS admin_response TEXT,
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS responded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "Recipients can view comments addressed to them" ON public.employee_comments;
CREATE POLICY "Recipients can view comments addressed to them"
  ON public.employee_comments FOR SELECT
  TO authenticated
  USING (auth.uid() = recipient_id);
