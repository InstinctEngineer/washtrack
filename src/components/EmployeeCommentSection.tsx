import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format, startOfWeek, isSameWeek } from 'date-fns';
import { Send, MessageSquare } from 'lucide-react';

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
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');

  useEffect(() => {
    fetchComments();
  }, [employeeId, weekStartStr]);

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
      setComments(data || []);
    } catch (error: any) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
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
            {isCurrentWeek ? 'This Week\'s Comments' : 'Comments from This Week'}
          </div>
          
          {loading ? (
            <div className="text-sm text-muted-foreground text-center py-4">
              Loading comments...
            </div>
          ) : comments.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4 bg-accent/30 rounded-lg">
              No comments for this week
            </div>
          ) : (
            <div className="space-y-2">
              {comments.map((c) => (
                <div 
                  key={c.id} 
                  className="bg-accent/30 rounded-lg p-3 space-y-1"
                >
                  <p className="text-sm whitespace-pre-wrap">{c.comment_text}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(c.created_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
