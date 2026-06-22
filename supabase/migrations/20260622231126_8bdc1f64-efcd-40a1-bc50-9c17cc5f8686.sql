
CREATE TABLE public.error_report_replies (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.error_reports(id) on delete cascade,
  user_id uuid not null,
  body text not null,
  created_at timestamptz not null default now()
);

GRANT SELECT, INSERT ON public.error_report_replies TO authenticated;
GRANT ALL ON public.error_report_replies TO service_role;

ALTER TABLE public.error_report_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reporter or super admin can view replies"
ON public.error_report_replies FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.error_reports er WHERE er.id = report_id AND er.reported_by = auth.uid())
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Reporter or super admin can insert replies"
ON public.error_report_replies FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid() AND (
    EXISTS (SELECT 1 FROM public.error_reports er WHERE er.id = report_id AND er.reported_by = auth.uid())
    OR public.is_super_admin(auth.uid())
  )
);

CREATE INDEX idx_error_report_replies_report ON public.error_report_replies(report_id, created_at);
