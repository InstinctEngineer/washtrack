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
  created_at: string;
}
