import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2, Truck } from 'lucide-react';

interface WorkType {
  id: string;
  name: string;
}

interface RateConfig {
  id: string;
  work_type_id: string;
  work_type: WorkType;
}

interface AddVehicleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationId: string;
  preselectedTypeName?: string;
  onSuccess: () => void;
}

export function AddVehicleModal({ 
  open, 
  onOpenChange, 
  locationId, 
  preselectedTypeName,
  onSuccess 
}: AddVehicleModalProps) {
  const [step, setStep] = useState<'enter-id' | 'select-type'>('enter-id');
  const [vehicleId, setVehicleId] = useState('');
  const [isPud, setIsPud] = useState<boolean | null>(null);
  const [selectedWorkTypeId, setSelectedWorkTypeId] = useState<string>('');
  const [rateConfigs, setRateConfigs] = useState<RateConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch available rate configs for this location (per_unit types only)
  useEffect(() => {
    if (!open || !locationId) return;
    
    const fetchRateConfigs = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('rate_configs')
        .select(`
          id,
          work_type_id,
          work_type:work_types!inner(id, name, rate_type)
        `)
        .eq('location_id', locationId)
        .eq('is_active', true)
        .eq('work_types.rate_type', 'per_unit')
        .eq('work_types.is_active', true);

      if (!error && data) {
        // Dedupe by work_type_id (keep first rate_config for each type)
        const seen = new Set<string>();
        const uniqueConfigs = data.filter((rc: any) => {
          if (seen.has(rc.work_type_id)) return false;
          seen.add(rc.work_type_id);
          return true;
        }).map((rc: any) => ({
          id: rc.id,
          work_type_id: rc.work_type_id,
          work_type: rc.work_type as WorkType
        }));
        setRateConfigs(uniqueConfigs);
      }
      setLoading(false);
    };

    fetchRateConfigs();
  }, [open, locationId]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setStep('enter-id');
      setVehicleId('');
      setIsPud(null);
      setSelectedWorkTypeId('');
    }
  }, [open]);

  const handlePudAnswer = (answer: boolean) => {
    setIsPud(answer);
    if (answer) {
      // Find PUD rate config and submit
      const pudConfig = rateConfigs.find(rc => rc.work_type.name.toLowerCase() === 'pud');
      if (pudConfig) {
        setSelectedWorkTypeId(pudConfig.work_type_id);
        handleSubmit(pudConfig.id);
      } else {
        toast({
          title: 'PUD type not found',
          description: 'No PUD rate configuration exists for this location. Please select a type manually.',
          variant: 'destructive'
        });
        setStep('select-type');
      }
    } else {
      setStep('select-type');
    }
  };

  const handleSubmit = async (rateConfigId?: string) => {
    const configId = rateConfigId || rateConfigs.find(rc => rc.work_type_id === selectedWorkTypeId)?.id;
    
    if (!configId) {
      toast({
        title: 'Error',
        description: 'Please select a vehicle type',
        variant: 'destructive'
      });
      return;
    }

    if (!vehicleId.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a vehicle ID',
        variant: 'destructive'
      });
      return;
    }

    setSubmitting(true);

    // Check if this vehicle already exists for this rate_config
    const { data: existing } = await supabase
      .from('work_items')
      .select('id')
      .eq('rate_config_id', configId)
      .eq('identifier', vehicleId.trim())
      .maybeSingle();

    if (existing) {
      toast({
        title: 'Vehicle already exists',
        description: `Vehicle "${vehicleId}" already exists for this type at this location.`,
        variant: 'destructive'
      });
      setSubmitting(false);
      return;
    }

    const { error } = await supabase
      .from('work_items')
      .insert({
        rate_config_id: configId,
        identifier: vehicleId.trim(),
        is_active: true
      });

    setSubmitting(false);

    if (error) {
      toast({
        title: 'Error adding vehicle',
        description: error.message,
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Vehicle added',
        description: `Vehicle "${vehicleId}" has been added successfully.`
      });
      onSuccess();
      onOpenChange(false);
    }
  };

  const nonPudTypes = rateConfigs.filter(rc => rc.work_type.name.toLowerCase() !== 'pud');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Add New Vehicle
          </DialogTitle>
          <DialogDescription>
            {step === 'enter-id' 
              ? 'Enter the vehicle identifier and specify its type.'
              : 'Select the vehicle type for this vehicle.'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : step === 'enter-id' ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="vehicleId">Vehicle ID</Label>
              <Input
                id="vehicleId"
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                placeholder="Enter vehicle number..."
                autoFocus
              />
            </div>

            {vehicleId.trim() && (
              <div className="space-y-3">
                <Label>Is this a PUD?</Label>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handlePudAnswer(true)}
                    disabled={submitting}
                  >
                    {submitting && isPud === true && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Yes
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handlePudAnswer(false)}
                    disabled={submitting}
                  >
                    No
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Vehicle Type</Label>
              <Select value={selectedWorkTypeId} onValueChange={setSelectedWorkTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select vehicle type..." />
                </SelectTrigger>
                <SelectContent>
                  {nonPudTypes.map((rc) => (
                    <SelectItem key={rc.work_type_id} value={rc.work_type_id}>
                      {rc.work_type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('enter-id')}>
                Back
              </Button>
              <Button 
                onClick={() => handleSubmit()} 
                disabled={!selectedWorkTypeId || submitting}
              >
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Vehicle
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
