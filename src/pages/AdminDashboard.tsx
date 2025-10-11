import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Users, MapPin, Settings, Car, List } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentCutoff } from '@/lib/cutoff';
import { format } from 'date-fns';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalVehicles: 0,
    activeVehicles: 0,
    vehicleTypes: 0,
    locations: 0,
  });
  const [cutoffDate, setCutoffDate] = useState<Date | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [vehiclesRes, typesRes, locationsRes, cutoff] = await Promise.all([
          supabase.from('vehicles').select('id, is_active', { count: 'exact' }),
          supabase.from('vehicle_types').select('id', { count: 'exact' }),
          supabase.from('locations').select('id', { count: 'exact' }),
          getCurrentCutoff(),
        ]);

        setStats({
          totalVehicles: vehiclesRes.count || 0,
          activeVehicles: vehiclesRes.data?.filter((v) => v.is_active).length || 0,
          vehicleTypes: typesRes.count || 0,
          locations: locationsRes.count || 0,
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
          <p className="text-muted-foreground mt-2">Manage users, locations, vehicles, and system settings</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Vehicles</CardDescription>
              <CardTitle className="text-3xl">{stats.totalVehicles}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {stats.activeVehicles} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Vehicle Types</CardDescription>
              <CardTitle className="text-3xl">{stats.vehicleTypes}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Configured types
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Locations</CardDescription>
              <CardTitle className="text-3xl">{stats.locations}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Active locations
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

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <Car className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Vehicles</CardTitle>
              <CardDescription>Manage fleet vehicles</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link to="/admin/vehicles">View Vehicles</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <List className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Vehicle Types</CardTitle>
              <CardDescription>Configure types and rates</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link to="/admin/vehicle-types">Manage Types</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Users className="h-8 w-8 text-primary mb-2" />
              <CardTitle>User Management</CardTitle>
              <CardDescription>Create and manage user accounts</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link to="/admin/users/create">Create New User</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <MapPin className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Locations</CardTitle>
              <CardDescription>Manage wash locations</CardDescription>
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
