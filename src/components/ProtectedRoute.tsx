import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/database';
import { hasRoleOrHigher } from '@/lib/roleUtils';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, userRole, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !userRole) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if user's role meets the hierarchy requirement
  if (allowedRoles && allowedRoles.length > 0) {
    // Find the minimum required role (lowest in hierarchy that's allowed)
    const minRequiredRole = allowedRoles.reduce((min, current) => {
      const roleHierarchy: Record<UserRole, number> = {
        employee: 1,
        manager: 2,
        finance: 3,
        admin: 4,
        super_admin: 5,
      };
      return roleHierarchy[current] < roleHierarchy[min] ? current : min;
    });

    // Check if user has the minimum required role or higher
    if (!hasRoleOrHigher(userRole, minRequiredRole)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
};
