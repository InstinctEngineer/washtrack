import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format, startOfWeek, isSameWeek } from 'date-fns';
import { Send, MessageSquare, Reply } from 'lucide-react';

interface MessageReply {
  id: string;
  comment_id: string;
  user_id: string;
  reply_text: string;
  created_at: string;
  user?: {
    id: string;
    name: string;
  };
}

interface EmployeeComment {
  id: string;
  employee_id: string;
  comment_text: string;
  week_start_date: string;
  created_at: string;
}

interface EmployeeCommentSectionProps {
  employeeId: string;
  locationId: string | null;
  currentWeek: Date;
}

export function EmployeeCommentSection({ 
  employeeId, 
  locationId, 
  currentWeek 
}: EmployeeCommentSectionProps) {
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState<EmployeeComment[]>([]);
  const [replies, setReplies] = useState<Record<string, MessageReply[]>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');

  useEffect(() => {
    fetchComments();
  }, [employeeId, weekStartStr]);

  // Subscribe to realtime replies
  useEffect(() => {
    if (comments.length === 0) return;

    const commentIds = comments.map(c => c.id);
    
    const channel = supabase
      .channel('employee-replies')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_replies',
        },
        (payload) => {
          const newReply = payload.new as MessageReply;
          if (commentIds.includes(newReply.comment_id)) {
            // Fetch the reply with user info
            fetchReplies(commentIds);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [comments]);

  const fetchComments = async () => {
    if (!employeeId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('employee_comments')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('week_start_date', weekStartStr)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const commentsData = data || [];
      setComments(commentsData);

      // Fetch replies for all comments
      if (commentsData.length > 0) {
        await fetchReplies(commentsData.map(c => c.id));
      }
    } catch (error: any) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReplies = async (commentIds: string[]) => {
    try {
      const { data, error } = await supabase
        .from('message_replies')
        .select(`
          *,
          user:users!message_replies_user_id_fkey(id, name)
        `)
        .in('comment_id', commentIds)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group replies by comment_id
      const repliesByComment: Record<string, MessageReply[]> = {};
      (data || []).forEach((reply: any) => {
        if (!repliesByComment[reply.comment_id]) {
          repliesByComment[reply.comment_id] = [];
        }
        repliesByComment[reply.comment_id].push(reply as MessageReply);
      });
      setReplies(repliesByComment);
    } catch (error) {
      console.error('Error fetching replies:', error);
    }
  };

  const handleSubmit = async () => {
    if (!comment.trim()) {
      toast({
        title: 'Empty Comment',
        description: 'Please enter a comment before posting.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('employee_comments')
        .insert({
          employee_id: employeeId,
          location_id: locationId,
          comment_text: comment.trim(),
          week_start_date: weekStartStr,
        });

      if (error) throw error;

      toast({
        title: 'Comment Posted',
        description: 'Your message has been sent to the management team.',
      });
      
      setComment('');
      fetchComments();
    } catch (error: any) {
      console.error('Error posting comment:', error);
      toast({
        title: 'Error',
        description: 'Failed to post comment. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isCurrentWeek = isSameWeek(currentWeek, new Date(), { weekStartsOn: 1 });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Message to Finance/Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Comment Input - only show for current week */}
        {isCurrentWeek && (
          <div className="space-y-2">
            <Textarea
              placeholder="Type your message here... (e.g., equipment issues, schedule changes, questions)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[80px] resize-none"
            />
            <Button 
              onClick={handleSubmit} 
              disabled={submitting || !comment.trim()}
              className="w-full"
            >
              <Send className="h-4 w-4 mr-2" />
              {submitting ? 'Posting...' : 'Post Comment'}
            </Button>
          </div>
        )}

        {/* Comment History */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">
            {isCurrentWeek ? 'This Week\'s Messages' : 'Messages from This Week'}
          </div>
          
          {loading ? (
            <div className="text-sm text-muted-foreground text-center py-4">
              Loading messages...
            </div>
          ) : comments.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4 bg-accent/30 rounded-lg">
              No messages for this week
            </div>
          ) : (
            <div className="space-y-3">
              {comments.map((c) => {
                const commentReplies = replies[c.id] || [];
                return (
                  <div key={c.id} className="space-y-2">
                    {/* Original comment */}
                    <div className="bg-accent/30 rounded-lg p-3 space-y-1">
                      <p className="text-sm whitespace-pre-wrap">{c.comment_text}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(c.created_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                    
                    {/* Replies */}
                    {commentReplies.length > 0 && (
                      <div className="ml-4 space-y-2">
                        {commentReplies.map((reply) => (
                          <div 
                            key={reply.id} 
                            className="bg-primary/10 border-l-2 border-primary rounded-lg p-3 space-y-1"
                          >
                            <div className="flex items-center gap-2 text-xs text-primary font-medium">
                              <Reply className="h-3 w-3" />
                              {reply.user?.name || 'Finance Team'}
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{reply.reply_text}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(reply.created_at), 'MMM d, yyyy h:mm a')}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
