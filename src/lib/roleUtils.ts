import { supabase } from '@/integrations/supabase/client';
import { UserRole } from '@/types/database';

// Role hierarchy: Super Admin > Admin > Finance > Manager > Employee
const roleHierarchy: Record<UserRole, number> = {
  super_admin: 5,
  admin: 4,
  finance: 3,
  manager: 2,
  employee: 1,
};

/**
 * Get the highest role for a user from the user_roles table
 */
export async function getUserHighestRole(userId: string): Promise<UserRole | null> {
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (error) throw error;
    if (!data || data.length === 0) return null;

    // Find the role with the highest hierarchy value
    const roles = data.map(r => r.role as UserRole);
    const highestRole = roles.reduce((highest, current) => {
      return roleHierarchy[current] > roleHierarchy[highest] ? current : highest;
    });

    return highestRole;
  } catch (error) {
    console.error('Error fetching user roles:', error);
    return null;
  }
}

/**
 * Get all roles for a user
 */
export async function getUserRoles(userId: string): Promise<UserRole[]> {
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (error) throw error;
    return data?.map(r => r.role as UserRole) || [];
  } catch (error) {
    console.error('Error fetching user roles:', error);
    return [];
  }
}

/**
 * Check if a user has a specific role or higher in the hierarchy
 */
export function hasRoleOrHigher(userRole: UserRole, requiredRole: UserRole): boolean {
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

/**
 * Get the dashboard path for a given role
 */
export function getDashboardPath(role: UserRole): string {
  const roleRoutes: Record<UserRole, string> = {
    employee: '/employee/dashboard',
    manager: '/employee/dashboard', // Temporarily redirect to employee dashboard
    finance: '/finance/dashboard',
    admin: '/admin/dashboard',
    super_admin: '/admin/dashboard',
  };

  return roleRoutes[role] || '/employee/dashboard';
}

/**
 * Get roles that the current user can assign to others
 * Users can only assign roles at or below their own level
 */
export function getAssignableRoles(currentRole: UserRole): UserRole[] {
  const allRoles: UserRole[] = ['employee', 'manager', 'finance', 'admin', 'super_admin'];
  return allRoles.filter(role => roleHierarchy[role] <= roleHierarchy[currentRole]);
}

/**
 * Check if a user can manage another user based on role hierarchy
 * Returns true if the current user's role is higher than the target user's role
 */
export function canManageUser(currentRole: UserRole, targetRole: UserRole): boolean {
  // Super admin can manage anyone
  if (currentRole === 'super_admin') return true;
  // Admin can manage anyone except super_admin
  if (currentRole === 'admin') return targetRole !== 'super_admin';
  // Finance can manage finance and below (but not admin/super_admin)
  if (currentRole === 'finance') return roleHierarchy[targetRole] <= roleHierarchy['finance'];
  // Others cannot manage users
  return false;
}
