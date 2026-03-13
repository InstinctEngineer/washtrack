import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Link } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, MapPin, Settings, Building2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentCutoff } from '@/lib/cutoff';
import { format } from 'date-fns';
import { ErrorScreenshotViewer } from '@/components/ErrorScreenshotViewer';
import { toast } from '@/hooks/use-toast';

interface ErrorReport {
  id: string;
  reported_by: string;
  description: string;
  screenshot_url: string | null;
  page_url: string | null;
  status: string;
  created_at: string;
  reporter_name?: string;
}

export default function AdminDashboard() {
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
    setStats(prev => ({
      ...prev,
      openReports: prev.openReports + (newStatus === 'open' ? 1 : -1),
    }));
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
                      <TableHead>Status</TableHead>
                      <TableHead>Reporter</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Page</TableHead>
                      <TableHead>Screenshot</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {errorReports.map((report) => (
                      <TableRow key={report.id} className={report.status === 'open' ? 'bg-destructive/5' : ''}>
                        <TableCell>
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
                        <TableCell>
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
      </div>
    </Layout>
  );
}
