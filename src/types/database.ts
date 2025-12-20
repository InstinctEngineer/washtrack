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
}

export interface Location {
  id: string;
  name: string;
  address: string | null;
  manager_user_id: string | null;
  is_active: boolean;
  created_at: string;
  location_code?: string | null;
  tax_jurisdiction?: string | null;
}

export interface UserLocation {
  id: string;
  user_id: string;
  location_id: string;
  is_primary: boolean;
  created_at: string;
}

export interface VehicleType {
  id: string;
  type_name: string;
  rate_per_wash: number;
  is_active: boolean;
  created_at: string;
}

export interface Client {
  id: string;
  client_code: string;
  client_name: string;
  is_active: boolean;
  created_at: string;
}

export interface Vehicle {
  id: string;
  vehicle_number: string;
  vehicle_type_id: string;
  client_id: string | null;
  home_location_id: string | null;
  last_seen_location_id: string | null;
  last_seen_date: string | null;
  is_active: boolean;
  created_at: string;
}

export interface VehicleWithDetails extends Vehicle {
  vehicle_type?: VehicleType;
  client?: Client;
  home_location?: Location;
  last_seen_location?: Location;
}

export interface ServiceCategory {
  id: string;
  category_code: string;
  category_name: string;
  is_hourly_default: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface WashFrequency {
  id: string;
  frequency_code: string;
  frequency_name: string;
  washes_per_week: number | null;
  rate_multiplier: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface LocationServiceRate {
  id: string;
  location_id: string;
  client_id: string | null;
  vehicle_type_id: string | null;
  service_category_id: string | null;
  frequency_id: string | null;
  rate: number;
  is_hourly: boolean;
  effective_date: string;
  expiration_date: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  notes: string | null;
}

export interface WorkEntry {
  id: string;
  employee_id: string;
  vehicle_id: string | null;
  work_date: string;
  location_id: string;
  created_at: string;
  service_category_id: string | null;
  frequency_id: string | null;
  direct_vehicle_type_id: string | null;
  quantity: number | null;
  unit_rate_applied: number | null;
  line_total: number | null;
  is_additional_work: boolean;
  additional_work_description: string | null;
  hours_worked: number | null;
  client_id?: string | null;
  rate_at_time_of_wash?: number | null;
  comment?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  deletion_reason?: string | null;
}

export interface WorkEntryWithDetails extends WorkEntry {
  vehicle?: VehicleWithDetails;
  employee?: User;
  location?: Location;
  service_category?: ServiceCategory;
  frequency?: WashFrequency;
}

export type WashEntry = WorkEntry;
export type WashEntryWithDetails = WorkEntryWithDetails;

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
