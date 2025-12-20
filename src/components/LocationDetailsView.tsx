import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Edit, MapPin, Users, Car, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Location, User, VehicleWithDetails } from '@/types/database';
import { format } from 'date-fns';

interface LocationDetailsViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: Location;
  onEdit: (location: Location) => void;
}

interface LocationStats {
  totalEmployees: number;
  totalVehicles: number;
  monthlyWashes: number;
  lastWashDate: string | null;
  managerName: string | null;
}

export const LocationDetailsView = ({
  open,
  onOpenChange,
  location,
  onEdit,
}: LocationDetailsViewProps) => {
  const [stats, setStats] = useState<LocationStats>({
    totalEmployees: 0,
    totalVehicles: 0,
    monthlyWashes: 0,
    lastWashDate: null,
    managerName: null,
  });
  const [employees, setEmployees] = useState<User[]>([]);
  const [vehicles, setVehicles] = useState<VehicleWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetails = async () => {
      if (!open) return;

      try {
        setLoading(true);

        // Fetch stats
        const [employeesRes, vehiclesRes, washesRes, managerRes] = await Promise.all([
          supabase
            .from('users')
            .select('*')
            .eq('location_id', location.id)
            .order('name'),
          supabase
            .from('vehicles')
            .select('*, vehicle_type:vehicle_types(*)')
            .eq('home_location_id', location.id)
            .order('vehicle_number'),
          supabase
            .from('work_entries')
            .select('id, work_date')
            .eq('location_id', location.id)
            .gte('work_date', format(new Date(new Date().setDate(1)), 'yyyy-MM-dd')),
          location.manager_user_id
            ? supabase.from('users').select('name').eq('id', location.manager_user_id).single()
            : Promise.resolve({ data: null, error: null }),
        ]);

        setEmployees((employeesRes.data || []) as User[]);
        setVehicles(vehiclesRes.data || []);

        // Get last work date
        const sortedEntries = (washesRes.data || []).sort(
          (a: any, b: any) => new Date(b.work_date).getTime() - new Date(a.work_date).getTime()
        );

        setStats({
          totalEmployees: employeesRes.data?.filter((e) => e.is_active).length || 0,
          totalVehicles: vehiclesRes.data?.filter((v) => v.is_active).length || 0,
          monthlyWashes: washesRes.data?.length || 0,
          lastWashDate: sortedEntries[0]?.work_date || null,
          managerName: managerRes.data?.name || null,
        });
      } catch (error) {
        console.error('Error fetching location details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [open, location]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl">{location.name}</DialogTitle>
              <DialogDescription className="mt-1 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {location.address || 'No address specified'}
              </DialogDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => onEdit(location)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8">Loading details...</div>
        ) : (
          <div className="space-y-6">
            {/* Info Cards */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Manager:</span>{' '}
                  <span className="font-medium">{stats.managerName || 'Unassigned'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>{' '}
                  <Badge variant={location.is_active ? 'default' : 'secondary'}>
                    {location.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Statistics */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Employees
                  </CardDescription>
                  <CardTitle className="text-2xl">{stats.totalEmployees}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">Active employees</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Car className="h-4 w-4" />
                    Vehicles
                  </CardDescription>
                  <CardTitle className="text-2xl">{stats.totalVehicles}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">Home location</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    This Month
                  </CardDescription>
                  <CardTitle className="text-2xl">{stats.monthlyWashes}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">Total washes</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Last Wash</CardDescription>
                  <CardTitle className="text-lg">
                    {stats.lastWashDate ? format(new Date(stats.lastWashDate), 'MMM d') : 'N/A'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">Most recent entry</p>
                </CardContent>
              </Card>
            </div>

            {/* Employees Table */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Assigned Employees</h3>
              {employees.length === 0 ? (
                <p className="text-muted-foreground text-sm">No employees assigned</p>
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Employee ID</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employees.map((employee) => (
                        <TableRow key={employee.id}>
                          <TableCell className="font-medium">{employee.name}</TableCell>
                          <TableCell>{employee.employee_id}</TableCell>
                          <TableCell>{employee.email}</TableCell>
                          <TableCell>
                            <Badge variant={employee.is_active ? 'default' : 'secondary'}>
                              {employee.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Vehicles Table */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Assigned Vehicles</h3>
              {vehicles.length === 0 ? (
                <p className="text-muted-foreground text-sm">No vehicles assigned</p>
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vehicle Number</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vehicles.map((vehicle) => (
                        <TableRow key={vehicle.id}>
                          <TableCell className="font-medium">{vehicle.vehicle_number}</TableCell>
                          <TableCell>{vehicle.vehicle_type?.type_name || 'Unknown'}</TableCell>
                          <TableCell>
                            <Badge variant={vehicle.is_active ? 'default' : 'secondary'}>
                              {vehicle.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
