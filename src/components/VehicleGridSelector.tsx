import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { VehicleWithDetails } from '@/types/database';
import { format, isSameDay } from 'date-fns';
import { Check, Lock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

interface VehicleGridSelectorProps {
  selectedDate: Date;
  locationId: string;
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
  locationId,
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

  useEffect(() => {
    fetchVehicles();
  }, [locationId]);

  useEffect(() => {
    updateTileStates();
  }, [washedVehicleIds, vehicles]);

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
        .eq('home_location_id', locationId)
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

  const updateTileStates = async () => {
    const newStates = new Map<string, VehicleTileState>();
    
    // Fetch wash entries for the selected date
    try {
      const { data: washEntries } = await supabase
        .from('wash_entries')
        .select('id, vehicle_id, created_at')
        .eq('employee_id', employeeId)
        .eq('wash_date', format(selectedDate, 'yyyy-MM-dd'));

      vehicles.forEach(vehicle => {
        const washEntry = washEntries?.find(entry => entry.vehicle_id === vehicle.id);
        newStates.set(vehicle.id, {
          isWashed: !!washEntry,
          isLoading: false,
          washEntryId: washEntry?.id,
          createdAt: washEntry?.created_at ? new Date(washEntry.created_at) : undefined,
        });
      });
    } catch (error) {
      console.error('Error updating tile states:', error);
    }

    setTileStates(newStates);
  };

  const handleTileClick = async (vehicle: VehicleWithDetails) => {
    const currentState = tileStates.get(vehicle.id);
    if (!currentState || currentState.isLoading) return;

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
        // Delete wash entry
        if (!currentState.washEntryId) return;

        // Check if entry was created today
        const today = new Date();
        if (currentState.createdAt && !isSameDay(currentState.createdAt, today)) {
          toast({
            title: 'Cannot Remove',
            description: 'Cannot remove entries from previous days',
            variant: 'destructive',
          });
          setTileStates(prev => new Map(prev).set(vehicle.id, { ...currentState, isLoading: false }));
          return;
        }

        const { error } = await supabase
          .from('wash_entries')
          .delete()
          .eq('id', currentState.washEntryId);

        if (error) throw error;

        setTileStates(prev => new Map(prev).set(vehicle.id, {
          isWashed: false,
          isLoading: false,
        }));

        setUndoStack([{ vehicleId: vehicle.id, action: 'remove', washEntryId: currentState.washEntryId }]);
        setShowUndo(true);

        toast({
          title: 'Removed',
          description: `${vehicle.vehicle_number} removed`,
        });
      } else {
        // Add wash entry
        const { data, error } = await supabase
          .from('wash_entries')
          .insert({
            employee_id: employeeId,
            vehicle_id: vehicle.id,
            wash_date: format(selectedDate, 'yyyy-MM-dd'),
            actual_location_id: locationId,
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

        // Update vehicle last seen
        await supabase
          .from('vehicles')
          .update({
            last_seen_location_id: locationId,
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

      onWashAdded();
    } catch (error: any) {
      console.error('Error handling tile click:', error);
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
            actual_location_id: locationId,
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
    <div className="space-y-4">
      {/* Daily Summary */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-4 border-b">
        <div className="text-center space-y-3">
          <div className="text-2xl md:text-3xl font-bold text-foreground">
            Today's Count: <span className="text-primary">{washedCount}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {washedCount} of {vehicles.length} vehicles washed
          </div>
          <div className="w-full max-w-md mx-auto h-3 bg-muted rounded-full overflow-hidden relative">
            <div
              className={cn(
                "h-full transition-all duration-300 rounded-full",
                washedCount === 0 && "bg-muted",
                washedCount > 0 && washedCount < vehicles.length && "bg-warning",
                washedCount === vehicles.length && "bg-success"
              )}
              style={{ width: `${vehicles.length > 0 ? (washedCount / vehicles.length) * 100 : 0}%` }}
            />
            {vehicles.length > 0 && washedCount > 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-foreground">
                {Math.round((washedCount / vehicles.length) * 100)}%
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Vehicle Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 max-w-7xl mx-auto">
        {vehicles.map(vehicle => {
          const state = tileStates.get(vehicle.id) || { isWashed: false, isLoading: false };
          
          return (
            <button
              key={vehicle.id}
              onClick={() => handleTileClick(vehicle)}
              disabled={state.isLoading}
              className={cn(
                "relative aspect-square min-h-[100px] rounded-lg transition-all duration-200",
                "flex flex-col items-center justify-center p-4 touch-manipulation",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "shadow-sm hover:shadow-md active:scale-95",
                // Default state
                !state.isWashed && !state.isLoading && "bg-white border border-gray-300 hover:bg-gray-50",
                // Washed state
                state.isWashed && !state.isLoading && "bg-success text-white border border-success",
                // Loading state
                state.isLoading && "bg-primary/10 border border-primary cursor-wait"
              )}
              aria-label={`${vehicle.vehicle_number} - ${state.isWashed ? 'Washed' : 'Not washed'}`}
              aria-pressed={state.isWashed}
            >
              {/* Loading Spinner */}
              {state.isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-lg">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}

              {/* Washed Checkmark */}
              {state.isWashed && !state.isLoading && (
                <div className="absolute top-2 right-2">
                  <Check className="h-5 w-5" strokeWidth={3} />
                </div>
              )}

              {/* Vehicle Number */}
              <div className="text-2xl font-bold mb-1 text-center">
                {vehicle.vehicle_number}
              </div>

              {/* Vehicle Type */}
              <div className={cn(
                "text-xs text-center",
                state.isWashed ? "text-white/90" : "text-gray-500"
              )}>
                {vehicle.vehicle_type?.type_name || 'Unknown'}
              </div>
            </button>
          );
        })}
      </div>

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
