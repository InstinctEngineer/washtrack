import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Link } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, MapPin, Settings, Building2, AlertTriangle, Send, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentCutoff } from '@/lib/cutoff';
import { format } from 'date-fns';
import { ErrorScreenshotViewer } from '@/components/ErrorScreenshotViewer';
import { toast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableTableHead } from '@/components/SortableTableHead';

interface ErrorReport {
  id: string;
  reported_by: string;
  description: string;
  screenshot_url: string | null;
  page_url: string | null;
  status: string;
  created_at: string;
  reporter_name?: string;
  admin_response?: string | null;
  responded_at?: string | null;
  responded_by?: string | null;
}

interface ErrorReportReply {
  id: string;
  report_id: string;
  user_id: string;
  body: string;
  created_at: string;
  user_name?: string;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    activeUsers: 0,
    totalUsers: 0,
    activeClients: 0,
    activeLocations: 0,
    openReports: 0,
  });
  const [cutoffDate, setCutoffDate] = useState<Date | null>(null);
  const [errorReports, setErrorReports] = useState<ErrorReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ErrorReport | null>(null);
  const [responseText, setResponseText] = useState('');
  const [sendingResponse, setSendingResponse] = useState(false);
  const [replies, setReplies] = useState<ErrorReportReply[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);

  useEffect(() => {
    setResponseText(selectedReport?.admin_response || '');
    setReplyText('');
    if (!selectedReport?.id) {
      setReplies([]);
      return;
    }
    const loadReplies = async () => {
      setLoadingReplies(true);
      const { data, error } = await supabase
        .from('error_report_replies')
        .select('*')
        .eq('report_id', selectedReport.id)
        .order('created_at', { ascending: true });
      if (!error && data) {
        const userIds = [...new Set(data.map(r => r.user_id))];
        const { data: users } = await supabase.rpc('get_user_display_info', { user_ids: userIds });
        const nameMap = new Map((users || []).map((u: any) => [u.id, u.name]));
        setReplies(data.map(r => ({ ...r, user_name: nameMap.get(r.user_id) || 'Unknown' })));
      } else {
        setReplies([]);
      }
      setLoadingReplies(false);
    };
    loadReplies();
  }, [selectedReport?.id]);

  const { sortedData: displayedReports, sortColumn, sortDirection, handleSort } = useTableSort<ErrorReport>(
    errorReports,
    {
      initialColumn: 'created_at',
      initialDirection: 'desc',
      getValue: (r, col) => (col === 'created_at' ? new Date(r.created_at) : (r as any)[col]),
    }
  );

  const fetchErrorReports = async () => {
    setLoadingReports(true);
    try {
      const { data: reports, error } = await supabase
        .from('error_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get reporter names from users table
      if (reports && reports.length > 0) {
        const userIds = [...new Set(reports.map(r => r.reported_by))];
        const { data: users } = await supabase
          .from('users')
          .select('id, name')
          .in('id', userIds);

        const userMap = new Map(users?.map(u => [u.id, u.name]) || []);
        const enriched = reports.map(r => ({
          ...r,
          reporter_name: userMap.get(r.reported_by) || 'Unknown',
        }));
        setErrorReports(enriched);
        setStats(prev => ({ ...prev, openReports: enriched.filter(r => r.status === 'open').length }));
      } else {
        setErrorReports([]);
        setStats(prev => ({ ...prev, openReports: 0 }));
      }
    } catch (error) {
      console.error('Error fetching error reports:', error);
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [usersRes, clientsRes, locationsRes, cutoff] = await Promise.all([
          supabase.from('users').select('id, is_active', { count: 'exact' }),
          supabase.from('clients').select('id', { count: 'exact' }).eq('is_active', true),
          supabase.from('locations').select('id', { count: 'exact' }).eq('is_active', true),
          getCurrentCutoff(),
        ]);

        setStats(prev => ({
          ...prev,
          totalUsers: usersRes.count || 0,
          activeUsers: usersRes.data?.filter((u) => u.is_active).length || 0,
          activeClients: clientsRes.count || 0,
          activeLocations: locationsRes.count || 0,
        }));
        setCutoffDate(cutoff);
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    fetchStats();
    fetchErrorReports();
  }, []);

  const toggleReportStatus = async (reportId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'open' ? 'resolved' : 'open';
    const { error } = await supabase
      .from('error_reports')
      .update({ status: newStatus })
      .eq('id', reportId);

    if (error) {
      toast({ title: 'Failed to update status', variant: 'destructive' });
      return;
    }

    setErrorReports(prev =>
      prev.map(r => r.id === reportId ? { ...r, status: newStatus } : r)
    );
    setSelectedReport(prev => (prev && prev.id === reportId ? { ...prev, status: newStatus } : prev));
    setStats(prev => ({
      ...prev,
      openReports: prev.openReports + (newStatus === 'open' ? 1 : -1),
    }));
  };

  const handleSendResponse = async () => {
    if (!selectedReport || !user?.id || !responseText.trim()) return;
    setSendingResponse(true);
    try {
      const trimmed = responseText.trim();
      const now = new Date().toISOString();

      const { error: updateErr } = await supabase
        .from('error_reports')
        .update({
          admin_response: trimmed,
          responded_at: now,
          responded_by: user.id,
          status: 'resolved',
        })
        .eq('id', selectedReport.id);
      if (updateErr) throw updateErr;

      toast({ title: 'Response sent', description: 'The reporter will see it in their Error Reports.' });

      setErrorReports(prev =>
        prev.map(r =>
          r.id === selectedReport.id
            ? { ...r, admin_response: trimmed, responded_at: now, responded_by: user.id, status: 'resolved' }
            : r
        )
      );
      setStats(prev => ({
        ...prev,
        openReports: prev.openReports - (selectedReport.status === 'open' ? 1 : 0),
      }));
      setSelectedReport(prev =>
        prev ? { ...prev, admin_response: trimmed, responded_at: now, responded_by: user.id, status: 'resolved' } : prev
      );
    } catch (err: any) {
      console.error('Failed to send response:', err);
      toast({ title: 'Failed to send response', description: err.message, variant: 'destructive' });
    } finally {
      setSendingResponse(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedReport || !user?.id || !replyText.trim()) return;
    setSendingReply(true);
    try {
      const body = replyText.trim();
      const { data, error } = await supabase
        .from('error_report_replies')
        .insert({ report_id: selectedReport.id, user_id: user.id, body })
        .select('*')
        .single();
      if (error) throw error;
      const { data: users } = await supabase.rpc('get_user_display_info', { user_ids: [user.id] });
      const name = (users || []).find((u: any) => u.id === user.id)?.name || 'You';
      setReplies(prev => [...prev, { ...(data as any), user_name: name }]);
      setReplyText('');
    } catch (err: any) {
      toast({ title: 'Failed to send reply', description: err.message, variant: 'destructive' });
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">System Administration</h1>
          <p className="text-muted-foreground mt-2">Manage users, locations, clients, and system settings</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Active Users</CardDescription>
              <CardTitle className="text-3xl">{stats.activeUsers}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{stats.totalUsers} total</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Active Clients</CardDescription>
              <CardTitle className="text-3xl">{stats.activeClients}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Billing entities</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Locations</CardDescription>
              <CardTitle className="text-3xl">{stats.activeLocations}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Active work sites</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Cutoff Date</CardDescription>
              <CardTitle className="text-lg">
                {cutoffDate ? format(cutoffDate, 'MMM d') : 'Loading...'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {cutoffDate ? format(cutoffDate, 'h:mm a') : 'Fetching...'}
              </p>
            </CardContent>
          </Card>

          <Card className={stats.openReports > 0 ? 'border-destructive' : ''}>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                Open Reports
              </CardDescription>
              <CardTitle className={`text-3xl ${stats.openReports > 0 ? 'text-destructive' : ''}`}>
                {stats.openReports}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Error reports</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <Users className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Users</CardTitle>
              <CardDescription>Manage user accounts and permissions</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link to="/admin/users">Manage Users</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Building2 className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Clients</CardTitle>
              <CardDescription>Manage billing entities</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link to="/admin/clients">Manage Clients</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <MapPin className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Locations</CardTitle>
              <CardDescription>Manage work sites</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link to="/admin/locations">Manage Locations</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Settings className="h-8 w-8 text-primary mb-2" />
              <CardTitle>System Settings</CardTitle>
              <CardDescription>Configure cutoff and settings</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link to="/admin/settings">Manage Settings</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Error Reports Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Error Reports
            </CardTitle>
            <CardDescription>User-submitted issue reports with screenshots</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingReports ? (
              <p className="text-sm text-muted-foreground">Loading reports...</p>
            ) : errorReports.length === 0 ? (
              <p className="text-sm text-muted-foreground">No error reports submitted yet.</p>
            ) : (
              <div className="relative w-full overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHead column="status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Status</SortableTableHead>
                      <SortableTableHead column="reporter_name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Reporter</SortableTableHead>
                      <SortableTableHead column="description" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Description</SortableTableHead>
                      <SortableTableHead column="page_url" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Page</SortableTableHead>
                      <TableHead>Screenshot</TableHead>
                      <SortableTableHead column="created_at" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Time</SortableTableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedReports.map((report) => (
                      <TableRow
                        key={report.id}
                        className={`cursor-pointer hover:bg-muted/40 ${report.status === 'open' ? 'bg-destructive/5' : ''}`}
                        onClick={() => setSelectedReport(report)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={report.status === 'resolved'}
                              onCheckedChange={() => toggleReportStatus(report.id, report.status)}
                            />
                            <Badge variant={report.status === 'open' ? 'destructive' : 'secondary'}>
                              {report.status}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{report.reporter_name}</TableCell>
                        <TableCell className="max-w-[300px]">
                          <p className="truncate text-sm">{report.description}</p>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{report.page_url}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {report.screenshot_url ? (
                            <ErrorScreenshotViewer screenshotPath={report.screenshot_url} />
                          ) : (
                            <span className="text-xs text-muted-foreground">None</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {format(new Date(report.created_at), 'MMM d, h:mm a')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!selectedReport} onOpenChange={(o) => !o && setSelectedReport(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Error Report
              </DialogTitle>
              <DialogDescription>Full details of the submitted issue.</DialogDescription>
            </DialogHeader>

            {selectedReport && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{selectedReport.reporter_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(selectedReport.created_at), 'PPpp')}
                    </p>
                  </div>
                  <Badge variant={selectedReport.status === 'open' ? 'destructive' : 'secondary'}>
                    {selectedReport.status}
                  </Badge>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase text-muted-foreground">Description</p>
                  <p className="text-sm whitespace-pre-wrap rounded-md border bg-muted/30 p-3">
                    {selectedReport.description}
                  </p>
                </div>

                {selectedReport.page_url && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Page</p>
                    <p className="text-sm font-mono break-all">{selectedReport.page_url}</p>
                  </div>
                )}

                {selectedReport.screenshot_url && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Screenshot</p>
                    <ErrorScreenshotViewer screenshotPath={selectedReport.screenshot_url} />
                  </div>
                )}

                <div className="space-y-2 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase text-muted-foreground">
                      Response to user
                    </p>
                    {selectedReport.responded_at && (
                      <p className="text-xs text-muted-foreground">
                        Last sent {format(new Date(selectedReport.responded_at), 'PPp')}
                      </p>
                    )}
                  </div>
                  <Textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    placeholder="Write a response. It will appear in the reporter's Error Reports section."
                    rows={4}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    Sending will notify {selectedReport.reporter_name} in their Error Reports and mark this report resolved.
                  </p>
                </div>

                <div className="space-y-2 border-t pt-4">
                  <p className="text-xs font-medium uppercase text-muted-foreground">Conversation</p>
                  {loadingReplies ? (
                    <p className="text-xs text-muted-foreground">Loading…</p>
                  ) : replies.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No replies yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {replies.map((r) => (
                        <div key={r.id} className="rounded-md border bg-muted/30 p-2.5">
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span className="font-medium text-foreground">{r.user_name}</span>
                            <span>{format(new Date(r.created_at), 'MMM d, h:mm a')}</span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{r.body}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Reply to the reporter…"
                    rows={3}
                    className="resize-none"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleSendReply}
                      disabled={sendingReply || !replyText.trim()}
                      className="gap-2"
                    >
                      {sendingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Send reply
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setSelectedReport(null)}>
                Close
              </Button>
              {selectedReport && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => toggleReportStatus(selectedReport.id, selectedReport.status)}
                  >
                    {selectedReport.status === 'open' ? 'Mark resolved' : 'Reopen'}
                  </Button>
                  <Button
                    onClick={handleSendResponse}
                    disabled={sendingResponse || !responseText.trim()}
                    className="gap-2"
                  >
                    {sendingResponse ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {selectedReport.admin_response ? 'Send update' : 'Send response'}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
