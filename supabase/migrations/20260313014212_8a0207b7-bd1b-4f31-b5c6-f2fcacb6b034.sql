
CREATE TABLE public.error_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description text NOT NULL,
  screenshot_url text,
  page_url text,
  user_agent text,
  viewport text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.error_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own reports"
  ON public.error_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reported_by);

CREATE POLICY "Users can read own reports"
  ON public.error_reports FOR SELECT TO authenticated
  USING (auth.uid() = reported_by);

CREATE POLICY "Super admins can read all reports"
  ON public.error_reports FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update reports"
  ON public.error_reports FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid()));
