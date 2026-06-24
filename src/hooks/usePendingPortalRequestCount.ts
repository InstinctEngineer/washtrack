import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function usePendingPortalRequestCount() {
  const { user, userRole } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchPendingCount = async () => {
    if (!user?.id || !userRole || !['finance', 'admin', 'super_admin'].includes(userRole)) {
      setPendingCount(0);
      setLoading(false);
      return;
    }

    try {
      const [accessReqResult, accountResult] = await Promise.all([
        supabase
          .from('client_portal_access_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending'),
        supabase
          .from('client_portal_users')
          .select('*', { count: 'exact', head: true })
          .eq('approval_status', 'pending'),
      ]);

      if (accessReqResult.error) throw accessReqResult.error;
      if (accountResult.error) throw accountResult.error;

      setPendingCount((accessReqResult.count || 0) + (accountResult.count || 0));
    } catch (error) {
      console.error('Error fetching pending portal request count:', error);
      setPendingCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingCount();

    const accessChannel = supabase
      .channel('portal-access-requests-pending')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'client_portal_access_requests',
          filter: "status=eq.pending",
        },
        () => fetchPendingCount()
      )
      .subscribe();

    const userChannel = supabase
      .channel('portal-users-pending')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'client_portal_users',
          filter: "approval_status=eq.pending",
        },
        () => fetchPendingCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(accessChannel);
      supabase.removeChannel(userChannel);
    };
  }, [user?.id, userRole]);

  return { pendingCount, loading };
}
