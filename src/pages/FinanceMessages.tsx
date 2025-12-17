import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format, startOfWeek, addWeeks, subWeeks, isSameWeek } from 'date-fns';
import { MessageSquare, ChevronLeft, ChevronRight, MapPin, User, Calendar, Search, RefreshCw, Eye } from 'lucide-react';
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

interface Location {
  id: string;
  name: string;
}

export default function FinanceMessages() {
  const { user } = useAuth();
  const [comments, setComments] = useState<EmployeeComment[]>([]);
  const [messageReads, setMessageReads] = useState<Record<string, MessageRead[]>>({});
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
      let query = supabase
        .from('employee_comments')
        .select(`
          *,
          employee:users!employee_comments_employee_id_fkey(id, name, email, employee_id),
          location:locations(id, name)
        `)
        .eq('week_start_date', weekStartStr)
        .order('created_at', { ascending: false });

      if (selectedLocation !== 'all') {
        query = query.eq('location_id', selectedLocation);
      }

      const { data, error } = await query;

      if (error) throw error;
      const commentsData = (data || []) as unknown as EmployeeComment[];
      setComments(commentsData);

      // Fetch message reads for all comments
      if (commentsData.length > 0) {
        const commentIds = commentsData.map(c => c.id);
        const { data: readsData, error: readsError } = await supabase
          .from('message_reads')
          .select(`
            *,
            user:users!message_reads_user_id_fkey(id, name)
          `)
          .in('comment_id', commentIds);

        if (!readsError && readsData) {
          // Group reads by comment_id
          const readsByComment: Record<string, MessageRead[]> = {};
          (readsData as unknown as MessageRead[]).forEach(read => {
            if (!readsByComment[read.comment_id]) {
              readsByComment[read.comment_id] = [];
            }
            readsByComment[read.comment_id].push(read);
          });
          setMessageReads(readsByComment);
        }

        // Mark current user as having read these messages
        if (user?.id) {
          const existingReads = new Set(
            (readsData || [])
              .filter((r: any) => r.user_id === user.id)
              .map((r: any) => r.comment_id)
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
              .select(`
                *,
                user:users!message_reads_user_id_fkey(id, name)
              `)
              .in('comment_id', commentIds);

            if (updatedReads) {
              const updatedReadsByComment: Record<string, MessageRead[]> = {};
              (updatedReads as unknown as MessageRead[]).forEach(read => {
                if (!updatedReadsByComment[read.comment_id]) {
                  updatedReadsByComment[read.comment_id] = [];
                }
                updatedReadsByComment[read.comment_id].push(read);
              });
              setMessageReads(updatedReadsByComment);
            }
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
              Employee Messages
            </h1>
            <p className="text-muted-foreground">
              View messages from employees to finance and management
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
              <div className="space-y-4">
                {filteredComments.map((comment) => {
                  const reads = messageReads[comment.id] || [];
                  return (
                    <div
                      key={comment.id}
                      className="border rounded-lg p-4 space-y-3 hover:bg-accent/30 transition-colors"
                    >
                      {/* Header with context */}
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Badge variant="outline" className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {comment.employee?.name || 'Unknown'}
                        </Badge>
                        {comment.location && (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {comment.location.name}
                          </Badge>
                        )}
                        <Badge variant="outline" className="flex items-center gap-1 bg-primary/5">
                          <Calendar className="h-3 w-3" />
                          Week of {format(new Date(comment.week_start_date + 'T00:00:00'), 'MMM d')}
                        </Badge>
                      </div>

                      {/* Message Content */}
                      <p className="text-sm whitespace-pre-wrap bg-background/50 rounded p-3 border">
                        {comment.comment_text}
                      </p>

                      {/* Footer */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          Employee ID: {comment.employee?.employee_id || 'N/A'}
                        </span>
                        <span>
                          Posted: {format(new Date(comment.created_at), 'MMM d, yyyy h:mm a')}
                        </span>
                      </div>

                      {/* Read By Section */}
                      {reads.length > 0 && (
                        <div className="pt-2 border-t">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              Read by:
                            </span>
                            {reads.map((read) => (
                              <Badge 
                                key={read.id} 
                                variant="outline" 
                                className="text-xs bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
                              >
                                {read.user?.name || 'Unknown'}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
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
