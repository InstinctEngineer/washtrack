import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { setLoggerUser, logPageView, logAction, logDataChange } from '@/lib/activityLogger';

export function useActivityLogger() {
  const { userProfile } = useAuth();
  const location = useLocation();
  const lastPath = useRef<string>('');

  // Keep logger user in sync
  useEffect(() => {
    setLoggerUser(userProfile?.id ?? null);
  }, [userProfile?.id]);

  // Auto-log page views on route change
  useEffect(() => {
    if (userProfile?.id && location.pathname !== lastPath.current) {
      lastPath.current = location.pathname;
      logPageView(location.pathname);
    }
  }, [location.pathname, userProfile?.id]);

  return { logAction, logDataChange };
}
