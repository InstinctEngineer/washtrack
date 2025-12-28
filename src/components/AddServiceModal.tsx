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

interface AddServiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export const AddServiceModal = ({ open, onOpenChange, clients }: AddServiceModalProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [clientId, setClientId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [workType, setWorkType] = useState('');
  const [frequency, setFrequency] = useState('');
  const [rateType, setRateType] = useState<'per_unit' | 'hourly'>('per_unit');
  const [rate, setRate] = useState('');

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

  // Reset location when client changes
  useEffect(() => {
    setLocationId('');
  }, [clientId]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setClientId('');
      setLocationId('');
      setIdentifier('');
      setWorkType('');
      setFrequency('');
      setRateType('per_unit');
      setRate('');
    }
  }, [open]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const rateValue = rate.trim() === '' ? null : parseFloat(rate);
      
      const { data, error } = await supabase
        .from('billable_items')
        .insert({
          client_id: clientId,
          location_id: locationId,
          identifier: identifier.trim() || null,
          work_type: workType.trim(),
          frequency: frequency || null,
          rate_type: rateType,
          rate: rateValue,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['billable-items'] });
      
      const message = data.needs_rate_review
        ? 'Service created. Rate needs review - no matching rate found to inherit.'
        : data.rate !== null
          ? `Service created with rate $${data.rate.toFixed(2)}`
          : 'Service created successfully';
      
      toast({ title: message });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: 'Error creating service',
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
    createMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Service</DialogTitle>
          <DialogDescription>
            Create a new billable item. Leave rate blank to inherit from similar items or flag for review.
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
                  ))}
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
                  ))}
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
              <p className="text-xs text-muted-foreground">
                Optional truck number, asset tag, or other identifier
              </p>
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
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger>
                  <SelectValue placeholder="Select frequency (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((option) => (
                    <SelectItem key={option.value || 'none'} value={option.value || 'none'}>
                      {option.label}
                    </SelectItem>
                  ))}
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
                  <RadioGroupItem value="per_unit" id="per_unit" />
                  <Label htmlFor="per_unit" className="cursor-pointer">Per Unit</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="hourly" id="hourly" />
                  <Label htmlFor="hourly" className="cursor-pointer">Hourly</Label>
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
                placeholder="Leave blank to inherit or flag for review"
              />
              <p className="text-xs text-muted-foreground">
                If left blank, the system will try to inherit from similar items
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Service
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
