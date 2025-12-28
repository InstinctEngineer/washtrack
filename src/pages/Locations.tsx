import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { LocationTable } from '@/components/LocationTable';
import { CreateLocationModal } from '@/components/CreateLocationModal';
import { EditLocationModal } from '@/components/EditLocationModal';
import { supabase } from '@/integrations/supabase/client';
import { Location } from '@/types/database';
import { toast } from '@/hooks/use-toast';

export default function Locations() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('name');

      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error('Error fetching locations:', error);
      toast({
        title: 'Error',
        description: 'Failed to load locations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const handleEdit = (location: Location) => {
    setSelectedLocation(location);
    setEditModalOpen(true);
  };

  const handleViewDetails = (location: Location) => {
    // For now, just open edit modal
    handleEdit(location);
  };

  const handleDeactivate = async (location: Location) => {
    try {
      const { error } = await supabase
        .from('locations')
        .update({ is_active: !location.is_active })
        .eq('id', location.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Location ${location.is_active ? 'deactivated' : 'activated'} successfully`,
      });
      fetchLocations();
    } catch (error) {
      console.error('Error updating location:', error);
      toast({
        title: 'Error',
        description: 'Failed to update location',
        variant: 'destructive',
      });
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Locations Management</h1>
            <p className="text-muted-foreground mt-2">
              Manage work sites - each location is linked to a client for billing
            </p>
          </div>
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Location
          </Button>
        </div>

        <LocationTable
          locations={locations}
          loading={loading}
          onEdit={handleEdit}
          onDeactivate={handleDeactivate}
          onViewDetails={handleViewDetails}
        />

        <CreateLocationModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
          onSuccess={fetchLocations}
        />

        {selectedLocation && (
          <EditLocationModal
            open={editModalOpen}
            onOpenChange={setEditModalOpen}
            location={selectedLocation}
            onSuccess={fetchLocations}
          />
        )}
      </div>
    </Layout>
  );
}
