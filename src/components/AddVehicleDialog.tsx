import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { VehicleType, Location, Client } from '@/types/database';
import { toast } from '@/hooks/use-toast';

interface AddVehicleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationIds: string[];
  onVehicleCreated: (vehicleId: string) => void;
}

export function AddVehicleDialog({ 
  open, 
  onOpenChange, 
  locationIds,
  onVehicleCreated 
}: AddVehicleDialogProps) {
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    vehicle_number: '',
    vehicle_type_id: '',
    home_location_id: '',
    client_id: '',
  });

  useEffect(() => {
    if (open) {
      fetchData();
      resetForm();
    }
  }, [open, locationIds]);

  const resetForm = () => {
    setFormData({
      vehicle_number: '',
      vehicle_type_id: '',
      home_location_id: locationIds[0] || '',
      client_id: '',
    });
  };

  const fetchData = async () => {
    try {
      // Fetch vehicle types
      const { data: typesData, error: typesError } = await supabase
        .from('vehicle_types')
        .select('*')
        .eq('is_active', true)
        .order('type_name');

      if (typesError) throw typesError;
      setVehicleTypes(typesData || []);

      // Fetch locations (only the ones assigned to the user)
      const { data: locationsData, error: locationsError } = await supabase
        .from('locations')
        .select('*')
        .in('id', locationIds)
        .eq('is_active', true)
        .order('name');

      if (locationsError) throw locationsError;
      setLocations(locationsData || []);

      // Fetch active clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .eq('is_active', true)
        .order('client_name');

      if (clientsError) throw clientsError;
      setClients(clientsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load form data',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.vehicle_number || !formData.vehicle_type_id || !formData.home_location_id) {
      toast({
        title: 'Missing Required Fields',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }
    
    setLoading(true);
    try {
      // Check if vehicle number already exists
      const { data: existingVehicle } = await supabase
        .from('vehicles')
        .select('id')
        .eq('vehicle_number', formData.vehicle_number.trim())
        .single();

      if (existingVehicle) {
        toast({
          title: 'Vehicle Already Exists',
          description: `Vehicle ${formData.vehicle_number} is already in the system`,
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Create the vehicle
      const { data: newVehicle, error } = await supabase
        .from('vehicles')
        .insert({
          vehicle_number: formData.vehicle_number.trim().toUpperCase(),
          vehicle_type_id: formData.vehicle_type_id,
          home_location_id: formData.home_location_id,
          client_id: formData.client_id || null,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Vehicle Created',
        description: `${formData.vehicle_number} has been added to the system`,
      });

      onVehicleCreated(newVehicle.id);
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error creating vehicle:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create vehicle',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Vehicle</DialogTitle>
          <DialogDescription>
            Create a new vehicle entry. All fields marked with * are required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vehicle-number">Vehicle Number *</Label>
            <Input
              id="vehicle-number"
              value={formData.vehicle_number}
              onChange={(e) => setFormData(prev => ({ ...prev, vehicle_number: e.target.value }))}
              placeholder="Enter vehicle number"
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vehicle-type">Vehicle Type *</Label>
            <Select 
              value={formData.vehicle_type_id} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, vehicle_type_id: value }))}
              required
            >
              <SelectTrigger id="vehicle-type">
                <SelectValue placeholder="Select vehicle type" />
              </SelectTrigger>
              <SelectContent>
                {vehicleTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.type_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="home-location">Home Location *</Label>
            <Select 
              value={formData.home_location_id} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, home_location_id: value }))}
              required
            >
              <SelectTrigger id="home-location">
                <SelectValue placeholder="Select home location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="client">Client (Optional)</Label>
            <Select 
              value={formData.client_id} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, client_id: value }))}
            >
              <SelectTrigger id="client">
                <SelectValue placeholder="Select client (optional)" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.client_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Vehicle'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
