import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { VehicleWithDetails } from '@/types/database';
import { format, isSameDay } from 'date-fns';
import { Check, Lock, Loader2, Plus } from 'lucide-react';
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
  washedVehicleIds: Set<string>;
}

interface VehicleTileState {
  isWashed: boolean;
  isLoading: boolean;
  washEntryId?: string;
  createdAt?: Date;
}

export function VehicleGridSelector({
  selectedDate,
  locationIds,
  employeeId,
  onWashAdded,
  cutoffDate,
  washedVehicleIds,
}: VehicleGridSelectorProps) {
  const [vehicles, setVehicles] = useState<VehicleWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [tileStates, setTileStates] = useState<Map<string, VehicleTileState>>(new Map());
  const [undoStack, setUndoStack] = useState<Array<{ vehicleId: string; action: 'add' | 'remove'; washEntryId?: string }>>([]);
  const [showUndo, setShowUndo] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);

  useEffect(() => {
    fetchVehicles();
  }, [locationIds]);

  useEffect(() => {
    console.log('VehicleGridSelector: washedVehicleIds changed:', washedVehicleIds);
    syncTileStatesWithProp();
  }, [washedVehicleIds, vehicles]);

  const syncTileStatesWithProp = () => {
    console.log('VehicleGridSelector: Syncing tile states with prop');
    const newStates = new Map<string, VehicleTileState>();
    
    vehicles.forEach(vehicle => {
      const isWashed = washedVehicleIds.has(vehicle.id);
      const currentState = tileStates.get(vehicle.id);
      
      newStates.set(vehicle.id, {
        isWashed,
        isLoading: currentState?.isLoading || false,
        washEntryId: currentState?.washEntryId,
        createdAt: currentState?.createdAt,
      });
    });

    setTileStates(newStates);
  };

  useEffect(() => {
    if (showUndo) {
      const timer = setTimeout(() => setShowUndo(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showUndo]);

  const fetchVehicles = async () => {
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
        .in('home_location_id', locationIds)
        .eq('is_active', true)
        .order('vehicle_number');

      if (error) throw error;
      setVehicles((data || []) as VehicleWithDetails[]);
    } catch (error) {
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


  const handleTileClick = async (vehicle: VehicleWithDetails) => {
    const currentState = tileStates.get(vehicle.id);
    if (!currentState || currentState.isLoading) return;

    console.log(`VehicleGridSelector: Tile clicked for vehicle ${vehicle.vehicle_number}, current state:`, currentState);

    // Check cutoff date restriction
    if (cutoffDate) {
      const now = new Date();
      const washDate = new Date(selectedDate);
      washDate.setHours(0, 0, 0, 0);
      const cutoffDateTime = new Date(cutoffDate);
      const cutoffDateOnly = new Date(cutoffDate);
      cutoffDateOnly.setHours(0, 0, 0, 0);

      if (now > cutoffDateTime && washDate <= cutoffDateOnly) {
        toast({
          title: 'Entry Period Closed',
          description: `Entry period ended on ${format(cutoffDate, 'EEEE, MMMM d')}`,
          variant: 'destructive',
        });
        return;
      }
    }

    // Set loading state
    setTileStates(prev => new Map(prev).set(vehicle.id, { ...currentState, isLoading: true }));

    try {
      if (currentState.isWashed) {
        console.log(`VehicleGridSelector: Deleting wash entry for ${vehicle.vehicle_number}`);
        
        // Delete ALL wash entries for this vehicle on this date
        // (in case there are duplicates)
        const { error } = await supabase
          .from('wash_entries')
          .delete()
          .eq('vehicle_id', vehicle.id)
          .eq('employee_id', employeeId)
          .eq('wash_date', format(selectedDate, 'yyyy-MM-dd'));

        if (error) throw error;

        console.log(`VehicleGridSelector: Successfully deleted wash entry for ${vehicle.vehicle_number}`);

        // Update local state immediately
        setTileStates(prev => new Map(prev).set(vehicle.id, {
          isWashed: false,
          isLoading: false,
          washEntryId: undefined,
          createdAt: undefined,
        }));

        setUndoStack([{ vehicleId: vehicle.id, action: 'remove', washEntryId: currentState.washEntryId }]);
        setShowUndo(true);

        toast({
          title: 'Removed',
          description: `${vehicle.vehicle_number} removed`,
        });
        
        // Wait a bit before triggering parent refresh to ensure DB propagation
        setTimeout(() => {
          console.log('VehicleGridSelector: Calling onWashAdded after deletion');
          onWashAdded();
        }, 100);
        
        return; // Don't call onWashAdded immediately
      } else {
        console.log(`VehicleGridSelector: Adding wash entry for ${vehicle.vehicle_number}`);
        
        // Determine which location to use - prefer the vehicle's home location if it's in the user's locations
        const actualLocationId = vehicle.home_location_id && locationIds.includes(vehicle.home_location_id)
          ? vehicle.home_location_id
          : locationIds[0]; // Fallback to first assigned location
        
        // Add wash entry
        const { data, error } = await supabase
          .from('wash_entries')
          .insert({
            employee_id: employeeId,
            vehicle_id: vehicle.id,
            wash_date: format(selectedDate, 'yyyy-MM-dd'),
            actual_location_id: actualLocationId,
          })
          .select('id, created_at')
          .single();

        if (error) {
          if (error.code === '23505') {
            toast({
              title: 'Already Washed',
              description: `${vehicle.vehicle_number} already washed today`,
              variant: 'destructive',
            });
          } else {
            throw error;
          }
          setTileStates(prev => new Map(prev).set(vehicle.id, { ...currentState, isLoading: false }));
          return;
        }

        console.log(`VehicleGridSelector: Successfully added wash entry for ${vehicle.vehicle_number}`, data);

        // Update vehicle last seen
        await supabase
          .from('vehicles')
          .update({
            last_seen_location_id: actualLocationId,
            last_seen_date: format(selectedDate, 'yyyy-MM-dd'),
          })
          .eq('id', vehicle.id);

        setTileStates(prev => new Map(prev).set(vehicle.id, {
          isWashed: true,
          isLoading: false,
          washEntryId: data.id,
          createdAt: new Date(data.created_at),
        }));

        setUndoStack([{ vehicleId: vehicle.id, action: 'add', washEntryId: data.id }]);
        setShowUndo(true);

        toast({
          title: '✓ Added',
          description: `${vehicle.vehicle_number} added`,
          className: 'bg-success text-success-foreground',
        });
      }

      console.log('VehicleGridSelector: Calling onWashAdded');
      onWashAdded();
    } catch (error: any) {
      console.error('VehicleGridSelector: Error handling tile click:', error);
      toast({
        title: 'Error',
        description: error.message || 'Operation failed',
        variant: 'destructive',
      });
      setTileStates(prev => new Map(prev).set(vehicle.id, { ...currentState, isLoading: false }));
    }
  };

  const handleUndo = async () => {
    const lastAction = undoStack[undoStack.length - 1];
    if (!lastAction) return;

    const vehicle = vehicles.find(v => v.id === lastAction.vehicleId);
    if (!vehicle) return;

    const currentState = tileStates.get(lastAction.vehicleId);
    if (!currentState) return;

    setTileStates(prev => new Map(prev).set(lastAction.vehicleId, { ...currentState, isLoading: true }));

    try {
      if (lastAction.action === 'add') {
        // Undo add = delete
        if (!lastAction.washEntryId) return;
        
        const { error } = await supabase
          .from('wash_entries')
          .delete()
          .eq('id', lastAction.washEntryId);

        if (error) throw error;

        setTileStates(prev => new Map(prev).set(lastAction.vehicleId, {
          isWashed: false,
          isLoading: false,
        }));
      } else {
        // Undo remove = add
        const { data, error } = await supabase
          .from('wash_entries')
          .insert({
            employee_id: employeeId,
            vehicle_id: lastAction.vehicleId,
            wash_date: format(selectedDate, 'yyyy-MM-dd'),
            actual_location_id: vehicle.home_location_id && locationIds.includes(vehicle.home_location_id)
              ? vehicle.home_location_id
              : locationIds[0],
          })
          .select('id, created_at')
          .single();

        if (error) throw error;

        setTileStates(prev => new Map(prev).set(lastAction.vehicleId, {
          isWashed: true,
          isLoading: false,
          washEntryId: data.id,
          createdAt: new Date(data.created_at),
        }));
      }

      setShowUndo(false);
      setUndoStack([]);
      onWashAdded();

      toast({
        title: 'Undone',
        description: 'Action reversed',
      });
    } catch (error: any) {
      console.error('Error undoing action:', error);
      toast({
        title: 'Error',
        description: 'Failed to undo',
        variant: 'destructive',
      });
      setTileStates(prev => new Map(prev).set(lastAction.vehicleId, { ...currentState, isLoading: false }));
    }
  };

  const handleVehicleCreated = async (vehicleId: string) => {
    console.log('New vehicle created:', vehicleId);
    
    // Refresh the vehicle list and wait for it to complete
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
        .in('home_location_id', locationIds)
        .eq('is_active', true)
        .order('vehicle_number');

      if (error) throw error;
      
      const updatedVehicles = (data || []) as VehicleWithDetails[];
      setVehicles(updatedVehicles);
      
      // Find the newly created vehicle in the fresh data
      const newVehicle = updatedVehicles.find(v => v.id === vehicleId);
      
      if (newVehicle) {
        // Initialize tile state for the new vehicle
        setTileStates(prev => {
          const newStates = new Map(prev);
          newStates.set(newVehicle.id, {
            isWashed: false,
            isLoading: false,
          });
          return newStates;
        });
        
        // Wait for state to settle, then auto-click the tile
        setTimeout(() => {
          console.log('Auto-clicking newly created vehicle:', newVehicle.vehicle_number);
          handleTileClick(newVehicle);
        }, 300);
      } else {
        console.error('Could not find newly created vehicle in refreshed list');
      }
    } catch (error) {
      console.error('Error refreshing vehicles:', error);
      toast({
        title: 'Error',
        description: 'Failed to refresh vehicle list',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  const washedCount = Array.from(tileStates.values()).filter(state => state.isWashed).length;

  return (
    <div className="space-y-6">
      {/* Daily Summary */}
      <div className="sticky top-0 z-10 bg-gradient-to-br from-slate-50/95 to-white/95 backdrop-blur-sm py-4 border-b shadow-sm">
        <div className="text-center space-y-2">
          <div className="text-xl md:text-2xl font-bold text-foreground">
            Today: <span className="text-blue-600">{washedCount}</span> / {vehicles.length}
          </div>
          <div className="w-full max-w-lg mx-auto h-2 bg-slate-200 rounded-full overflow-hidden shadow-inner">
            <div
              className="h-full transition-all duration-500 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
              style={{ width: `${vehicles.length > 0 ? (washedCount / vehicles.length) * 100 : 0}%` }}
            />
          </div>
          {vehicles.length > 0 && washedCount > 0 && (
            <div className="text-xs font-medium text-slate-600">
              {Math.round((washedCount / vehicles.length) * 100)}% Complete
            </div>
          )}
        </div>
      </div>

      {/* Vehicle Grid - Spreadsheet Style */}
      <div className="bg-slate-50 rounded-lg p-2">
        <div className="grid grid-cols-3 gap-1 max-w-2xl mx-auto">
          {/* Vehicle tiles */}
          {vehicles.map(vehicle => {
            const state = tileStates.get(vehicle.id) || { isWashed: false, isLoading: false };
            
            return (
              <button
                key={vehicle.id}
                onClick={() => handleTileClick(vehicle)}
                disabled={state.isLoading}
                style={{
                  WebkitTapHighlightColor: 'transparent',
                }}
                className={cn(
                  "relative h-12 min-h-[48px] rounded transition-all duration-150",
                  "flex items-center justify-center touch-manipulation",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1",
                  "font-mono font-semibold text-base",
                  // Default state - sleek raised cell
                  !state.isWashed && !state.isLoading && [
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
                  state.isWashed && !state.isLoading && [
                    "bg-gradient-to-br from-emerald-400 via-teal-400 to-cyan-500",
                    "border border-teal-500/40",
                    "shadow-[inset_2px_2px_6px_rgba(20,184,166,0.4),inset_-2px_-2px_6px_rgba(255,255,255,0.2),0_2px_4px_rgba(20,184,166,0.3)]",
                    "text-white",
                  ],
                  // Loading state
                  state.isLoading && [
                    "bg-gradient-to-br from-blue-100 to-indigo-100",
                    "border border-blue-300",
                    "cursor-wait opacity-80",
                  ]
                )}
                aria-label={`${vehicle.vehicle_number} - ${state.isWashed ? 'Washed' : 'Not washed'}`}
                aria-pressed={state.isWashed}
              >
                {/* Loading Spinner */}
                {state.isLoading && (
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                )}

                {/* Washed Checkmark */}
                {state.isWashed && !state.isLoading && (
                  <>
                    <span className="drop-shadow-sm">{vehicle.vehicle_number}</span>
                    <Check className="absolute top-1 right-1 h-3.5 w-3.5 text-white drop-shadow-sm animate-in fade-in zoom-in duration-200" strokeWidth={3} />
                  </>
                )}

                {/* Vehicle Number */}
                {!state.isWashed && !state.isLoading && (
                  <span>{vehicle.vehicle_number}</span>
                )}
              </button>
            );
          })}

          {/* Add New Vehicle Button */}
          <button
            onClick={() => setShowAddDialog(true)}
            className={cn(
              "relative h-12 min-h-[48px] rounded transition-all duration-150",
              "flex items-center justify-center gap-2 touch-manipulation",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1",
              "font-mono font-semibold text-sm",
              "bg-gradient-to-b from-blue-50 via-blue-100 to-blue-200",
              "border-2 border-dashed border-blue-400/70",
              "hover:border-blue-500 hover:bg-gradient-to-b hover:from-blue-100 hover:via-blue-200 hover:to-blue-300",
              "hover:-translate-y-px",
              "active:translate-y-0",
              "text-blue-700 hover:text-blue-800"
            )}
            aria-label="Add new vehicle"
          >
            <Plus className="h-5 w-5" />
            <span className="hidden sm:inline">Add Vehicle</span>
          </button>
        </div>
      </div>

      {/* Add Vehicle Dialog */}
      <AddVehicleDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        locationIds={locationIds}
        onVehicleCreated={handleVehicleCreated}
      />

      {/* Undo Button */}
      {showUndo && (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4">
          <Button
            onClick={handleUndo}
            variant="default"
            size="lg"
            className="shadow-lg"
          >
            Undo Last Action
          </Button>
        </div>
      )}
    </div>
  );
}
