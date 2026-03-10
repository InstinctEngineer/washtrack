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
import { RefreshCw, Activity, Search, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { format } from 'date-fns';

const ACTION_TYPES = ['all', 'page_view', 'button_click', 'form_submit', 'data_create', 'data_update', 'data_delete'];

const ACTION_COLORS: Record<string, string> = {
  page_view: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  button_click: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  form_submit: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  data_create: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  data_update: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  data_delete: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  page: string | null;
  target: string | null;
  metadata: any;
  created_at: string;
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
  const [limit, setLimit] = useState(200);

  if (userRole !== 'super_admin') {
    return <Navigate to="/unauthorized" replace />;
  }

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('activity_logs' as any)
        .select('*')
        .order('created_at', { ascending: sortDir === 'asc' })
        .limit(limit);

      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }
      if (userFilter !== 'all') {
        query = query.eq('user_id', userFilter);
      }

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
          setUsers(map);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch activity logs:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, userFilter, sortDir, limit]);

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
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Action type" />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map(a => (
                    <SelectItem key={a} value={a}>
                      {a === 'all' ? 'All Actions' : a.replace('_', ' ')}
                    </SelectItem>
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
              <Select value={String(limit)} onValueChange={v => setLimit(Number(v))}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="100">100 rows</SelectItem>
                  <SelectItem value="200">200 rows</SelectItem>
                  <SelectItem value="500">500 rows</SelectItem>
                  <SelectItem value="1000">1000 rows</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {filteredLogs.length} log entries
            </CardTitle>
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
                          <TableRow key={log.id}>
                            <TableCell className="whitespace-nowrap text-xs">
                              {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {users[log.user_id] || log.user_id.slice(0, 8)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={ACTION_COLORS[log.action] || ''}>
                                {log.action}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                              {log.page}
                            </TableCell>
                            <TableCell className="text-sm">
                              {log.target}
                            </TableCell>
                            <TableCell className="max-w-[300px] truncate text-xs font-mono">
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
      </div>
    </Layout>
  );
}
