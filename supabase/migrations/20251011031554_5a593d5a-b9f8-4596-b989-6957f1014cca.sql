-- Create vehicle_types table
CREATE TABLE public.vehicle_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type_name TEXT NOT NULL UNIQUE,
  rate_per_wash DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create vehicles table
CREATE TABLE public.vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_number TEXT NOT NULL UNIQUE,
  vehicle_type_id UUID NOT NULL REFERENCES public.vehicle_types(id),
  home_location_id UUID REFERENCES public.locations(id),
  last_seen_location_id UUID REFERENCES public.locations(id),
  last_seen_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_vehicles_vehicle_number ON public.vehicles(vehicle_number);
CREATE INDEX idx_vehicles_home_location ON public.vehicles(home_location_id);
CREATE INDEX idx_vehicles_type ON public.vehicles(vehicle_type_id);

-- Enable RLS
ALTER TABLE public.vehicle_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vehicle_types
CREATE POLICY "All authenticated users can read vehicle types"
  ON public.vehicle_types FOR SELECT
  USING (true);

CREATE POLICY "Admin can insert vehicle types"
  ON public.vehicle_types FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update vehicle types"
  ON public.vehicle_types FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete vehicle types"
  ON public.vehicle_types FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for vehicles
CREATE POLICY "All authenticated users can read vehicles"
  ON public.vehicles FOR SELECT
  USING (true);

CREATE POLICY "Admin can insert vehicles"
  ON public.vehicles FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update vehicles"
  ON public.vehicles FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete vehicles"
  ON public.vehicles FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));