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
import { Client } from '@/types/database';
import { toast } from '@/hooks/use-toast';

interface CreateLocationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const CreateLocationModal = ({
  open,
  onOpenChange,
  onSuccess,
}: CreateLocationModalProps) => {
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    client_id: '',
    is_active: true,
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
      fetchClients();
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate required fields
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
          description: 'Client is required - locations must be associated with a billing entity',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Check for duplicate name
      const { data: existing } = await supabase
        .from('locations')
        .select('id')
        .ilike('name', formData.name.trim())
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

      // Create location
      const { error } = await supabase.from('locations').insert([
        {
          name: formData.name.trim(),
          address: formData.address.trim() || null,
          client_id: formData.client_id,
          is_active: formData.is_active,
        },
      ]);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Location "${formData.name}" created successfully`,
      });

      // Reset form
      setFormData({
        name: '',
        address: '',
        client_id: '',
        is_active: true,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error creating location:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create location',
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
            <DialogTitle>Add New Location</DialogTitle>
            <DialogDescription>
              Create a new work site. Each location must be associated with a client for billing.
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
              {clients.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No clients available. Create a client first.
                </p>
              )}
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
            <Button type="submit" disabled={loading || clients.length === 0}>
              {loading ? 'Creating...' : 'Create Location'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
