import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertTriangle, ChevronDown, CheckCircle2, Clock, MessageSquare, Send, Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface ErrorReport {
  id: string;
  description: string;
  page_url: string | null;
  status: string;
  created_at: string;
  admin_response: string | null;
  responded_at: string | null;
}

interface ReportReply {
  id: string;
  report_id: string;
  user_id: string;
  body: string;
  created_at: string;
  user_name?: string;
}

export function MyErrorReports() {
  const { user } = useAuth();
  const [reports, setReports] = useState<ErrorReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [repliesByReport, setRepliesByReport] = useState<Record<string, ReportReply[]>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [sendingFor, setSendingFor] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const fetchReports = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('error_reports')
        .select('id, description, page_url, status, created_at, admin_response, responded_at')
        .eq('reported_by', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setReports(data);
        const ids = data.map(r => r.id);
        if (ids.length > 0) {
          const { data: replies } = await supabase
            .from('error_report_replies')
            .select('*')
            .in('report_id', ids)
            .order('created_at', { ascending: true });
          if (replies && replies.length > 0) {
            const userIds = [...new Set(replies.map(r => r.user_id))];
            const { data: users } = await supabase.rpc('get_user_display_info', { user_ids: userIds });
            const nameMap = new Map((users || []).map((u: any) => [u.id, u.name]));
            const grouped: Record<string, ReportReply[]> = {};
            replies.forEach(r => {
              const enriched = { ...r, user_name: nameMap.get(r.user_id) || 'Unknown' };
              (grouped[r.report_id] ||= []).push(enriched);
            });
            setRepliesByReport(grouped);
          } else {
            setRepliesByReport({});
          }
        }
      }
      setLoading(false);
    };

    fetchReports();
  }, [user?.id]);

  const sendReply = async (reportId: string) => {
    if (!user?.id) return;
    const text = (replyDrafts[reportId] || '').trim();
    if (!text) return;
    setSendingFor(reportId);
    try {
      const { data, error } = await supabase
        .from('error_report_replies')
        .insert({ report_id: reportId, user_id: user.id, body: text })
        .select('*')
        .single();
      if (error) throw error;
      const { data: users } = await supabase.rpc('get_user_display_info', { user_ids: [user.id] });
      const name = (users || []).find((u: any) => u.id === user.id)?.name || 'You';
      setRepliesByReport(prev => ({
        ...prev,
        [reportId]: [...(prev[reportId] || []), { ...(data as any), user_name: name }],
      }));
      setReplyDrafts(prev => ({ ...prev, [reportId]: '' }));
    } catch (err: any) {
      toast({ title: 'Failed to send reply', description: err.message, variant: 'destructive' });
    } finally {
      setSendingFor(null);
    }
  };

  if (loading && reports.length === 0) return null;
  if (reports.length === 0) return null;

  const openCount = reports.filter(r => r.status === 'open').length;
  const resolvedCount = reports.filter(r => r.status === 'resolved').length;

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <div>
                  <CardTitle className="text-base">My Error Reports</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Track the status of issues you've reported
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {openCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {openCount} open
                  </Badge>
                )}
                {resolvedCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {resolvedCount} resolved
                  </Badge>
                )}
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            {reports.map((report) => (
              <div
                key={report.id}
                className={`flex items-start gap-3 rounded-lg border p-3 ${
                  report.status === 'open' ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-muted/30'
                }`}
              >
                {report.status === 'resolved' ? (
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />
                ) : (
                  <Clock className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug">{report.description}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                    <span>{format(new Date(report.created_at), 'MMM d, h:mm a')}</span>
                    {report.page_url && (
                      <>
                        <span>·</span>
                        <span className="truncate">{report.page_url}</span>
                      </>
                    )}
                  </div>
                  {report.admin_response && (
                    <div className="mt-2 rounded-md border border-primary/20 bg-primary/5 p-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-primary mb-1">
                        <MessageSquare className="h-3 w-3" />
                        Admin response
                        {report.responded_at && (
                          <span className="font-normal text-muted-foreground">
                            · {format(new Date(report.responded_at), 'MMM d, h:mm a')}
                          </span>
                        )}
                      </div>
                      <p className="text-sm whitespace-pre-wrap leading-snug">{report.admin_response}</p>
                    </div>
                  )}
                  {(repliesByReport[report.id] || []).length > 0 && (
                    <div className="mt-2 space-y-2">
                      {repliesByReport[report.id].map(r => (
                        <div
                          key={r.id}
                          className={`rounded-md border p-2.5 ${
                            r.user_id === user?.id ? 'bg-muted/50' : 'border-primary/20 bg-primary/5'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span className="font-medium text-foreground">
                              {r.user_id === user?.id ? 'You' : r.user_name}
                            </span>
                            <span>{format(new Date(r.created_at), 'MMM d, h:mm a')}</span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap leading-snug">{r.body}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex items-end gap-2">
                    <Textarea
                      value={replyDrafts[report.id] || ''}
                      onChange={(e) =>
                        setReplyDrafts(prev => ({ ...prev, [report.id]: e.target.value }))
                      }
                      placeholder="Reply…"
                      rows={2}
                      className="resize-none text-sm"
                    />
                    <Button
                      size="sm"
                      onClick={() => sendReply(report.id)}
                      disabled={sendingFor === report.id || !(replyDrafts[report.id] || '').trim()}
                      className="gap-1.5"
                    >
                      {sendingFor === report.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      Reply
                    </Button>
                  </div>
                </div>
                <Badge
                  variant={report.status === 'open' ? 'destructive' : 'secondary'}
                  className="shrink-0 text-xs"
                >
                  {report.status === 'resolved' ? 'Resolved' : 'Open'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
