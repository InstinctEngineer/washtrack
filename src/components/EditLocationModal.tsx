import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Location, Client } from '@/types/database';
import { toast } from '@/hooks/use-toast';

interface EditLocationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: Location;
  onSuccess: () => void;
}

export const EditLocationModal = ({
  open,
  onOpenChange,
  location,
  onSuccess,
}: EditLocationModalProps) => {
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [formData, setFormData] = useState({
    name: location.name,
    address: location.address || '',
    client_id: location.client_id,
    is_active: location.is_active,
  });

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .eq('is_active', true)
          .order('name');

        if (error) throw error;
        setClients(data || []);
      } catch (error) {
        console.error('Error fetching clients:', error);
      }
    };

    if (open) {
      setFormData({
        name: location.name,
        address: location.address || '',
        client_id: location.client_id,
        is_active: location.is_active,
      });
      fetchClients();
    }
  }, [open, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate
      if (!formData.name.trim()) {
        toast({
          title: 'Validation Error',
          description: 'Location name is required',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      if (!formData.client_id) {
        toast({
          title: 'Validation Error',
          description: 'Client is required',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Check for duplicate name (excluding current location)
      if (formData.name.trim() !== location.name) {
        const { data: existing } = await supabase
          .from('locations')
          .select('id')
          .ilike('name', formData.name.trim())
          .neq('id', location.id)
          .maybeSingle();

        if (existing) {
          toast({
            title: 'Duplicate Location',
            description: 'A location with this name already exists',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }
      }

      // Update location
      const { error } = await supabase
        .from('locations')
        .update({
          name: formData.name.trim(),
          address: formData.address.trim() || null,
          client_id: formData.client_id,
          is_active: formData.is_active,
        })
        .eq('id', location.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Location "${formData.name}" updated successfully`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating location:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update location',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Location</DialogTitle>
            <DialogDescription>
              Update location information.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Location Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Rochester Hub"
                maxLength={100}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client">
                Client <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.client_id}
                onValueChange={(value) => setFormData({ ...formData, client_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select the billing client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                      {client.parent_company && ` (${client.parent_company})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 Main St, City, State ZIP"
                maxLength={250}
                rows={2}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked === true })
                }
              />
              <Label htmlFor="active" className="cursor-pointer">
                Active (employees can log work at this location)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
