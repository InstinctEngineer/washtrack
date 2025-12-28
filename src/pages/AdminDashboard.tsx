import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Users, MapPin, Settings, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentCutoff } from '@/lib/cutoff';
import { format } from 'date-fns';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    activeUsers: 0,
    totalUsers: 0,
    activeClients: 0,
    activeLocations: 0,
  });
  const [cutoffDate, setCutoffDate] = useState<Date | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [usersRes, clientsRes, locationsRes, cutoff] = await Promise.all([
          supabase.from('users').select('id, is_active', { count: 'exact' }),
          supabase.from('clients').select('id', { count: 'exact' }).eq('is_active', true),
          supabase.from('locations').select('id', { count: 'exact' }).eq('is_active', true),
          getCurrentCutoff(),
        ]);

        setStats({
          totalUsers: usersRes.count || 0,
          activeUsers: usersRes.data?.filter((u) => u.is_active).length || 0,
          activeClients: clientsRes.count || 0,
          activeLocations: locationsRes.count || 0,
        });
        setCutoffDate(cutoff);
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    fetchStats();
  }, []);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">System Administration</h1>
          <p className="text-muted-foreground mt-2">Manage users, locations, clients, and system settings</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Active Users</CardDescription>
              <CardTitle className="text-3xl">{stats.activeUsers}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {stats.totalUsers} total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Active Clients</CardDescription>
              <CardTitle className="text-3xl">{stats.activeClients}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Billing entities
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Locations</CardDescription>
              <CardTitle className="text-3xl">{stats.activeLocations}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Active work sites
              </p>
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
      </div>
    </Layout>
  );
}
