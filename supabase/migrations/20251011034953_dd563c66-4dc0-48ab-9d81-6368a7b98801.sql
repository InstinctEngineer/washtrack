-- Create wash_entries table
CREATE TABLE public.wash_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  wash_date DATE NOT NULL,
  actual_location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint to prevent duplicate washes on same day
ALTER TABLE public.wash_entries 
ADD CONSTRAINT unique_vehicle_wash_per_day UNIQUE (vehicle_id, wash_date);

-- Create indexes for performance
CREATE INDEX idx_wash_entries_employee_date ON public.wash_entries(employee_id, wash_date);
CREATE INDEX idx_wash_entries_wash_date ON public.wash_entries(wash_date);
CREATE INDEX idx_wash_entries_vehicle ON public.wash_entries(vehicle_id);

-- Enable Row Level Security
ALTER TABLE public.wash_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can read their own entries
CREATE POLICY "Employees can read their own wash entries" 
ON public.wash_entries 
FOR SELECT 
USING (auth.uid() = employee_id);

-- RLS Policy: Finance and admin can read all entries
CREATE POLICY "Finance and admin can read all wash entries" 
ON public.wash_entries 
FOR SELECT 
USING (has_role_or_higher(auth.uid(), 'finance'::app_role));

-- RLS Policy: Users can insert their own entries
CREATE POLICY "Employees can create their own wash entries" 
ON public.wash_entries 
FOR INSERT 
WITH CHECK (auth.uid() = employee_id);

-- RLS Policy: Only admin can delete
CREATE POLICY "Admin can delete wash entries" 
ON public.wash_entries 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policy: Only admin can update
CREATE POLICY "Admin can update wash entries" 
ON public.wash_entries 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));