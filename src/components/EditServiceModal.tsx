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

interface WorkItemWithJoins {
  id: string;
  rate_config_id: string;
  identifier: string;
  is_active: boolean;
  created_at: string;
  rate_config: {
    id: string;
    client_id: string;
    location_id: string;
    work_type_id: string;
    frequency: string | null;
    rate: number | null;
    needs_rate_review: boolean;
    is_active: boolean;
    client: { id: string; name: string } | null;
    location: { id: string; name: string } | null;
    work_type: { id: string; name: string; rate_type: string } | null;
  } | null;
}

interface EditServiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: WorkItemWithJoins;
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

  const rateConfig = item.rate_config;

  const [identifier, setIdentifier] = useState(item.identifier || '');
  const [rate, setRate] = useState(rateConfig?.rate?.toString() || '');

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

  // Reset form when item changes
  useEffect(() => {
    setIdentifier(item.identifier || '');
    setRate(item.rate_config?.rate?.toString() || '');
  }, [item]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const rateValue = rate.trim() === '' ? null : parseFloat(rate);
      
      // Update work_item identifier
      const { error: itemError } = await supabase
        .from('work_items')
        .update({
          identifier: identifier.trim(),
        })
        .eq('id', item.id);

      if (itemError) throw itemError;

      // Update rate_config rate if it exists
      if (rateConfig) {
        const { error: configError } = await supabase
          .from('rate_configs')
          .update({
            rate: rateValue,
            needs_rate_review: rateValue === null,
          })
          .eq('id', rateConfig.id);

        if (configError) throw configError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['rate-configs'] });
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
    if (!identifier.trim()) {
      toast({
        title: 'Missing required fields',
        description: 'Identifier is required',
        variant: 'destructive',
      });
      return;
    }
    updateMutation.mutate();
  };

  const selectedWorkType = workTypes.find(wt => wt.id === rateConfig?.work_type_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Service</DialogTitle>
          <DialogDescription>
            Update the work item details.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4">
            {/* Client (read-only) */}
            <div className="space-y-2">
              <Label>Client</Label>
              <Input
                value={rateConfig?.client?.name || 'Unknown'}
                disabled
                className="bg-muted"
              />
            </div>

            {/* Location (read-only) */}
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={rateConfig?.location?.name || 'Unknown'}
                disabled
                className="bg-muted"
              />
            </div>

            {/* Work Type (read-only) */}
            <div className="space-y-2">
              <Label>Work Type</Label>
              <Input
                value={selectedWorkType ? `${selectedWorkType.name} (${selectedWorkType.rate_type === 'per_unit' ? 'Per Unit' : 'Hourly'})` : 'Unknown'}
                disabled
                className="bg-muted"
              />
            </div>

            {/* Frequency (read-only) */}
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Input
                value={rateConfig?.frequency || 'None'}
                disabled
                className="bg-muted"
              />
            </div>

            {/* Identifier (editable) */}
            <div className="space-y-2">
              <Label htmlFor="identifier">Identifier *</Label>
              <Input
                id="identifier"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g., T-101, License Plate, Asset Tag"
              />
            </div>

            {/* Rate (editable) */}
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
                This updates the rate for all items with the same rate configuration
              </p>
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
