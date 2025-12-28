import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface EditServiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: {
    id: string;
    client_id: string;
    location_id: string;
    identifier: string | null;
    work_type: string;
    frequency: string | null;
    rate: number | null;
    rate_type: string;
  };
  clients: { id: string; name: string }[];
}

const FREQUENCY_OPTIONS = [
  { value: '', label: 'None (Hourly work)' },
  { value: '1x/week', label: '1x/week' },
  { value: '2x/week', label: '2x/week' },
  { value: '3x/week', label: '3x/week' },
  { value: 'Daily', label: 'Daily' },
  { value: 'Weekly', label: 'Weekly' },
  { value: 'Bi-weekly', label: 'Bi-weekly' },
  { value: 'Monthly', label: 'Monthly' },
];

export const EditServiceModal = ({ open, onOpenChange, item, clients }: EditServiceModalProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [clientId, setClientId] = useState(item.client_id);
  const [locationId, setLocationId] = useState(item.location_id);
  const [identifier, setIdentifier] = useState(item.identifier || '');
  const [workType, setWorkType] = useState(item.work_type);
  const [frequency, setFrequency] = useState(item.frequency || '');
  const [rateType, setRateType] = useState<'per_unit' | 'hourly'>(
    item.rate_type === 'hourly' ? 'hourly' : 'per_unit'
  );
  const [rate, setRate] = useState(item.rate?.toString() || '');

  // Fetch locations filtered by selected client
  const { data: locations = [] } = useQuery({
    queryKey: ['locations', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('locations')
        .select('id, name')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  // Reset form when item changes
  useEffect(() => {
    setClientId(item.client_id);
    setLocationId(item.location_id);
    setIdentifier(item.identifier || '');
    setWorkType(item.work_type);
    setFrequency(item.frequency || '');
    setRateType(item.rate_type === 'hourly' ? 'hourly' : 'per_unit');
    setRate(item.rate?.toString() || '');
  }, [item]);

  // Reset location when client changes (but keep if it's the original)
  useEffect(() => {
    if (clientId !== item.client_id) {
      setLocationId('');
    }
  }, [clientId, item.client_id]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const rateValue = rate.trim() === '' ? null : parseFloat(rate);
      
      const { error } = await supabase
        .from('billable_items')
        .update({
          client_id: clientId,
          location_id: locationId,
          identifier: identifier.trim() || null,
          work_type: workType.trim(),
          frequency: frequency || null,
          rate_type: rateType,
          rate: rateValue,
          needs_rate_review: rateValue === null,
        })
        .eq('id', item.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billable-items'] });
      toast({ title: 'Service updated successfully' });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: 'Error updating service',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !locationId || !workType.trim()) {
      toast({
        title: 'Missing required fields',
        description: 'Please fill in Client, Location, and Work Type',
        variant: 'destructive',
      });
      return;
    }
    updateMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Service</DialogTitle>
          <DialogDescription>
            Update the billable item details.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4">
            {/* Client */}
            <div className="space-y-2">
              <Label htmlFor="client">Client *</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))
                  }
                </SelectContent>
              </Select>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location">Location *</Label>
              <Select 
                value={locationId} 
                onValueChange={setLocationId}
                disabled={!clientId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={clientId ? "Select a location" : "Select a client first"} />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))
                  }
                </SelectContent>
              </Select>
            </div>

            {/* Identifier */}
            <div className="space-y-2">
              <Label htmlFor="identifier">Identifier</Label>
              <Input
                id="identifier"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g., T-101, License Plate, Asset Tag"
              />
            </div>

            {/* Work Type */}
            <div className="space-y-2">
              <Label htmlFor="workType">Work Type *</Label>
              <Input
                id="workType"
                value={workType}
                onChange={(e) => setWorkType(e.target.value)}
                placeholder="e.g., Box Truck, Pressure Washing, Detail"
              />
            </div>

            {/* Frequency */}
            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency</Label>
              <Select value={frequency || 'none'} onValueChange={(v) => setFrequency(v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select frequency (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((option) => (
                    <SelectItem key={option.value || 'none'} value={option.value || 'none'}>
                      {option.label}
                    </SelectItem>
                  ))
                  }
                </SelectContent>
              </Select>
            </div>

            {/* Rate Type */}
            <div className="space-y-2">
              <Label>Rate Type *</Label>
              <RadioGroup
                value={rateType}
                onValueChange={(v) => setRateType(v as 'per_unit' | 'hourly')}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="per_unit" id="edit_per_unit" />
                  <Label htmlFor="edit_per_unit" className="cursor-pointer">Per Unit</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="hourly" id="edit_hourly" />
                  <Label htmlFor="edit_hourly" className="cursor-pointer">Hourly</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Rate */}
            <div className="space-y-2">
              <Label htmlFor="rate">Rate ($)</Label>
              <Input
                id="rate"
                type="number"
                step="0.01"
                min="0"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="Leave blank to flag for review"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
