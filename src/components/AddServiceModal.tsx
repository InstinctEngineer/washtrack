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
  const [workTypeId, setWorkTypeId] = useState('');
  const [frequency, setFrequency] = useState('');
  const [rate, setRate] = useState('');

  // Fetch work types
  const { data: workTypes = [] } = useQuery({
    queryKey: ['work-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_types')
        .select('id, name, rate_type')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

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
      setWorkTypeId('');
      setFrequency('');
      setRate('');
    }
  }, [open]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const rateValue = rate.trim() === '' ? null : parseFloat(rate);
      const frequencyValue = frequency === 'none' || frequency === '' ? null : frequency;
      
      // First, find or create the rate_config
      let query = supabase
        .from('rate_configs')
        .select('id')
        .eq('client_id', clientId)
        .eq('location_id', locationId)
        .eq('work_type_id', workTypeId);
      
      if (frequencyValue === null) {
        query = query.is('frequency', null);
      } else {
        query = query.eq('frequency', frequencyValue);
      }
      
      const { data: existingConfig, error: findError } = await query.maybeSingle();
      
      if (findError) throw findError;
      
      let rateConfigId: string;
      
      if (existingConfig) {
        rateConfigId = existingConfig.id;
        // Update rate if provided
        if (rateValue !== null) {
          const { error: updateError } = await supabase
            .from('rate_configs')
            .update({ rate: rateValue, needs_rate_review: false })
            .eq('id', rateConfigId);
          if (updateError) throw updateError;
        }
      } else {
        // Create new rate_config
        const { data: newConfig, error: createError } = await supabase
          .from('rate_configs')
          .insert({
            client_id: clientId,
            location_id: locationId,
            work_type_id: workTypeId,
            frequency: frequencyValue,
            rate: rateValue,
            needs_rate_review: rateValue === null,
          })
          .select('id')
          .single();
        
        if (createError) throw createError;
        rateConfigId = newConfig.id;
      }
      
      // Create the work_item
      const { data: workItem, error: workItemError } = await supabase
        .from('work_items')
        .insert({
          rate_config_id: rateConfigId,
          identifier: identifier.trim(),
        })
        .select()
        .single();
      
      if (workItemError) throw workItemError;
      return { workItem, rateValue };
    },
    onSuccess: ({ rateValue }) => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['rate-configs'] });
      
      const message = rateValue !== null
        ? `Service created with rate $${rateValue.toFixed(2)}`
        : 'Service created. Rate needs to be set.';
      
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
    if (!clientId || !locationId || !workTypeId || !identifier.trim()) {
      toast({
        title: 'Missing required fields',
        description: 'Please fill in Client, Location, Work Type, and Identifier',
        variant: 'destructive',
      });
      return;
    }
    createMutation.mutate();
  };

  const selectedWorkType = workTypes.find(wt => wt.id === workTypeId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Service</DialogTitle>
          <DialogDescription>
            Create a new work item. Leave rate blank to flag for review.
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

            {/* Work Type */}
            <div className="space-y-2">
              <Label htmlFor="workType">Work Type *</Label>
              <Select value={workTypeId} onValueChange={setWorkTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a work type" />
                </SelectTrigger>
                <SelectContent>
                  {workTypes.map((wt) => (
                    <SelectItem key={wt.id} value={wt.id}>
                      {wt.name} ({wt.rate_type === 'per_unit' ? 'Per Unit' : 'Hourly'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Identifier */}
            <div className="space-y-2">
              <Label htmlFor="identifier">Identifier *</Label>
              <Input
                id="identifier"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g., T-101, License Plate, Asset Tag"
              />
              <p className="text-xs text-muted-foreground">
                Truck number, asset tag, or other unique identifier
              </p>
            </div>

            {/* Frequency (only for per_unit) */}
            {selectedWorkType?.rate_type === 'per_unit' && (
              <div className="space-y-2">
                <Label htmlFor="frequency">Frequency</Label>
                <Select value={frequency || 'none'} onValueChange={setFrequency}>
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
            )}

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
              <p className="text-xs text-muted-foreground">
                If left blank, the service will be flagged for rate review
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
