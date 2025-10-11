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
import { DataTable } from '@/components/DataTable';
import { VehicleTypeForm } from '@/components/VehicleTypeForm';
import { supabase } from '@/integrations/supabase/client';
import { VehicleType } from '@/types/database';
import { toast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function VehicleTypes() {
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<VehicleType | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [typeToDelete, setTypeToDelete] = useState<VehicleType | null>(null);

  const fetchVehicleTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicle_types')
        .select('*')
        .order('type_name');

      if (error) throw error;
      setVehicleTypes(data || []);
    } catch (error) {
      console.error('Error fetching vehicle types:', error);
      toast({
        title: 'Error',
        description: 'Failed to load vehicle types',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicleTypes();
  }, []);

  const handleSubmit = async (data: any) => {
    try {
      if (selectedType) {
        const { error } = await supabase
          .from('vehicle_types')
          .update({
            type_name: data.type_name,
            rate_per_wash: parseFloat(data.rate_per_wash),
            is_active: data.is_active,
          })
          .eq('id', selectedType.id);

        if (error) throw error;
        toast({ title: 'Success', description: 'Vehicle type updated successfully' });
      } else {
        const { error } = await supabase
          .from('vehicle_types')
          .insert({
            type_name: data.type_name,
            rate_per_wash: parseFloat(data.rate_per_wash),
            is_active: data.is_active,
          });

        if (error) throw error;
        toast({ title: 'Success', description: 'Vehicle type created successfully' });
      }

      setDialogOpen(false);
      setSelectedType(undefined);
      fetchVehicleTypes();
    } catch (error: any) {
      console.error('Error saving vehicle type:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save vehicle type',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!typeToDelete) return;

    try {
      // Check if any vehicles use this type
      const { data: vehicles, error: checkError } = await supabase
        .from('vehicles')
        .select('id')
        .eq('vehicle_type_id', typeToDelete.id)
        .limit(1);

      if (checkError) throw checkError;

      if (vehicles && vehicles.length > 0) {
        toast({
          title: 'Cannot Delete',
          description: 'This vehicle type is in use and cannot be deleted',
          variant: 'destructive',
        });
        return;
      }

      const { error } = await supabase
        .from('vehicle_types')
        .delete()
        .eq('id', typeToDelete.id);

      if (error) throw error;

      toast({ title: 'Success', description: 'Vehicle type deleted successfully' });
      fetchVehicleTypes();
    } catch (error: any) {
      console.error('Error deleting vehicle type:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete vehicle type',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setTypeToDelete(null);
    }
  };

  const columns = [
    {
      key: 'type_name',
      label: 'Type Name',
    },
    {
      key: 'rate_per_wash',
      label: 'Rate Per Wash',
      render: (type: VehicleType) => `$${type.rate_per_wash.toFixed(2)}`,
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (type: VehicleType) => (
        <Badge variant={type.is_active ? 'default' : 'secondary'}>
          {type.is_active ? 'Active' : 'Inactive'}
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
            <h1 className="text-3xl font-bold">Vehicle Types</h1>
            <p className="text-muted-foreground mt-2">Manage vehicle types and billing rates</p>
          </div>
          <Button onClick={() => {
            setSelectedType(undefined);
            setDialogOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Vehicle Type
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Vehicle Types</CardTitle>
            <CardDescription>Configure types and rates for vehicle washes</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              data={vehicleTypes}
              columns={columns}
              searchKey="type_name"
              actions={(type) => (
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedType(type);
                      setDialogOpen(true);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTypeToDelete(type);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            />
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedType ? 'Edit' : 'Add'} Vehicle Type</DialogTitle>
            <DialogDescription>
              {selectedType ? 'Update' : 'Create a new'} vehicle type and billing rate
            </DialogDescription>
          </DialogHeader>
          <VehicleTypeForm
            vehicleType={selectedType}
            onSubmit={handleSubmit}
            onCancel={() => {
              setDialogOpen(false);
              setSelectedType(undefined);
            }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vehicle Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{typeToDelete?.type_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
