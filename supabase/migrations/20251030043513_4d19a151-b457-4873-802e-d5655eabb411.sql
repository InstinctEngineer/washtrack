-- Create manager approval requests table
CREATE TABLE IF NOT EXISTS public.manager_approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id),
  manager_id UUID NOT NULL REFERENCES auth.users(id),
  wash_entry_id UUID NOT NULL REFERENCES public.wash_entries(id),
  request_type TEXT NOT NULL DEFAULT 'remove_entry',
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for manager queries
CREATE INDEX IF NOT EXISTS idx_approval_requests_manager_status 
ON public.manager_approval_requests(manager_id, status) 
WHERE status = 'pending';

-- Enable RLS
ALTER TABLE public.manager_approval_requests ENABLE ROW LEVEL SECURITY;

-- Employees can view their own requests
CREATE POLICY "Employees can view own approval requests"
ON public.manager_approval_requests FOR SELECT
USING (auth.uid() = employee_id);

-- Employees can create requests
CREATE POLICY "Employees can create approval requests"
ON public.manager_approval_requests FOR INSERT
WITH CHECK (auth.uid() = employee_id);

-- Managers can view requests assigned to them
CREATE POLICY "Managers can view assigned requests"
ON public.manager_approval_requests FOR SELECT
USING (auth.uid() = manager_id AND status = 'pending');

-- Managers can update requests (approve/deny)
CREATE POLICY "Managers can update assigned requests"
ON public.manager_approval_requests FOR UPDATE
USING (auth.uid() = manager_id AND status = 'pending');

-- Admin can view all requests
CREATE POLICY "Admins can view all approval requests"
ON public.manager_approval_requests FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update wash_entries RLS to allow employees to soft delete their own same-day entries
CREATE POLICY "Employees can soft delete own same-day entries"
ON public.wash_entries FOR UPDATE
USING (
  auth.uid() = employee_id 
  AND wash_date = CURRENT_DATE
  AND deleted_at IS NULL
);