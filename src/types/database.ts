export type UserRole = 'employee' | 'manager' | 'finance' | 'admin' | 'super_admin';

export interface User {
  id: string;
  email: string;
  name: string;
  employee_id: string;
  location_id: string | null;
  manager_id: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  must_change_password?: boolean;
  credentials_shared_at?: string | null;
}

export interface Client {
  id: string;
  name: string;
  parent_company: string | null;
  billing_address: string | null;
  contact_name: string | null;
  contact_email: string | null;
  is_active: boolean;
  created_at: string;
  // QuickBooks Settings
  default_terms?: string | null;
  default_class?: string | null;
  // Tax Settings
  is_taxable?: boolean | null;
  tax_jurisdiction?: string | null;
  tax_rate?: number | null;
}

export interface Location {
  id: string;
  name: string;
  client_id: string;
  address: string | null;
  is_active: boolean;
  created_at: string;
  // Joined data
  client?: Client;
}

export interface UserLocation {
  id: string;
  user_id: string;
  location_id: string;
  is_primary: boolean;
  created_at: string;
}

export interface WorkType {
  id: string;
  name: string;
  rate_type: 'per_unit' | 'hourly';
  is_active: boolean;
  created_at: string;
}

export interface RateConfig {
  id: string;
  client_id: string;
  location_id: string;
  work_type_id: string;
  frequency: string | null;
  rate: number | null;
  needs_rate_review: boolean;
  is_active: boolean;
  created_at: string;
  // Joined data
  client?: Client;
  location?: Location;
  work_type?: WorkType;
}

export interface WorkItem {
  id: string;
  rate_config_id: string;
  identifier: string;
  is_active: boolean;
  created_at: string;
  // Joined data
  rate_config?: RateConfig;
}

export interface WorkLog {
  id: string;
  work_item_id: string | null;
  rate_config_id: string | null;
  employee_id: string;
  work_date: string;
  quantity: number;
  notes: string | null;
  created_at: string;
  // Joined data
  work_item?: WorkItem;
  rate_config?: RateConfig;
  employee?: User;
}

export interface SystemSetting {
  id: string;
  setting_key: string;
  setting_value: string;
  updated_by: string | null;
  updated_at: string;
  description: string | null;
}

export interface SystemSettingsAudit {
  id: string;
  setting_key: string;
  old_value: string | null;
  new_value: string;
  changed_by: string | null;
  changed_at: string;
  change_reason: string | null;
}
