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
    <div className="space-y-6">
      {/* Daily Summary */}
      <div className="sticky top-0 z-10 bg-gradient-to-br from-gray-50 to-white py-6 border-b shadow-sm">
        <div className="text-center space-y-3">
          <div className="text-2xl md:text-3xl font-bold text-foreground">
            Today's Count: <span className="bg-gradient-to-r from-purple-500 to-purple-600 bg-clip-text text-transparent">{washedCount}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {washedCount} of {vehicles.length} vehicles washed
          </div>
          <div className="w-full max-w-md mx-auto h-3 bg-gray-200 rounded-full overflow-hidden relative shadow-inner">
            <div
              className="h-full transition-all duration-500 rounded-full bg-gradient-to-r from-purple-300 to-purple-400 shadow-lg"
              style={{ width: `${vehicles.length > 0 ? (washedCount / vehicles.length) * 100 : 0}%` }}
            />
            {vehicles.length > 0 && washedCount > 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-700">
                {Math.round((washedCount / vehicles.length) * 100)}%
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Vehicle Grid */}
      <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-4 shadow-sm">
        <div className="grid grid-cols-3 gap-3 max-w-4xl mx-auto">
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
                  "relative h-16 min-h-[48px] rounded-xl transition-all duration-200",
                  "flex items-center justify-center touch-manipulation",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2",
                  "font-semibold text-lg",
                  // Default state - 3D raised effect
                  !state.isWashed && !state.isLoading && [
                    "bg-gradient-to-br from-white to-gray-100",
                    "border border-gray-200",
                    "shadow-[6px_6px_12px_#d1d5db,-6px_-6px_12px_#ffffff]",
                    "hover:shadow-[8px_8px_16px_#d1d5db,-8px_-8px_16px_#ffffff]",
                    "hover:-translate-y-0.5",
                    "active:translate-y-0.5",
                    "active:shadow-[3px_3px_6px_#d1d5db,-3px_-3px_6px_#ffffff]",
                    "text-gray-700",
                  ],
                  // Washed state - 3D pressed in effect
                  state.isWashed && !state.isLoading && [
                    "bg-gradient-to-br from-purple-300 to-purple-400",
                    "border border-purple-400",
                    "shadow-[inset_4px_4px_8px_rgba(147,51,234,0.3),inset_-4px_-4px_8px_rgba(243,232,255,0.5)]",
                    "translate-y-0.5",
                    "text-white",
                  ],
                  // Loading state
                  state.isLoading && [
                    "bg-gradient-to-br from-purple-200 to-purple-300",
                    "border border-purple-300",
                    "cursor-wait opacity-70",
                  ]
                )}
                aria-label={`${vehicle.vehicle_number} - ${state.isWashed ? 'Washed' : 'Not washed'}`}
                aria-pressed={state.isWashed}
              >
                {/* Loading Spinner */}
                {state.isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/20 rounded-xl backdrop-blur-sm">
                    <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                  </div>
                )}

                {/* Washed Checkmark - Small and elegant */}
                {state.isWashed && !state.isLoading && (
                  <div className="absolute top-1.5 right-1.5 animate-in fade-in duration-300">
                    <Check className="h-4 w-4 text-white drop-shadow-sm" strokeWidth={3} />
                  </div>
                )}

                {/* Vehicle Number - Only ID */}
                <span className="text-center">
                  {vehicle.vehicle_number}
                </span>
              </button>
            );
          })}
        </div>
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
