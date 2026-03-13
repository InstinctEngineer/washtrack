import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, Activity, Search, ArrowUp, ArrowDown, Clock, User, MousePointerClick, FileText, Globe, Tag, Info, Database, Link2, LayoutDashboard, ImageIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ErrorScreenshotViewer } from '@/components/ErrorScreenshotViewer';

const ACTION_GROUPS: { label: string; actions: string[] }[] = [
  { label: '── User Reports', actions: ['error_report'] },
  { label: '── Navigation', actions: ['page_view'] },
  { label: '── UI Interactions', actions: ['click', 'input_change', 'form_submit'] },
  { label: '── Auth Events', actions: ['auth_login', 'auth_logout', 'auth_login_failed', 'auth_password_change', 'auth_password_reset', 'auth_session_refresh', 'auth_token_expired', 'auth_error', 'auth_signup'] },
  { label: '── Database Ops', actions: ['db_insert', 'db_update', 'db_delete', 'db_select', 'db_rpc'] },
  { label: '── Errors & Faults', actions: ['error', 'console_error', 'warning', 'network_error', 'system_fault'] },
];

const ALL_ACTION_TYPES = ACTION_GROUPS.flatMap(g => g.actions);

const ACTION_COLORS: Record<string, string> = {
  // User Reports
  error_report: 'bg-red-500 text-white dark:bg-red-600 dark:text-white font-bold',
  // Navigation
  page_view: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  // UI
  click: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  input_change: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  form_submit: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  // Auth
  auth_login: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  auth_logout: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
  auth_login_failed: 'bg-red-200 text-red-900 dark:bg-red-950 dark:text-red-300',
  auth_password_change: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  auth_password_reset: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  auth_session_refresh: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
  auth_token_expired: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  auth_error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  auth_signup: 'bg-teal-200 text-teal-900 dark:bg-teal-950 dark:text-teal-200',
  // Database
  db_insert: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  db_update: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  db_delete: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  db_select: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  db_rpc: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  // Errors
  error: 'bg-red-200 text-red-900 dark:bg-red-950 dark:text-red-300',
  console_error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  network_error: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200',
  system_fault: 'bg-red-300 text-red-950 dark:bg-red-950 dark:text-red-200',
};

const ACTION_LABELS: Record<string, string> = {
  error_report: '🚨 Error Report',
  page_view: 'Page View',
  click: 'Click',
  input_change: 'Input Change',
  form_submit: 'Form Submit',
  auth_login: 'Login',
  auth_logout: 'Logout',
  auth_login_failed: 'Failed Login',
  auth_password_change: 'Password Change',
  auth_password_reset: 'Password Reset',
  auth_session_refresh: 'Session Refresh',
  auth_token_expired: 'Token Expired',
  auth_error: 'Auth Error',
  auth_signup: 'Signup',
  db_insert: 'DB Insert',
  db_update: 'DB Update',
  db_delete: 'DB Delete',
  db_select: 'DB Select',
  db_rpc: 'DB Function Call',
  error: 'JS Error',
  console_error: 'Console Error',
  warning: 'Warning',
  network_error: 'Network Error',
  system_fault: 'System Fault',
};

interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  page: string | null;
  target: string | null;
  metadata: any;
  created_at: string;
  client_timestamp: string | null;
}

export default function ActivityLogs() {
  const { userRole } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // Build count query with same filters
      let countQuery = supabase
        .from('activity_logs' as any)
        .select('*', { count: 'exact', head: true });

      if (actionFilter !== 'all') countQuery = countQuery.eq('action', actionFilter);
      if (userFilter !== 'all') countQuery = countQuery.eq('user_id', userFilter);

      const { count } = await countQuery;
      setTotalCount(count ?? 0);

      // Build data query with pagination
      const from = page * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('activity_logs' as any)
        .select('*')
        .order('created_at', { ascending: sortDir === 'asc' })
        .range(from, to);

      if (actionFilter !== 'all') query = query.eq('action', actionFilter);
      if (userFilter !== 'all') query = query.eq('user_id', userFilter);

      const { data, error } = await query;
      if (error) throw error;
      setLogs((data as any[]) || []);

      // Fetch user names for display
      const userIds = [...new Set((data as any[])?.map((l: any) => l.user_id) || [])];
      if (userIds.length > 0) {
        const { data: userData } = await supabase
          .rpc('get_user_display_info', { user_ids: userIds });
        if (userData) {
          const map: Record<string, string> = {};
          userData.forEach((u: any) => { map[u.id] = u.name; });
          setUsers(prev => ({ ...prev, ...map }));
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch activity logs:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userRole !== 'super_admin') return;
    fetchLogs();
  }, [actionFilter, userFilter, sortDir, pageSize, page]);

  // Reset to page 0 when filters change
  useEffect(() => {
    setPage(0);
  }, [actionFilter, userFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const filteredLogs = useMemo(() => {
    if (!search.trim()) return logs;
    const q = search.toLowerCase();
    return logs.filter(log =>
      (log.page?.toLowerCase().includes(q)) ||
      (log.target?.toLowerCase().includes(q)) ||
      (log.action.toLowerCase().includes(q)) ||
      (users[log.user_id]?.toLowerCase().includes(q)) ||
      (JSON.stringify(log.metadata)?.toLowerCase().includes(q))
    );
  }, [logs, search, users]);

  const uniqueUsers = useMemo(() => {
    const ids = [...new Set(logs.map(l => l.user_id))];
    return ids.map(id => ({ id, name: users[id] || id.slice(0, 8) }));
  }, [logs, users]);

  if (userRole !== 'super_admin') {
    return <Navigate to="/unauthorized" replace />;
  }

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Activity Logs</h1>
              <p className="text-muted-foreground">System-wide user action history</p>
            </div>
          </div>
          <Button onClick={fetchLogs} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search logs..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Action type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {ACTION_GROUPS.map(group => (
                    <div key={group.label}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{group.label}</div>
                      {group.actions.map(a => (
                        <SelectItem key={a} value={a}>
                          {ACTION_LABELS[a] || a}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="User" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {uniqueUsers.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(pageSize)} onValueChange={v => setPageSize(Number(v))}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25 / page</SelectItem>
                  <SelectItem value="50">50 / page</SelectItem>
                  <SelectItem value="100">100 / page</SelectItem>
                  <SelectItem value="200">200 / page</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="text-lg">
              {totalCount.toLocaleString()} total entries · Page {page + 1} of {totalPages}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0 || loading}
                onClick={() => setPage(p => p - 1)}
              >
                ← Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1 || loading}
                onClick={() => setPage(p => p + 1)}
              >
                Next →
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : (
              <div className="rounded-md border">
                <ScrollArea className="h-[600px] w-full">
                  <div className="min-w-max">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead
                            className="cursor-pointer select-none hover:bg-muted/50"
                            onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                          >
                            <div className="flex items-center gap-1">
                              Time
                              {sortDir === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                            </div>
                          </TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Page</TableHead>
                          <TableHead>Target</TableHead>
                          <TableHead>Metadata</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLogs.map(log => (
                          <TableRow key={log.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedLog(log)}>
                            <TableCell className="whitespace-nowrap text-xs">
                              {format(new Date(log.client_timestamp || log.created_at), 'MMM d, HH:mm:ss')}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {users[log.user_id] || log.user_id.slice(0, 8)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={ACTION_COLORS[log.action] || ''}>
                                {ACTION_LABELS[log.action] || log.action}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                              {log.page}
                            </TableCell>
                            <TableCell className="text-sm max-w-[200px] truncate">
                              {log.target}
                              {log.metadata?.modal && (
                                <span className="ml-1 text-xs text-muted-foreground">({log.metadata.modal})</span>
                              )}
                            </TableCell>
                            <TableCell className="max-w-[300px] truncate text-xs font-mono">
                              {log.metadata?.correlation && (
                                <Badge variant="secondary" className="mr-1 text-[10px] px-1 py-0">
                                  {log.metadata.correlation}
                                </Badge>
                              )}
                              {log.metadata ? JSON.stringify(log.metadata) : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredLogs.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                              No activity logs found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail Sheet */}
        <Sheet open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
          <SheetContent className="sm:max-w-lg overflow-y-auto">
            {selectedLog && (
              <>
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Badge variant="outline" className={ACTION_COLORS[selectedLog.action] || ''}>
                      {ACTION_LABELS[selectedLog.action] || selectedLog.action}
                    </Badge>
                  </SheetTitle>
                  <SheetDescription>
                    Full details for this activity log entry
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-5">
                  {/* Timestamp */}
                  <div className="flex items-start gap-3">
                    <Clock className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Event Time</p>
                      <p className="text-sm font-mono">{format(new Date(selectedLog.client_timestamp || selectedLog.created_at), 'EEEE, MMMM d, yyyy')}</p>
                      <p className="text-sm font-mono">{format(new Date(selectedLog.client_timestamp || selectedLog.created_at), 'HH:mm:ss.SSS')}</p>
                      {selectedLog.client_timestamp && selectedLog.client_timestamp !== selectedLog.created_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Server received: {format(new Date(selectedLog.created_at), 'HH:mm:ss.SSS')}
                        </p>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* User */}
                  <div className="flex items-start gap-3">
                    <User className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">User</p>
                      <p className="text-sm font-medium">{users[selectedLog.user_id] || 'Unknown'}</p>
                      <p className="text-xs font-mono text-muted-foreground">{selectedLog.user_id}</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Action */}
                  <div className="flex items-start gap-3">
                    <MousePointerClick className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Action</p>
                      <Badge variant="outline" className={`${ACTION_COLORS[selectedLog.action] || ''} mt-1`}>
                        {ACTION_LABELS[selectedLog.action] || selectedLog.action}
                      </Badge>
                    </div>
                  </div>

                  <Separator />

                  {/* Page */}
                  <div className="flex items-start gap-3">
                    <Globe className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Page</p>
                      <p className="text-sm font-mono">{selectedLog.page || '—'}</p>
                    </div>
                  </div>

                  {/* Target */}
                  {selectedLog.target && (
                    <>
                      <Separator />
                      <div className="flex items-start gap-3">
                        <Tag className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Target</p>
                          <p className="text-sm">{selectedLog.target}</p>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Modal/Dialog Context */}
                  {selectedLog.metadata?.modal && (
                    <>
                      <Separator />
                      <div className="flex items-start gap-3">
                        <LayoutDashboard className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Modal / Dialog</p>
                          <p className="text-sm font-medium">{selectedLog.metadata.modal}</p>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Correlation ID */}
                  {selectedLog.metadata?.correlation && (
                    <>
                      <Separator />
                      <div className="flex items-start gap-3">
                        <Link2 className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Correlation ID</p>
                          <Badge variant="secondary" className="font-mono mt-1">{selectedLog.metadata.correlation}</Badge>
                          <p className="text-xs text-muted-foreground mt-1">Links this event to related form submissions and DB operations</p>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Screenshot (for error reports) */}
                  {selectedLog.metadata?.screenshot_path && (
                    <>
                      <Separator />
                      <div className="flex items-start gap-3">
                        <ImageIcon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Screenshot</p>
                          <ErrorScreenshotViewer screenshotPath={selectedLog.metadata.screenshot_path} />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Request Body (for DB operations) */}
                  {selectedLog.metadata?.body && (
                    <>
                      <Separator />
                      <div className="flex items-start gap-3">
                        <Database className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Request Body</p>
                          <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                            {selectedLog.metadata.body._batch ? (
                              <>
                                <p className="text-xs text-muted-foreground">Batch operation: {selectedLog.metadata.body._count} records</p>
                                {selectedLog.metadata.body.items?.map((item: any, i: number) => (
                                  <div key={i} className="border-t pt-2 first:border-t-0 first:pt-0">
                                    <p className="text-xs font-medium text-muted-foreground mb-1">Record {i + 1}</p>
                                    {Object.entries(item).map(([k, v]) => (
                                      <div key={k} className="flex flex-col gap-0.5">
                                        <span className="text-xs font-medium text-muted-foreground">{k}</span>
                                        <span className="text-sm font-mono break-all">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                                      </div>
                                    ))}
                                  </div>
                                ))}
                              </>
                            ) : (
                              Object.entries(selectedLog.metadata.body).map(([key, value]) => (
                                <div key={key} className="flex flex-col gap-0.5">
                                  <span className="text-xs font-medium text-muted-foreground">{key}</span>
                                  <span className="text-sm font-mono break-all">
                                    {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Query Filters (for updates/deletes) */}
                  {selectedLog.metadata?.filters && (
                    <>
                      <Separator />
                      <div className="flex items-start gap-3">
                        <Search className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Query Filters</p>
                          <div className="rounded-md border bg-muted/30 p-3 space-y-1">
                            {Object.entries(selectedLog.metadata.filters).map(([key, value]) => (
                              <div key={key} className="flex items-center gap-2">
                                <span className="text-xs font-medium text-muted-foreground">{key}:</span>
                                <span className="text-sm font-mono">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Metadata (remaining fields) */}
                  {selectedLog.metadata && (() => {
                    const excluded = ['body', 'filters', 'modal', 'correlation'];
                    const remaining = Object.entries(selectedLog.metadata).filter(([k]) => !excluded.includes(k));
                    if (remaining.length === 0) return null;
                    return (
                      <>
                        <Separator />
                        <div className="flex items-start gap-3">
                          <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Metadata</p>
                            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                              {remaining.map(([key, value]) => (
                                <div key={key} className="flex flex-col gap-0.5">
                                  <span className="text-xs font-medium text-muted-foreground">{key}</span>
                                  <span className="text-sm font-mono break-all">
                                    {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  <Separator />

                  {/* Log ID */}
                  <div className="flex items-start gap-3">
                    <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Log ID</p>
                      <p className="text-xs font-mono text-muted-foreground">{selectedLog.id}</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </Layout>
  );
}
