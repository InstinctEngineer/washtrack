-- Create report_templates table for saving custom report configurations
CREATE TABLE public.report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL CHECK (report_type IN ('wash_entries', 'client_billing', 'employee_performance', 'revenue_analysis')),
  
  -- Configuration stored as JSONB for flexibility
  config JSONB NOT NULL,
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  use_count INTEGER NOT NULL DEFAULT 0,
  
  -- Access control
  is_shared BOOLEAN NOT NULL DEFAULT true,
  is_system_template BOOLEAN NOT NULL DEFAULT false,
  
  -- Validation
  CONSTRAINT unique_template_name UNIQUE(template_name)
);

-- Create index for performance
CREATE INDEX idx_report_templates_report_type ON public.report_templates(report_type);
CREATE INDEX idx_report_templates_created_by ON public.report_templates(created_by);

-- Enable Row Level Security
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Finance users can view shared templates"
  ON public.report_templates FOR SELECT
  USING (has_role_or_higher(auth.uid(), 'finance'::app_role));

CREATE POLICY "Finance users can create templates"
  ON public.report_templates FOR INSERT
  WITH CHECK (has_role_or_higher(auth.uid(), 'finance'::app_role) AND created_by = auth.uid());

CREATE POLICY "Creators can update their templates"
  ON public.report_templates FOR UPDATE
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Creators can delete their templates (not system templates)"
  ON public.report_templates FOR DELETE
  USING ((created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) 
         AND is_system_template = false);

-- Insert 3 pre-built system templates
INSERT INTO public.report_templates (template_name, description, report_type, config, is_system_template, is_shared) VALUES
(
  'Weekly Wash Summary',
  'All wash entries for the past 7 days with key details',
  'wash_entries',
  '{
    "columns": ["wash_date", "vehicle_number", "client_name", "vehicle_type", "rate_per_wash", "location_name", "employee_name"],
    "filters": [
      {
        "field": "wash_date",
        "operator": "between",
        "value": "last_7_days"
      }
    ],
    "sorting": [
      { "field": "wash_date", "direction": "desc" }
    ]
  }'::jsonb,
  true,
  true
),
(
  'Monthly Client Invoice',
  'Complete wash details grouped by client for billing',
  'wash_entries',
  '{
    "columns": ["wash_date", "vehicle_number", "client_name", "vehicle_type", "rate_per_wash", "location_name", "final_amount", "customer_po_number"],
    "filters": [
      {
        "field": "wash_date",
        "operator": "between",
        "value": "current_month"
      }
    ],
    "sorting": [
      { "field": "client_name", "direction": "asc" },
      { "field": "wash_date", "direction": "desc" }
    ]
  }'::jsonb,
  true,
  true
),
(
  'Damage Reports',
  'All wash entries where damage was reported',
  'wash_entries',
  '{
    "columns": ["wash_date", "vehicle_number", "client_name", "location_name", "employee_name", "damage_description", "photo_damage_url"],
    "filters": [
      {
        "field": "damage_reported",
        "operator": "equals",
        "value": true
      }
    ],
    "sorting": [
      { "field": "wash_date", "direction": "desc" }
    ]
  }'::jsonb,
  true,
  true
);