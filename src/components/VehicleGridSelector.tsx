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
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Daily Summary */}
      <div className="sticky top-0 z-10 bg-gradient-to-br from-slate-50/95 to-white/95 backdrop-blur-sm py-4 border-b shadow-sm">
        <div className="text-center space-y-2">
          <div className="text-xl md:text-2xl font-bold text-foreground">
            Today: <span className="text-blue-600">{selectedCount}</span> / {vehicles.length}
          </div>
          <div className="w-full max-w-lg mx-auto h-2 bg-slate-200 rounded-full overflow-hidden shadow-inner">
            <div
              className="h-full transition-all duration-500 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
              style={{ width: `${vehicles.length > 0 ? (selectedCount / vehicles.length) * 100 : 0}%` }}
            />
          </div>
          {vehicles.length > 0 && selectedCount > 0 && (
            <div className="text-xs font-medium text-slate-600">
              {Math.round((selectedCount / vehicles.length) * 100)}% Complete
            </div>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end items-center px-2 pb-4">
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

      {/* Vehicle Grid - Spreadsheet Style */}
      {vehicles.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No vehicles found for your location.</p>
        </div>
      ) : (
        <div className="bg-slate-50 rounded-lg p-2">
          <div className="grid grid-cols-3 gap-1 max-w-2xl mx-auto">
            {vehicles.map((vehicle) => {
              const isSelected = selectedVehicles.has(vehicle.id);
              const existingEntry = existingWashEntries.get(vehicle.id);
              const isOwnedByOther = existingEntry && existingEntry.employee_id !== employeeId;

              return (
                <button
                  key={vehicle.id}
                  onClick={() => handleVehicleToggle(vehicle.id)}
                  disabled={isOwnedByOther}
                  style={{
                    WebkitTapHighlightColor: 'transparent',
                  }}
                  className={cn(
                    "relative h-12 min-h-[48px] rounded transition-all duration-150",
                    "flex items-center justify-center touch-manipulation",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1",
                    "font-mono font-semibold text-base",
                    // Default state - sleek raised cell
                    !isSelected && [
                      "bg-gradient-to-b from-white via-slate-50 to-slate-100",
                      "border border-slate-300/50",
                      "shadow-[2px_2px_5px_rgba(100,116,139,0.15),-1px_-1px_3px_rgba(255,255,255,0.7)]",
                      "hover:shadow-[3px_3px_8px_rgba(100,116,139,0.2),-2px_-2px_4px_rgba(255,255,255,0.8)]",
                      "hover:border-blue-400/50",
                      "hover:-translate-y-px",
                      "active:translate-y-0",
                      "active:shadow-[inset_1px_1px_3px_rgba(100,116,139,0.2)]",
                      "text-slate-700",
                    ],
                    // Washed state - vibrant pressed effect
                    isSelected && [
                      "bg-gradient-to-br from-emerald-400 via-teal-400 to-cyan-500",
                      "border border-teal-500/40",
                      "shadow-[inset_2px_2px_6px_rgba(20,184,166,0.4),inset_-2px_-2px_6px_rgba(255,255,255,0.2),0_2px_4px_rgba(20,184,166,0.3)]",
                      "text-white",
                    ],
                    isOwnedByOther && "opacity-50 cursor-not-allowed"
                  )}
                  aria-label={`${vehicle.vehicle_number} - ${isSelected ? 'Washed' : 'Not washed'}`}
                  aria-pressed={isSelected}
                >
                  {/* Vehicle Number (always visible) */}
                  <span className={isSelected ? "drop-shadow-sm" : ""}>
                    {vehicle.vehicle_number}
                  </span>
                  
                  {/* Washed Checkmark */}
                  {isSelected && (
                    <Check 
                      className="absolute top-1 right-1 h-3.5 w-3.5 text-white drop-shadow-sm animate-in fade-in zoom-in duration-200" 
                      strokeWidth={3} 
                    />
                  )}
                </button>
              );
            })}

            {/* Add Vehicle Button - Always Last */}
            <button
              onClick={() => setShowAddDialog(true)}
              className={cn(
                "relative h-12 min-h-[48px] rounded transition-all duration-150",
                "flex items-center justify-center gap-1.5 touch-manipulation",
                "bg-white border-2 border-dashed border-blue-500",
                "text-blue-600 font-medium text-sm",
                "hover:bg-blue-50 hover:border-blue-600",
                "active:bg-blue-100",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1"
              )}
              aria-label="Add new vehicle"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              <span>Add Vehicle</span>
            </button>
          </div>
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
