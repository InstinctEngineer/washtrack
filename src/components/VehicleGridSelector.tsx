import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { VehicleWithDetails } from '@/types/database';
import { format, isSameDay } from 'date-fns';
import { Check, Loader2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { AddVehicleDialog } from '@/components/AddVehicleDialog';

interface VehicleGridSelectorProps {
  selectedDate: Date;
  locationIds: string[];
  employeeId: string;
  onWashAdded: () => void;
  cutoffDate: Date | null;
}

export function VehicleGridSelector({
  selectedDate,
  locationIds,
  employeeId,
  onWashAdded,
  cutoffDate,
}: VehicleGridSelectorProps) {
  const [vehicles, setVehicles] = useState<VehicleWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Local state for selections (vehicle IDs that user has selected)
  const [selectedVehicles, setSelectedVehicles] = useState<Set<string>>(new Set());
  
  // Track which vehicles already have wash entries in DB (vehicle_id -> wash_entry_id)
  const [existingWashEntries, setExistingWashEntries] = useState<Map<string, { id: string; employee_id: string; employee_name: string }>>(new Map());
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [pendingAutoClickVehicleId, setPendingAutoClickVehicleId] = useState<string | null>(null);

  // Fetch vehicles for the location
  useEffect(() => {
    fetchVehicles();
  }, [locationIds]);

  // Fetch existing wash entries for the selected date
  useEffect(() => {
    fetchExistingWashEntries();
  }, [selectedDate, locationIds]);

  const fetchVehicles = async () => {
    if (!locationIds || locationIds.length === 0) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select(`
          *,
          vehicle_type:vehicle_types(*),
          client:clients(*),
          home_location:locations!vehicles_home_location_id_fkey(*)
        `)
        .eq('is_active', true)
        .in('home_location_id', locationIds)
        .order('vehicle_number');

      if (error) throw error;
      setVehicles((data || []) as VehicleWithDetails[]);
    } catch (error: any) {
      console.error('Error fetching vehicles:', error);
      toast({
        title: 'Error',
        description: 'Failed to load vehicles',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingWashEntries = async () => {
    if (!locationIds || locationIds.length === 0) return;

    try {
      const { data: washEntries } = await supabase
        .from('wash_entries')
        .select(`
          id, 
          vehicle_id, 
          employee_id,
          employee:users!wash_entries_employee_id_fkey(id, name)
        `)
        .is('deleted_at', null)
        .in('actual_location_id', locationIds)
        .eq('wash_date', format(selectedDate, 'yyyy-MM-dd'));
      
      const entriesMap = new Map<string, { id: string; employee_id: string; employee_name: string }>();
      
      (washEntries || []).forEach((entry: any) => {
        entriesMap.set(entry.vehicle_id, { 
          id: entry.id, 
          employee_id: entry.employee_id,
          employee_name: entry.employee?.name || 'Unknown'
        });
      });
      
      setExistingWashEntries(entriesMap);
      
      // Initialize selected vehicles with existing entries
      const existingIds = new Set(entriesMap.keys());
      setSelectedVehicles(existingIds);
    } catch (error: any) {
      console.error('Error fetching wash entries:', error);
    }
  };

  const handleVehicleToggle = (vehicleId: string) => {
    // Check if this vehicle has an existing entry by another employee
    const existingEntry = existingWashEntries.get(vehicleId);
    if (existingEntry && existingEntry.employee_id !== employeeId) {
      toast({
        title: 'Cannot Modify',
        description: `This vehicle was washed by ${existingEntry.employee_name}. Only they can modify it.`,
        variant: 'destructive',
      });
      return;
    }

    // If it's already in DB and it's a past date, don't allow toggle
    if (existingEntry && !isSameDay(selectedDate, new Date())) {
      toast({
        title: 'Cannot Modify Past Entry',
        description: 'You cannot modify wash entries from past dates. Contact your manager if changes are needed.',
        variant: 'destructive',
      });
      return;
    }

    setSelectedVehicles(prev => {
      const next = new Set(prev);
      if (next.has(vehicleId)) {
        next.delete(vehicleId);
      } else {
        next.add(vehicleId);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (!authUser) {
      toast({
        title: 'Authentication Required',
        description: 'You must be logged in to submit wash entries',
        variant: 'destructive',
      });
      return;
    }

    // Check cutoff date
    if (cutoffDate && selectedDate < cutoffDate) {
      toast({
        title: 'Date Locked',
        description: `Cannot submit entries before ${format(cutoffDate, 'MMM d, yyyy')}. Contact your manager.`,
        variant: 'destructive',
      });
      return;
    }

    // Find vehicles to add (selected but not in DB)
    const vehiclesToAdd = Array.from(selectedVehicles).filter(
      vehicleId => !existingWashEntries.has(vehicleId)
    );

    // Find vehicles to remove (in DB but not selected, and owned by current employee)
    const vehiclesToRemove = Array.from(existingWashEntries.entries())
      .filter(([vehicleId, entry]) => 
        !selectedVehicles.has(vehicleId) && 
        entry.employee_id === employeeId
      )
      .map(([vehicleId]) => vehicleId);

    if (vehiclesToAdd.length === 0 && vehiclesToRemove.length === 0) {
      toast({
        title: 'No Changes',
        description: 'No changes to submit',
      });
      return;
    }

    setSubmitting(true);

    try {
      // Add new wash entries
      if (vehiclesToAdd.length > 0) {
        const entriesToInsert = vehiclesToAdd.map(vehicleId => {
          const vehicle = vehicles.find(v => v.id === vehicleId);
          const actualLocationId = vehicle?.home_location_id && locationIds.includes(vehicle.home_location_id)
            ? vehicle.home_location_id
            : locationIds[0];

          return {
            employee_id: authUser.id,
            vehicle_id: vehicleId,
            wash_date: format(selectedDate, 'yyyy-MM-dd'),
            actual_location_id: actualLocationId,
          };
        });

        const { error: insertError } = await supabase
          .from('wash_entries')
          .insert(entriesToInsert);

        if (insertError) throw insertError;

        // Update vehicle last_seen for added vehicles
        for (const vehicleId of vehiclesToAdd) {
          const vehicle = vehicles.find(v => v.id === vehicleId);
          const actualLocationId = vehicle?.home_location_id && locationIds.includes(vehicle.home_location_id)
            ? vehicle.home_location_id
            : locationIds[0];

          await supabase
            .from('vehicles')
            .update({
              last_seen_location_id: actualLocationId,
              last_seen_date: format(selectedDate, 'yyyy-MM-dd'),
            })
            .eq('id', vehicleId);
        }
      }

      // Remove wash entries (soft delete)
      if (vehiclesToRemove.length > 0) {
        const washEntryIds = vehiclesToRemove
          .map(vehicleId => existingWashEntries.get(vehicleId)?.id)
          .filter(Boolean) as string[];

        if (washEntryIds.length > 0) {
          const { error: deleteError } = await supabase
            .from('wash_entries')
            .update({
              deleted_at: new Date().toISOString(),
              deleted_by: authUser.id,
              deletion_reason: 'Removed by employee on same day',
            })
            .in('id', washEntryIds);

          if (deleteError) throw deleteError;
        }
      }

      toast({
        title: 'Success',
        description: `${vehiclesToAdd.length} added, ${vehiclesToRemove.length} removed`,
        className: 'bg-success text-success-foreground',
      });

      // Refresh data
      await fetchExistingWashEntries();
      onWashAdded();
    } catch (error: any) {
      console.error('Error submitting wash entries:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit changes',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleVehicleCreated = (newVehicleId: string) => {
    setShowAddDialog(false);
    setPendingAutoClickVehicleId(newVehicleId);
    fetchVehicles();
  };

  // Auto-select newly created vehicle
  useEffect(() => {
    if (pendingAutoClickVehicleId && vehicles.some(v => v.id === pendingAutoClickVehicleId)) {
      setSelectedVehicles(prev => new Set(prev).add(pendingAutoClickVehicleId));
      setPendingAutoClickVehicleId(null);
      
      toast({
        title: 'Vehicle Added',
        description: 'New vehicle has been selected. Click Submit to save.',
      });
    }
  }, [pendingAutoClickVehicleId, vehicles]);

  const selectedCount = selectedVehicles.size;
  const existingCount = existingWashEntries.size;
  const newSelectionsCount = Array.from(selectedVehicles).filter(id => !existingWashEntries.has(id)).length;
  const hasChanges = newSelectionsCount > 0 || selectedCount !== existingCount;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Bar */}
      <div className="flex items-center justify-between p-4 bg-accent/30 rounded-lg">
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{selectedCount}</div>
            <div className="text-xs text-muted-foreground">Selected</div>
          </div>
          {newSelectionsCount > 0 && (
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{newSelectionsCount}</div>
              <div className="text-xs text-muted-foreground">New</div>
            </div>
          )}
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="success"
            size="sm"
            onClick={() => setShowAddDialog(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Vehicle
          </Button>
          
          <Button
            onClick={handleSubmit}
            disabled={!hasChanges || submitting}
            variant={hasChanges ? "success" : "outline"}
            size="sm"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Submit'
            )}
          </Button>
        </div>
      </div>

      {/* Vehicle Grid */}
      {vehicles.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No vehicles found for your location.</p>
          <Button
            variant="success"
            size="sm"
            onClick={() => setShowAddDialog(true)}
            className="mt-4"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add First Vehicle
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {vehicles.map((vehicle) => {
            const isSelected = selectedVehicles.has(vehicle.id);
            const existingEntry = existingWashEntries.get(vehicle.id);
            const isOwnedByOther = existingEntry && existingEntry.employee_id !== employeeId;

            return (
              <button
                key={vehicle.id}
                onClick={() => handleVehicleToggle(vehicle.id)}
                disabled={isOwnedByOther}
                className={cn(
                  'relative p-4 rounded-lg border-2 transition-all duration-200',
                  'hover:shadow-md active:scale-95',
                  'flex flex-col items-center justify-center gap-2',
                  'min-h-[100px]',
                  isSelected
                    ? 'bg-teal-500 text-white border-teal-500 shadow-lg'
                    : 'bg-card border-border hover:border-teal-400',
                  isOwnedByOther && 'opacity-50 cursor-not-allowed'
                )}
              >
                {isSelected && (
                  <Check className="absolute top-2 right-2 h-5 w-5" />
                )}
                
                <div className="text-center">
                  <div className="font-mono font-bold text-lg">
                    {vehicle.vehicle_number}
                  </div>
                  <div className="text-xs opacity-80">
                    {vehicle.vehicle_type?.type_name || 'Unknown Type'}
                  </div>
                  {isOwnedByOther && (
                    <div className="text-xs mt-1 opacity-70">
                      By {existingEntry.employee_name}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Add Vehicle Dialog */}
      <AddVehicleDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        locationIds={locationIds}
        onVehicleCreated={handleVehicleCreated}
      />
    </div>
  );
}
