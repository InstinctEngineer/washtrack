-- Create employee_comments table for weekly messages to finance/management
CREATE TABLE public.employee_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id),
  comment_text text NOT NULL,
  week_start_date date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employee_comments ENABLE ROW LEVEL SECURITY;

-- Employees can insert their own comments
CREATE POLICY "Employees can insert their own comments"
ON public.employee_comments
FOR INSERT
WITH CHECK (auth.uid() = employee_id);

-- Employees can view their own comments
CREATE POLICY "Employees can view their own comments"
ON public.employee_comments
FOR SELECT
USING (auth.uid() = employee_id);

-- Finance and above can view all comments
CREATE POLICY "Finance and admin can view all comments"
ON public.employee_comments
FOR SELECT
USING (has_role_or_higher(auth.uid(), 'finance'::app_role));

-- Create index for efficient week-based queries
CREATE INDEX idx_employee_comments_week ON public.employee_comments(week_start_date);
CREATE INDEX idx_employee_comments_employee ON public.employee_comments(employee_id);