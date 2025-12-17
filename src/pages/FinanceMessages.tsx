import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format, startOfWeek, addWeeks, subWeeks, isSameWeek } from 'date-fns';
import { MessageSquare, ChevronLeft, ChevronRight, ChevronDown, MapPin, User, Calendar, Search, RefreshCw, Eye, Reply, Send } from 'lucide-react';
import { useUnreadMessageCount } from '@/hooks/useUnreadMessageCount';

interface EmployeeComment {
  id: string;
  employee_id: string;
  location_id: string | null;
  comment_text: string;
  week_start_date: string;
  created_at: string;
  employee?: {
    id: string;
    name: string;
    email: string;
    employee_id: string;
  };
  location?: {
    id: string;
    name: string;
  };
}

interface MessageRead {
  id: string;
  comment_id: string;
  user_id: string;
  read_at: string;
  user?: {
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

interface Location {
  id: string;
  name: string;
}

export default function FinanceMessages() {
  const { user } = useAuth();
  const [comments, setComments] = useState<EmployeeComment[]>([]);
  const [messageReads, setMessageReads] = useState<Record<string, MessageRead[]>>({});
  const [messageReplies, setMessageReplies] = useState<Record<string, MessageReply[]>>({});
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [submittingReply, setSubmittingReply] = useState(false);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { markAsRead } = useUnreadMessageCount();

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEnd = format(addWeeks(weekStart, 1), 'yyyy-MM-dd');

  // Mark messages as read when page loads
  useEffect(() => {
    markAsRead();
  }, []);

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    fetchComments();
  }, [weekStartStr, selectedLocation]);

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  const fetchComments = async () => {
    setLoading(true);
    try {
      // Fetch comments WITHOUT user join (views don't support FK joins)
      let query = supabase
        .from('employee_comments')
        .select(`
          *,
          location:locations(id, name)
        `)
        .eq('week_start_date', weekStartStr)
        .order('created_at', { ascending: false });

      if (selectedLocation !== 'all') {
        query = query.eq('location_id', selectedLocation);
      }

      const { data, error } = await query;

      if (error) throw error;
      const rawComments = data || [];

      if (rawComments.length === 0) {
        setComments([]);
        setMessageReads({});
        setMessageReplies({});
        setLoading(false);
        return;
      }

      const commentIds = rawComments.map(c => c.id);

      // Fetch reads and replies WITHOUT user joins
      const [readsResult, repliesResult] = await Promise.all([
        supabase.from('message_reads').select('*').in('comment_id', commentIds),
        supabase.from('message_replies').select('*').in('comment_id', commentIds).order('created_at', { ascending: true })
      ]);

      const rawReads = readsResult.data || [];
      const rawReplies = repliesResult.data || [];

      // Collect all unique user IDs
      const employeeIds = rawComments.map(c => c.employee_id);
      const readUserIds = rawReads.map(r => r.user_id);
      const replyUserIds = rawReplies.map(r => r.user_id);
      const allUserIds = [...new Set([...employeeIds, ...readUserIds, ...replyUserIds])];

      // Fetch all users in a single query from users_safe_view
      const { data: usersData } = await supabase
        .from('users_safe_view')
        .select('id, name, email, employee_id')
        .in('id', allUserIds);

      // Create lookup map
      const usersMap = new Map((usersData || []).map(u => [u.id, u]));

      // Attach employee data to comments
      const commentsWithEmployees: EmployeeComment[] = rawComments.map(comment => ({
        ...comment,
        employee: usersMap.get(comment.employee_id) || undefined,
      }));
      setComments(commentsWithEmployees);

      // Attach user data to reads and group by comment_id
      const readsByComment: Record<string, MessageRead[]> = {};
      rawReads.forEach(read => {
        const readWithUser: MessageRead = {
          ...read,
          user: usersMap.get(read.user_id) || undefined,
        };
        if (!readsByComment[read.comment_id]) {
          readsByComment[read.comment_id] = [];
        }
        readsByComment[read.comment_id].push(readWithUser);
      });
      setMessageReads(readsByComment);

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

      // Mark current user as having read these messages
      if (user?.id) {
        const existingReads = new Set(
          rawReads
            .filter(r => r.user_id === user.id)
            .map(r => r.comment_id)
        );

        const unreadCommentIds = commentIds.filter(id => !existingReads.has(id));
        
        if (unreadCommentIds.length > 0) {
          const readRecords = unreadCommentIds.map(comment_id => ({
            comment_id,
            user_id: user.id,
          }));

          await supabase.from('message_reads').insert(readRecords);
          
          // Refetch reads to update UI
          const { data: updatedReads } = await supabase
            .from('message_reads')
            .select('*')
            .in('comment_id', commentIds);

          if (updatedReads) {
            // Re-fetch the current user's name for the new reads
            const currentUser = usersMap.get(user.id);
            const updatedReadsByComment: Record<string, MessageRead[]> = {};
            updatedReads.forEach(read => {
              const readWithUser: MessageRead = {
                ...read,
                user: usersMap.get(read.user_id) || currentUser || undefined,
              };
              if (!updatedReadsByComment[read.comment_id]) {
                updatedReadsByComment[read.comment_id] = [];
              }
              updatedReadsByComment[read.comment_id].push(readWithUser);
            });
            setMessageReads(updatedReadsByComment);
          }
        }
      }
    } catch (error: any) {
      console.error('Error fetching comments:', error);
      toast({
        title: 'Error',
        description: 'Failed to load messages',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReply = async (commentId: string) => {
    const replyText = replyInputs[commentId]?.trim();
    if (!replyText || !user?.id) return;

    setSubmittingReply(true);
    try {
      const { error } = await supabase
        .from('message_replies')
        .insert({
          comment_id: commentId,
          user_id: user.id,
          reply_text: replyText,
        });

      if (error) throw error;

      toast({
        title: 'Reply Sent',
        description: 'Your reply has been sent to the employee.',
      });

      // Clear input and close reply box
      setReplyInputs(prev => ({ ...prev, [commentId]: '' }));
      setReplyingTo(null);
      
      // Refresh comments to show new reply
      fetchComments();
    } catch (error: any) {
      console.error('Error sending reply:', error);
      toast({
        title: 'Error',
        description: 'Failed to send reply. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmittingReply(false);
    }
  };

  const filteredComments = comments.filter(comment => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      comment.comment_text.toLowerCase().includes(query) ||
      comment.employee?.name?.toLowerCase().includes(query) ||
      comment.location?.name?.toLowerCase().includes(query)
    );
  });

  const isCurrentWeek = isSameWeek(currentWeek, new Date(), { weekStartsOn: 1 });

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageSquare className="h-6 w-6" />
              Messages
            </h1>
            <p className="text-muted-foreground">
              Messages from employees to finance and management
            </p>
          </div>
          <Button variant="outline" onClick={fetchComments} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
              {/* Week Navigation */}
              <div className="flex items-center gap-2">
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

              {/* Location Filter */}
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Search */}
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Messages List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              Messages
              <Badge variant="secondary" className="ml-2">
                {filteredComments.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              {isCurrentWeek ? "This week's messages from employees" : `Messages from week of ${format(weekStart, 'MMM d, yyyy')}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading messages...
              </div>
            ) : filteredComments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground bg-accent/30 rounded-lg">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No messages for this week</p>
                {selectedLocation !== 'all' && (
                  <p className="text-sm mt-1">Try selecting "All Locations"</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredComments.map((comment, index) => {
                  const reads = messageReads[comment.id] || [];
                  const replies = messageReplies[comment.id] || [];
                  const isReplying = replyingTo === comment.id;
                  const isExpanded = expandedMessages.has(comment.id);
                  const previewText = comment.comment_text.length > 80 
                    ? comment.comment_text.substring(0, 80) + '...' 
                    : comment.comment_text;
                  
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
                      <div className={`border rounded-lg transition-colors ${
                        index % 2 === 0 ? 'bg-card' : 'bg-muted/30'
                      } ${isExpanded ? 'ring-1 ring-primary/20' : ''}`}>
                        {/* Collapsed Header - Always Visible */}
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-accent/50 transition-colors">
                            <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">
                                  {comment.employee?.name || 'Unknown'}
                                </span>
                                {comment.location && (
                                  <Badge variant="secondary" className="text-xs px-1.5 py-0">
                                    {comment.location.name}
                                  </Badge>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(comment.created_at), 'MMM d, h:mm a')}
                                </span>
                                {replies.length > 0 && (
                                  <Badge variant="outline" className="text-xs px-1.5 py-0 bg-primary/10">
                                    {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                                  </Badge>
                                )}
                              </div>
                              
                              {/* Preview text when collapsed */}
                              {!isExpanded && (
                                <p className="text-sm text-muted-foreground truncate mt-0.5">
                                  {previewText}
                                </p>
                              )}
                            </div>

                            {/* Read indicator */}
                            {reads.length > 0 && (
                              <div className="flex items-center gap-1 shrink-0">
                                <Eye className="h-3 w-3 text-green-600" />
                                <span className="text-xs text-green-600">{reads.length}</span>
                              </div>
                            )}
                          </div>
                        </CollapsibleTrigger>

                        {/* Expanded Content */}
                        <CollapsibleContent>
                          <div className="px-3 pb-3 pt-0 space-y-3 border-t">
                            {/* Full Message Content */}
                            <p className="text-sm whitespace-pre-wrap pt-3">
                              {comment.comment_text}
                            </p>

                            {/* Employee ID */}
                            <div className="text-xs text-muted-foreground">
                              Employee ID: {comment.employee?.employee_id || 'N/A'}
                            </div>

                            {/* Existing Replies */}
                            {replies.length > 0 && (
                              <div className="space-y-2">
                                {replies.map((reply) => (
                                  <div 
                                    key={reply.id} 
                                    className="bg-primary/5 border-l-2 border-primary rounded p-2 space-y-1"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs text-primary font-medium flex items-center gap-1">
                                        <Reply className="h-3 w-3" />
                                        {reply.user?.name || 'Finance Team'}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {format(new Date(reply.created_at), 'MMM d, h:mm a')}
                                      </span>
                                    </div>
                                    <p className="text-sm whitespace-pre-wrap">{reply.reply_text}</p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Reply Input */}
                            {isReplying ? (
                              <div className="space-y-2">
                                <Textarea
                                  placeholder="Type your reply..."
                                  value={replyInputs[comment.id] || ''}
                                  onChange={(e) => setReplyInputs(prev => ({ ...prev, [comment.id]: e.target.value }))}
                                  className="min-h-[60px] resize-none text-sm"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleSubmitReply(comment.id)}
                                    disabled={submittingReply || !replyInputs[comment.id]?.trim()}
                                  >
                                    <Send className="h-3 w-3 mr-1" />
                                    {submittingReply ? 'Sending...' : 'Send'}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setReplyingTo(null)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between pt-2 border-t">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setReplyingTo(comment.id);
                                  }}
                                >
                                  <Reply className="h-3 w-3 mr-1" />
                                  Reply
                                </Button>

                                {/* Read By Section */}
                                {reads.length > 0 && (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs text-muted-foreground">Read by:</span>
                                    {reads.map((read) => (
                                      <Badge 
                                        key={read.id} 
                                        variant="outline" 
                                        className="text-xs px-1.5 py-0 bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
                                      >
                                        {read.user?.name || 'Unknown'}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
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
