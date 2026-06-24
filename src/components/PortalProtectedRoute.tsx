import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  children: React.ReactNode;
  /** Allow access regardless of onboarding/approval status (used by /portal/onboarding and /portal/pending themselves). */
  allowAnyStatus?: boolean;
}

export const PortalProtectedRoute = ({ children, allowAnyStatus }: Props) => {
  const { user, isPortalUser, portalStatus, userRole, loading } = useAuth();
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

  if (!allowAnyStatus && portalStatus) {
    if (!portalStatus.is_active || portalStatus.approval_status === 'denied') {
      return <Navigate to="/portal/login" replace />;
    }
    if (!portalStatus.onboarding_completed) {
      return <Navigate to="/portal/onboarding" replace />;
    }
    if (portalStatus.approval_status === 'pending') {
      return <Navigate to="/portal/pending" replace />;
    }
  }

  return <>{children}</>;
};
