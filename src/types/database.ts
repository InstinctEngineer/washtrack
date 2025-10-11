export type UserRole = 'employee' | 'manager' | 'finance' | 'admin';

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
  is_all_locations: boolean;
  created_at: string;
}

export interface VehicleType {
  id: string;
  type_name: string;
  rate_per_wash: number;
  is_active: boolean;
  created_at: string;
}

export interface Vehicle {
  id: string;
  vehicle_number: string;
  vehicle_type_id: string;
  home_location_id: string | null;
  last_seen_location_id: string | null;
  last_seen_date: string | null;
  is_active: boolean;
  created_at: string;
}

export interface VehicleWithDetails extends Vehicle {
  vehicle_type?: VehicleType;
  home_location?: Location;
  last_seen_location?: Location;
}

export interface WashEntry {
  id: string;
  employee_id: string;
  vehicle_id: string;
  wash_date: string;
  actual_location_id: string;
  created_at: string;
}

export interface WashEntryWithDetails extends WashEntry {
  vehicle?: VehicleWithDetails;
  employee?: User;
  actual_location?: Location;
}
