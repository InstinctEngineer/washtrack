import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable } from '@/components/DataTable';
import { VehicleForm } from '@/components/VehicleForm';
import { CSVUploadDialog } from '@/components/CSVUploadDialog';
import { supabase } from '@/integrations/supabase/client';
import { VehicleWithDetails, VehicleType, Location } from '@/types/database';
import { toast } from '@/hooks/use-toast';
import { Plus, Edit, Upload } from 'lucide-react';

export default function Vehicles() {
  const [vehicles, setVehicles] = useState<VehicleWithDetails[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleWithDetails | undefined>();
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const fetchData = async () => {
    try {
      const [vehiclesRes, typesRes, locationsRes] = await Promise.all([
        supabase.from('vehicles').select(`
          *,
          vehicle_type:vehicle_types(*),
          home_location:locations!vehicles_home_location_id_fkey(*),
          last_seen_location:locations!vehicles_last_seen_location_id_fkey(*)
        `).order('vehicle_number'),
        supabase.from('vehicle_types').select('*').order('type_name'),
        supabase.from('locations').select('*').order('name'),
      ]);

      if (vehiclesRes.error) throw vehiclesRes.error;
      if (typesRes.error) throw typesRes.error;
      if (locationsRes.error) throw locationsRes.error;

      setVehicles(vehiclesRes.data as any || []);
      setVehicleTypes(typesRes.data || []);
      setLocations(locationsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load vehicles',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (data: any) => {
    try {
      if (selectedVehicle) {
        const { error } = await supabase
          .from('vehicles')
          .update({
            vehicle_type_id: data.vehicle_type_id,
            home_location_id: data.home_location_id || null,
            is_active: data.is_active,
          })
          .eq('id', selectedVehicle.id);

        if (error) throw error;
        toast({ title: 'Success', description: 'Vehicle updated successfully' });
      } else {
        const { error } = await supabase
          .from('vehicles')
          .insert({
            vehicle_number: data.vehicle_number,
            vehicle_type_id: data.vehicle_type_id,
            home_location_id: data.home_location_id || null,
            is_active: data.is_active,
          });

        if (error) throw error;
        toast({ title: 'Success', description: 'Vehicle created successfully' });
      }

      setDialogOpen(false);
      setSelectedVehicle(undefined);
      fetchData();
    } catch (error: any) {
      console.error('Error saving vehicle:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save vehicle',
        variant: 'destructive',
      });
    }
  };

  const handleCSVImport = async (rows: any[]) => {
    const errors: string[] = [];
    let imported = 0;
    let skipped = 0;

    for (const row of rows) {
      try {
        // Find type by name
        const type = vehicleTypes.find(
          (t) => t.type_name.toLowerCase() === row.type_name.toLowerCase()
        );
        if (!type) {
          errors.push(`Unknown vehicle type: ${row.type_name} for ${row.vehicle_number}`);
          skipped++;
          continue;
        }

        // Find location by name if provided
        let locationId = null;
        if (row.home_location_name) {
          const location = locations.find(
            (l) => l.name.toLowerCase() === row.home_location_name.toLowerCase()
          );
          if (!location) {
            errors.push(`Unknown location: ${row.home_location_name} for ${row.vehicle_number}`);
          } else {
            locationId = location.id;
          }
        }

        // Check for duplicates
        const { data: existing } = await supabase
          .from('vehicles')
          .select('id')
          .eq('vehicle_number', row.vehicle_number)
          .single();

        if (existing) {
          skipped++;
          continue;
        }

        // Insert vehicle
        const { error } = await supabase.from('vehicles').insert({
          vehicle_number: row.vehicle_number,
          vehicle_type_id: type.id,
          home_location_id: locationId,
          is_active: true,
        });

        if (error) throw error;
        imported++;
      } catch (error: any) {
        errors.push(`Error importing ${row.vehicle_number}: ${error.message}`);
        skipped++;
      }
    }

    await fetchData();

    return { imported, skipped, errors: errors.slice(0, 10) };
  };

  const filteredVehicles = vehicles.filter((vehicle) => {
    if (filterLocation !== 'all' && vehicle.home_location_id !== filterLocation) return false;
    if (filterType !== 'all' && vehicle.vehicle_type_id !== filterType) return false;
    if (filterStatus !== 'all') {
      if (filterStatus === 'active' && !vehicle.is_active) return false;
      if (filterStatus === 'inactive' && vehicle.is_active) return false;
    }
    return true;
  });

  const columns = [
    {
      key: 'vehicle_number',
      label: 'Vehicle Number',
    },
    {
      key: 'vehicle_type',
      label: 'Type',
      render: (v: VehicleWithDetails) => v.vehicle_type?.type_name || '-',
    },
    {
      key: 'home_location',
      label: 'Home Location',
      render: (v: VehicleWithDetails) => v.home_location?.name || '-',
    },
    {
      key: 'last_seen_date',
      label: 'Last Seen',
      render: (v: VehicleWithDetails) => v.last_seen_date || '-',
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (v: VehicleWithDetails) => (
        <Badge variant={v.is_active ? 'default' : 'secondary'}>
          {v.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Vehicles</h1>
            <p className="text-muted-foreground mt-2">Manage fleet vehicles</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCsvDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
            <Button onClick={() => {
              setSelectedVehicle(undefined);
              setDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Vehicle
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Vehicles</CardTitle>
            <CardDescription>View and manage vehicle fleet</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Select value={filterLocation} onValueChange={setFilterLocation}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {vehicleTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.type_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DataTable
              data={filteredVehicles}
              columns={columns}
              searchKey="vehicle_number"
              actions={(vehicle) => (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedVehicle(vehicle);
                    setDialogOpen(true);
                  }}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
            />
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedVehicle ? 'Edit' : 'Add'} Vehicle</DialogTitle>
            <DialogDescription>
              {selectedVehicle ? 'Update' : 'Create a new'} vehicle record
            </DialogDescription>
          </DialogHeader>
          <VehicleForm
            vehicle={selectedVehicle}
            vehicleTypes={vehicleTypes}
            locations={locations}
            onSubmit={handleSubmit}
            onCancel={() => {
              setDialogOpen(false);
              setSelectedVehicle(undefined);
            }}
          />
        </DialogContent>
      </Dialog>

      <CSVUploadDialog
        open={csvDialogOpen}
        onOpenChange={setCsvDialogOpen}
        onImport={handleCSVImport}
      />
    </Layout>
  );
}
