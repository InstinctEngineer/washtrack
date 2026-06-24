import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  children: React.ReactNode;
}

export const PortalProtectedRoute = ({ children }: Props) => {
  const { user, isPortalUser, userRole, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/portal/login" state={{ from: location }} replace />;
  }

  // Internal users may not use the portal
  if (userRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (!isPortalUser) {
    return <Navigate to="/portal/login" replace />;
  }

  return <>{children}</>;
};
