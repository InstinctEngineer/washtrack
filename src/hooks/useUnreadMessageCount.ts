import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useUnreadMessageCount() {
  const { user, userRole } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchUnreadCount = async () => {
    if (!user?.id || !userRole || !['finance', 'admin', 'super_admin'].includes(userRole)) {
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      // Get user's last viewed timestamp
      const { data: viewData } = await supabase
        .from('user_message_views')
        .select('last_viewed_at')
        .eq('user_id', user.id)
        .single();

      const lastViewed = viewData?.last_viewed_at || '1970-01-01T00:00:00Z';

      // Count messages created after last viewed
      const { count, error } = await supabase
        .from('employee_comments')
        .select('*', { count: 'exact', head: true })
        .gt('created_at', lastViewed);

      if (error) throw error;
      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async () => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('user_message_views')
        .upsert({
          user_id: user.id,
          last_viewed_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (error) throw error;
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  useEffect(() => {
    fetchUnreadCount();

    // Subscribe to new messages in real-time
    const channel = supabase
      .channel('employee-comments-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'employee_comments',
        },
        () => {
          // Increment count when new message arrives
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, userRole]);

  return { unreadCount, loading, markAsRead, refetch: fetchUnreadCount };
}
