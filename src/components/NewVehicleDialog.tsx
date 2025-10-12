import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { VehicleType } from '@/types/database';

interface NewVehicleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleNumber: string;
  onConfirm: (vehicleTypeId: string) => void;
}

export function NewVehicleDialog({ open, onOpenChange, vehicleNumber, onConfirm }: NewVehicleDialogProps) {
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchVehicleTypes();
      setSelectedTypeId(''); // Reset selection when dialog opens
    }
  }, [open]);

  const fetchVehicleTypes = async () => {
    const { data, error } = await supabase
      .from('vehicle_types')
      .select('*')
      .eq('is_active', true)
      .order('type_name');

    if (error) {
      console.error('Error fetching vehicle types:', error);
      return;
    }

    setVehicleTypes(data || []);
  };

  const handleSubmit = async () => {
    if (!selectedTypeId) return;
    
    setLoading(true);
    await onConfirm(selectedTypeId);
    setLoading(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Vehicle Found</DialogTitle>
          <DialogDescription>
            Vehicle number <strong>{vehicleNumber}</strong> is not in the system. Please select a vehicle type to create it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="vehicle-type">Vehicle Type *</Label>
            <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
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
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!selectedTypeId || loading}>
            {loading ? 'Creating...' : 'Create Vehicle'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
