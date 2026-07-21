import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Counts unread replies for portal users:
 * - message_replies on their own employee_comments
 * - error_report_replies on their own error_reports
 *
 * RLS already scopes both reply tables to rows the portal user can see.
 * We use `user_message_views.last_viewed_at` as the read marker.
 */
export function usePortalUnreadCount() {
  const { user, isPortalUser } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchCount = async () => {
    if (!user?.id || !isPortalUser) {
      setUnreadCount(0);
      setLoading(false);
      return;
    }
    try {
      const { data: view } = await supabase
        .from('user_message_views')
        .select('last_viewed_at')
        .eq('user_id', user.id)
        .maybeSingle();
      const lastViewed = view?.last_viewed_at || '1970-01-01T00:00:00Z';

      const [msgRes, errRes] = await Promise.all([
        supabase
          .from('message_replies')
          .select('id', { count: 'exact', head: true })
          .gt('created_at', lastViewed)
          .neq('user_id', user.id),
        supabase
          .from('error_report_replies')
          .select('id', { count: 'exact', head: true })
          .gt('created_at', lastViewed)
          .neq('user_id', user.id),
      ]);
      setUnreadCount((msgRes.count || 0) + (errRes.count || 0));
    } catch (e) {
      console.error('portal unread count error', e);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async () => {
    if (!user?.id) return;
    try {
      await supabase
        .from('user_message_views')
        .upsert(
          { user_id: user.id, last_viewed_at: new Date().toISOString() },
          { onConflict: 'user_id' },
        );
      setUnreadCount(0);
      // Notify other hook instances (e.g. PortalShell badge) to clear too
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('portal-unread:cleared'));
      }
    } catch (e) {
      console.error('portal markAsRead error', e);
    }
  };

  useEffect(() => {
    if (!user?.id || !isPortalUser) {
      setUnreadCount(0);
      setLoading(false);
      return;
    }
    fetchCount();
    const channel = supabase
      .channel('portal-unread-replies')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_replies' },
        () => fetchCount(),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'error_report_replies' },
        () => fetchCount(),
      )
      .subscribe();
    const onCleared = () => setUnreadCount(0);
    window.addEventListener('portal-unread:cleared', onCleared);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('portal-unread:cleared', onCleared);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isPortalUser]);

  return { unreadCount, loading, markAsRead, refetch: fetchCount };
}