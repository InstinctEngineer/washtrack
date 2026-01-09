import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { format, startOfWeek, addWeeks, subWeeks, isSameWeek } from 'date-fns';
import { MessageSquare, ChevronLeft, ChevronRight, ChevronDown, MapPin, Calendar, RefreshCw, Send, ArrowLeft } from 'lucide-react';

interface EmployeeComment {
  id: string;
  employee_id: string;
  location_id: string | null;
  comment_text: string;
  week_start_date: string;
  created_at: string;
  work_log_ids: string[] | null;
  location?: {
    id: string;
    name: string;
  };
}

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

export default function EmployeeMessages() {
  const { user, userLocations } = useAuth();
  const navigate = useNavigate();
  const [comments, setComments] = useState<EmployeeComment[]>([]);
  const [messageReplies, setMessageReplies] = useState<Record<string, MessageReply[]>>({});
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  
  // New message state
  const [newMessage, setNewMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');

  // Fetch user's locations
  useEffect(() => {
    const fetchLocations = async () => {
      if (!userLocations || userLocations.length === 0) return;

      const { data } = await supabase
        .from('locations')
        .select('id, name')
        .in('id', userLocations)
        .eq('is_active', true)
        .order('name');

      if (data) {
        setLocations(data);
        if (data.length > 0) {
          setSelectedLocationId(data[0].id);
        }
      }
    };

    fetchLocations();
  }, [userLocations]);

  // Fetch employee's comments for current week
  useEffect(() => {
    if (user?.id) {
      fetchComments();
    }
  }, [weekStartStr, user?.id]);

  const fetchComments = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      // Fetch only this employee's comments
      const { data, error } = await supabase
        .from('employee_comments')
        .select('*')
        .eq('employee_id', user.id)
        .eq('week_start_date', weekStartStr)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const rawComments = data || [];

      if (rawComments.length === 0) {
        setComments([]);
        setMessageReplies({});
        setLoading(false);
        return;
      }

      const commentIds = rawComments.map(c => c.id);
      const locationIds = [...new Set(rawComments.map(c => c.location_id).filter(Boolean))];

      // Fetch locations and replies in parallel
      const [locationsResult, repliesResult] = await Promise.all([
        locationIds.length > 0 
          ? supabase.from('locations').select('id, name').in('id', locationIds)
          : { data: [] },
        supabase.from('message_replies').select('*').in('comment_id', commentIds).order('created_at', { ascending: true })
      ]);

      const locationsMap = new Map((locationsResult.data || []).map(l => [l.id, l]));
      const rawReplies = repliesResult.data || [];

      // Fetch user info for replies
      const replyUserIds = [...new Set(rawReplies.map(r => r.user_id))];
      let usersMap = new Map();
      
      if (replyUserIds.length > 0) {
        const { data: usersData } = await supabase
          .from('users_safe_view')
          .select('id, name')
          .in('id', replyUserIds);
        usersMap = new Map((usersData || []).map(u => [u.id, u]));
      }

      // Attach location data to comments
      const commentsWithData: EmployeeComment[] = rawComments.map(comment => ({
        ...comment,
        location: comment.location_id ? locationsMap.get(comment.location_id) : undefined,
      }));
      setComments(commentsWithData);

      // Attach user data to replies and group by comment_id
      const repliesByComment: Record<string, MessageReply[]> = {};
      rawReplies.forEach(reply => {
        const replyWithUser: MessageReply = {
          ...reply,
          user: usersMap.get(reply.user_id) || undefined,
        };
        if (!repliesByComment[reply.comment_id]) {
          repliesByComment[reply.comment_id] = [];
        }
        repliesByComment[reply.comment_id].push(replyWithUser);
      });
      setMessageReplies(repliesByComment);
    } catch (error: any) {
      console.error('Error fetching comments:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!user?.id || !newMessage.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('employee_comments').insert({
        employee_id: user.id,
        location_id: selectedLocationId || null,
        comment_text: newMessage.trim(),
        week_start_date: format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      });

      if (error) throw error;

      toast.success('Message sent to office');
      setNewMessage('');
      fetchComments();
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSubmitting(false);
    }
  };

  const isCurrentWeek = isSameWeek(currentWeek, new Date(), { weekStartsOn: 1 });

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/employee/dashboard')}
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <MessageSquare className="h-6 w-6" />
                My Messages
              </h1>
              <p className="text-muted-foreground">
                Your conversations with the office team
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={fetchComments} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Week Navigation */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentWeek(prev => subWeeks(prev, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-center min-w-[180px]">
                <div className="font-medium">
                  {isCurrentWeek ? 'This Week' : format(weekStart, 'MMM d') + ' - ' + format(addWeeks(weekStart, 1), 'MMM d')}
                </div>
                <div className="text-xs text-muted-foreground">
                  Week of {format(weekStart, 'MMM d, yyyy')}
                </div>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentWeek(prev => addWeeks(prev, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              {!isCurrentWeek && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentWeek(new Date())}
                >
                  Today
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* New Message Form - Only show for current week */}
        {isCurrentWeek && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Send className="h-4 w-4" />
                Send New Message
              </CardTitle>
              <CardDescription>
                Send a message to the office team
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {locations.length > 1 && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <select
                    value={selectedLocationId}
                    onChange={(e) => setSelectedLocationId(e.target.value)}
                    className="flex h-9 w-full max-w-[200px] rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <Textarea
                placeholder="Type your message here..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="min-h-[80px] resize-none"
              />
              <div className="flex justify-end">
                <Button 
                  onClick={handleSendMessage} 
                  disabled={submitting || !newMessage.trim()}
                >
                  {submitting ? 'Sending...' : 'Send Message'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Conversations List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              Conversations
              <Badge variant="secondary" className="ml-2">
                {comments.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              {isCurrentWeek ? "This week's messages and replies" : `Messages from week of ${format(weekStart, 'MMM d, yyyy')}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading messages...
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground bg-accent/30 rounded-lg">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No messages for this week</p>
                {isCurrentWeek && (
                  <p className="text-sm mt-1">Send a message using the form above</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {comments.map((comment) => {
                  const replies = messageReplies[comment.id] || [];
                  const isExpanded = expandedMessages.has(comment.id);
                  const hasReplies = replies.length > 0;
                  
                  const toggleExpanded = () => {
                    setExpandedMessages(prev => {
                      const newSet = new Set(prev);
                      if (newSet.has(comment.id)) {
                        newSet.delete(comment.id);
                      } else {
                        newSet.add(comment.id);
                      }
                      return newSet;
                    });
                  };

                  return (
                    <Collapsible
                      key={comment.id}
                      open={isExpanded}
                      onOpenChange={toggleExpanded}
                    >
                      <div className={`border rounded-lg transition-colors ${isExpanded ? 'ring-1 ring-primary/20' : ''}`}>
                        {/* Message Header */}
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-accent/50 transition-colors">
                            <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">You</span>
                                {comment.location && (
                                  <Badge variant="secondary" className="text-xs px-1.5 py-0">
                                    {comment.location.name}
                                  </Badge>
                                )}
                                {hasReplies && (
                                  <Badge variant="outline" className="text-xs px-1.5 py-0 bg-green-500/10 text-green-700 border-green-200">
                                    {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground truncate mt-0.5">
                                {comment.comment_text.length > 60 
                                  ? comment.comment_text.substring(0, 60) + '...' 
                                  : comment.comment_text}
                              </p>
                            </div>
                            
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(comment.created_at), 'MMM d, h:mm a')}
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        
                        {/* Expanded Content */}
                        <CollapsibleContent>
                          <div className="border-t px-4 py-3 space-y-3">
                            {/* Full Message */}
                            <div className="bg-accent/30 rounded-lg p-3">
                              <p className="text-sm whitespace-pre-wrap">{comment.comment_text}</p>
                              {comment.work_log_ids && comment.work_log_ids.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-2">
                                  📎 Linked to {comment.work_log_ids.length} work {comment.work_log_ids.length === 1 ? 'item' : 'items'}
                                </p>
                              )}
                            </div>
                            
                            {/* Replies */}
                            {hasReplies ? (
                              <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">Replies from Office:</p>
                                {replies.map((reply) => (
                                  <div 
                                    key={reply.id} 
                                    className="ml-4 bg-primary/10 border-l-2 border-primary rounded-lg p-3"
                                  >
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-xs font-medium text-primary">
                                        {reply.user?.name || 'Office Team'}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {format(new Date(reply.created_at), 'MMM d, h:mm a')}
                                      </span>
                                    </div>
                                    <p className="text-sm whitespace-pre-wrap">{reply.reply_text}</p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground italic">No reply yet</p>
                            )}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
