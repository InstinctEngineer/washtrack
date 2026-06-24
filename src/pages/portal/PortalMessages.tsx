import { useEffect, useState } from 'react';
import { PortalShell } from '@/components/PortalShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, startOfWeek } from 'date-fns';
import { MapPin, MessageSquare, Send, ChevronDown, Calendar, Reply, RefreshCw } from 'lucide-react';
import { MyErrorReports } from '@/components/MyErrorReports';
import { usePortalUnreadCount } from '@/hooks/usePortalUnreadCount';

interface PortalLocation {
  location_id: string;
  location_name: string;
  client_name: string;
}

interface Message {
  id: string;
  employee_id: string;
  location_id: string | null;
  comment_text: string;
  created_at: string;
  location_name?: string;
}

interface ReplyRow {
  id: string;
  comment_id: string;
  user_id: string;
  reply_text: string;
  created_at: string;
  user_name?: string;
}

export default function PortalMessages() {
  const { user } = useAuth();
  const { markAsRead } = usePortalUnreadCount();
  const [locations, setLocations] = useState<PortalLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [repliesByComment, setRepliesByComment] = useState<Record<string, ReplyRow[]>>({});
  const [newMessage, setNewMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [sendingReplyFor, setSendingReplyFor] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc('get_portal_my_locations');
      const locs = (data as PortalLocation[]) || [];
      setLocations(locs);
      if (locs.length > 0) setSelectedLocationId(locs[0].location_id);
    })();
  }, []);

  const fetchMessages = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data: comments, error } = await supabase
        .from('employee_comments')
        .select('id, employee_id, location_id, comment_text, created_at')
        .eq('employee_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      const list = comments || [];
      const locMap = new Map(locations.map(l => [l.location_id, l.location_name]));
      const enriched: Message[] = list.map(m => ({
        ...m,
        location_name: m.location_id ? locMap.get(m.location_id) : undefined,
      }));
      setMessages(enriched);

      const ids = list.map(m => m.id);
      if (ids.length > 0) {
        const { data: replies } = await supabase
          .from('message_replies')
          .select('*')
          .in('comment_id', ids)
          .order('created_at', { ascending: true });
        const rs = replies || [];
        const userIds = [...new Set(rs.map(r => r.user_id))];
        let nameMap = new Map<string, string>();
        if (userIds.length > 0) {
          const { data: users } = await supabase.rpc('get_user_display_info', { user_ids: userIds });
          nameMap = new Map((users || []).map((u: any) => [u.id, u.name]));
        }
        const grouped: Record<string, ReplyRow[]> = {};
        rs.forEach(r => {
          (grouped[r.comment_id] ||= []).push({ ...r, user_name: nameMap.get(r.user_id) || 'Office Team' });
        });
        setRepliesByComment(grouped);
      } else {
        setRepliesByComment({});
      }
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id && locations.length >= 0) fetchMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, locations.length]);

  // Clear unread marker when portal user opens the messages page
  useEffect(() => {
    if (user?.id) markAsRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleSend = async () => {
    if (!user?.id || !newMessage.trim() || !selectedLocationId) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('employee_comments').insert({
        employee_id: user.id,
        location_id: selectedLocationId,
        comment_text: newMessage.trim(),
        week_start_date: format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      });
      if (error) throw error;
      toast.success('Message sent to the office team');
      setNewMessage('');
      fetchMessages();
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to send message');
    } finally {
      setSubmitting(false);
    }
  };

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleSendReply = async (commentId: string) => {
    if (!user?.id) return;
    const text = (replyDrafts[commentId] || '').trim();
    if (!text) return;
    setSendingReplyFor(commentId);
    try {
      const { error } = await supabase.from('message_replies').insert({
        comment_id: commentId,
        user_id: user.id,
        reply_text: text,
      });
      if (error) throw error;
      setReplyDrafts(prev => ({ ...prev, [commentId]: '' }));
      toast.success('Reply sent');
      fetchMessages();
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to send reply');
    } finally {
      setSendingReplyFor(null);
    }
  };

  return (
    <PortalShell title="Messages">
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Send className="h-4 w-4" /> New Message
            </CardTitle>
            <CardDescription>Send a message to the ES&D office team</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {locations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                You need access to at least one location before you can send messages.
              </p>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                    <SelectTrigger className="w-full max-w-sm">
                      <SelectValue placeholder="Select a location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map(l => (
                        <SelectItem key={l.location_id} value={l.location_id}>
                          {l.location_name} — {l.client_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  placeholder="Type your message…"
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  className="min-h-[100px] resize-none"
                />
                <div className="flex justify-end">
                  <Button onClick={handleSend} disabled={submitting || !newMessage.trim() || !selectedLocationId}>
                    {submitting ? 'Sending…' : 'Send Message'}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <MyErrorReports />

        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> My Conversations
                <Badge variant="secondary" className="ml-2">{messages.length}</Badge>
              </CardTitle>
              <CardDescription>Messages you've sent and replies from the office</CardDescription>
            </div>
            <Button variant="outline" size="icon" onClick={fetchMessages} disabled={loading} title="Refresh">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading…</div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground bg-accent/30 rounded-lg">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No messages yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {messages.map((m, idx) => {
                  const replies = repliesByComment[m.id] || [];
                  const isOpen = expanded.has(m.id);
                  return (
                    <Collapsible key={m.id} open={isOpen} onOpenChange={() => toggle(m.id)}>
                      <div className={`border rounded-lg ${idx % 2 === 0 ? 'bg-card' : 'bg-muted/30'} ${isOpen ? 'ring-1 ring-primary/20' : ''}`}>
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-accent/50 transition-colors">
                            <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">You</span>
                                {m.location_name && (
                                  <Badge variant="secondary" className="text-xs px-1.5 py-0">{m.location_name}</Badge>
                                )}
                                {replies.length > 0 && (
                                  <Badge variant="outline" className="text-xs px-1.5 py-0 bg-green-500/10 text-green-700 border-green-200">
                                    {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground truncate mt-0.5">
                                {m.comment_text.length > 60 ? m.comment_text.slice(0, 60) + '…' : m.comment_text}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(m.created_at), 'MMM d, h:mm a')}
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="border-t px-4 py-3 space-y-3">
                            <div className="bg-accent/30 rounded-lg p-3">
                              <p className="text-sm whitespace-pre-wrap">{m.comment_text}</p>
                            </div>
                            {replies.length > 0 ? (
                              <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">Replies from Office:</p>
                                {replies.map(r => (
                                  <div
                                    key={r.id}
                                    className={`rounded-lg p-3 border-l-2 ${
                                      r.user_id === user?.id
                                        ? 'bg-muted/40 border-muted-foreground/40'
                                        : 'bg-primary/5 border-primary'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 mb-1">
                                      <Reply className="h-3 w-3 text-primary" />
                                      <span className="text-xs font-medium text-primary">
                                        {r.user_id === user?.id ? 'You' : r.user_name}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {format(new Date(r.created_at), 'MMM d, h:mm a')}
                                      </span>
                                    </div>
                                    <p className="text-sm whitespace-pre-wrap">{r.reply_text}</p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground italic">No reply yet</p>
                            )}

                            {/* Reply composer */}
                            <div className="pt-2 border-t flex items-end gap-2">
                              <Textarea
                                placeholder="Write a reply…"
                                value={replyDrafts[m.id] || ''}
                                onChange={e =>
                                  setReplyDrafts(prev => ({ ...prev, [m.id]: e.target.value }))
                                }
                                rows={2}
                                className="resize-none text-sm"
                              />
                              <Button
                                size="sm"
                                onClick={() => handleSendReply(m.id)}
                                disabled={
                                  sendingReplyFor === m.id || !(replyDrafts[m.id] || '').trim()
                                }
                                className="gap-1.5"
                              >
                                <Send className="h-3.5 w-3.5" />
                                {sendingReplyFor === m.id ? 'Sending…' : 'Reply'}
                              </Button>
                            </div>
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
    </PortalShell>
  );
}