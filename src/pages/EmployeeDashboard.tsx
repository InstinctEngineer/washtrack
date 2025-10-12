import { useState, useEffect, useRef } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { WashEntryWithDetails, VehicleWithDetails } from '@/types/database';
import { toast } from '@/hooks/use-toast';
import { format, startOfWeek, endOfWeek, addDays, isToday, isSameDay } from 'date-fns';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ChevronLeft, ChevronRight, X, ChevronDown, ChevronUp } from 'lucide-react';
import { CutoffBanner } from '@/components/CutoffBanner';
import { getCurrentCutoff } from '@/lib/cutoff';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { NewVehicleDialog } from '@/components/NewVehicleDialog';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function EmployeeDashboard() {
  const { userProfile } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [entries, setEntries] = useState<WashEntryWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [cutoffDate, setCutoffDate] = useState<Date | null>(null);
  
  // Vehicle search state
  const [searchTerm, setSearchTerm] = useState('');
  const [vehicles, setVehicles] = useState<VehicleWithDetails[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Week summary state
  const [weekSummaryOpen, setWeekSummaryOpen] = useState(false);
  
  // New vehicle dialog state
  const [showNewVehicleDialog, setShowNewVehicleDialog] = useState(false);
  const [pendingVehicleNumber, setPendingVehicleNumber] = useState('');
  const [pendingWashDate, setPendingWashDate] = useState<Date>(new Date());
  
  // Confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingWash, setPendingWash] = useState<{
    date: Date;
    vehicleNumber: string;
    vehicleId: string;
  } | null>(null);

  useEffect(() => {
    if (userProfile?.id) {
      fetchWeekEntries();
      loadCutoffDate();
    }
  }, [userProfile?.id, currentWeek]);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced vehicle search
  useEffect(() => {
    if (searchTerm.length === 0) {
      setVehicles([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        // Only show vehicles from employee's location
        let startsWithQuery = supabase
          .from('vehicles')
          .select(`
            *,
            vehicle_type:vehicle_types(*),
            home_location:locations!vehicles_home_location_id_fkey(*)
          `)
          .ilike('vehicle_number', `${searchTerm}%`)
          .eq('is_active', true)
          .limit(5);
        
        if (userProfile?.location_id) {
          startsWithQuery = startsWithQuery.eq('home_location_id', userProfile.location_id);
        }
        
        const { data: startsWithData } = await startsWithQuery;

        const startsWithNumbers = startsWithData?.map(v => v.vehicle_number) || [];
        
        let containsQuery = supabase
          .from('vehicles')
          .select(`
            *,
            vehicle_type:vehicle_types(*),
            home_location:locations!vehicles_home_location_id_fkey(*)
          `)
          .ilike('vehicle_number', `%${searchTerm}%`)
          .eq('is_active', true);
        
        if (userProfile?.location_id) {
          containsQuery = containsQuery.eq('home_location_id', userProfile.location_id);
        }
        
        if (startsWithNumbers.length > 0) {
          containsQuery = containsQuery.not('vehicle_number', 'in', `(${startsWithNumbers.join(',')})`);
        }
        
        const { data: containsData } = await containsQuery.limit(5);

        // Combine results (already filtered by location)
        const allVehicles = [...(startsWithData || []), ...(containsData || [])];

        setVehicles(allVehicles.slice(0, 5));
        setShowDropdown(true);
      } catch (error) {
        console.error('Error searching vehicles:', error);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchTerm, userProfile?.location_id]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadCutoffDate = async () => {
    const cutoff = await getCurrentCutoff();
    setCutoffDate(cutoff);
  };

  const fetchWeekEntries = async () => {
    if (!userProfile?.id) return;

    setLoading(true);
    try {
      const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });

      const { data, error } = await supabase
        .from('wash_entries')
        .select(`
          *,
          vehicle:vehicles(
            *,
            vehicle_type:vehicle_types(*),
            home_location:locations!vehicles_home_location_id_fkey(*)
          ),
          employee:users!wash_entries_employee_id_fkey(*),
          actual_location:locations(*)
        `)
        .eq('employee_id', userProfile.id)
        .gte('wash_date', format(weekStart, 'yyyy-MM-dd'))
        .lte('wash_date', format(weekEnd, 'yyyy-MM-dd'))
        .order('created_at', { ascending: false });

      if (error) throw error;

      setEntries((data || []) as WashEntryWithDetails[]);
    } catch (error: any) {
      console.error('Error fetching wash entries:', error);
      toast({
        title: 'Error',
        description: 'Failed to load wash entries',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectVehicle = (vehicle: VehicleWithDetails) => {
    // Check if adding for a non-today date
    if (!isToday(selectedDate)) {
      setPendingWash({
        date: selectedDate,
        vehicleNumber: vehicle.vehicle_number,
        vehicleId: vehicle.id,
      });
      setShowConfirmDialog(true);
      setSearchTerm('');
      setShowDropdown(false);
    } else {
      handleAddWash(selectedDate, vehicle.vehicle_number, vehicle.id);
      setSearchTerm('');
      setShowDropdown(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      // Check if adding for a non-today date
      if (!isToday(selectedDate)) {
        setPendingWash({
          date: selectedDate,
          vehicleNumber: searchTerm.trim(),
          vehicleId: '',
        });
        setShowConfirmDialog(true);
        setSearchTerm('');
        setShowDropdown(false);
      } else {
        handleAddWash(selectedDate, searchTerm.trim(), '');
        setSearchTerm('');
        setShowDropdown(false);
      }
    }
  };

  const handleConfirmWash = () => {
    if (pendingWash) {
      handleAddWash(pendingWash.date, pendingWash.vehicleNumber, pendingWash.vehicleId);
      setPendingWash(null);
      setShowConfirmDialog(false);
      inputRef.current?.focus();
    }
  };

  const handlePreviousDay = () => {
    setSelectedDate(prev => addDays(prev, -1));
  };

  const handleNextDay = () => {
    setSelectedDate(prev => addDays(prev, 1));
  };

  const handleAddWash = async (date: Date, vehicleNumber: string, vehicleId: string) => {
    if (!userProfile?.id || !userProfile?.location_id) {
      toast({
        title: 'Error',
        description: 'Contact admin to assign your location',
        variant: 'destructive',
      });
      return;
    }

    // Check cutoff date restriction for employees
    // Week leading up to cutoff is allowed for entry
    // After cutoff passes, those dates become locked
    if (cutoffDate && userProfile.role === 'employee') {
      const now = new Date();
      const washDate = new Date(date);
      washDate.setHours(0, 0, 0, 0);
      
      const cutoffDateTime = new Date(cutoffDate);
      const cutoffDateOnly = new Date(cutoffDate);
      cutoffDateOnly.setHours(0, 0, 0, 0);
      
      // Block only if:
      // 1. Current time has passed the cutoff date/time, AND
      // 2. The wash date being entered is on or before the cutoff date
      if (now > cutoffDateTime && washDate <= cutoffDateOnly) {
        toast({
          title: 'Entry Period Closed',
          description: `Entry period ended on ${format(cutoffDate, 'EEEE, MMMM d')}. Contact your manager for corrections.`,
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      // If vehicleId is empty, we need to look up or create the vehicle
      let finalVehicleId = vehicleId;
      
      if (!finalVehicleId) {
        const { data: vehicleData, error: vehicleError } = await supabase
          .from('vehicles')
          .select('id')
          .eq('vehicle_number', vehicleNumber)
          .eq('is_active', true)
          .single();

        if (vehicleError || !vehicleData) {
          // Vehicle not found - open dialog for manual type selection
          setPendingVehicleNumber(vehicleNumber);
          setPendingWashDate(date);
          setShowNewVehicleDialog(true);
          return;
        } else {
          finalVehicleId = vehicleData.id;
        }
      }

      // Insert wash entry
      const { error: insertError } = await supabase
        .from('wash_entries')
        .insert({
          employee_id: userProfile.id,
          vehicle_id: finalVehicleId,
          wash_date: format(date, 'yyyy-MM-dd'),
          actual_location_id: userProfile.location_id,
        });

      if (insertError) {
        if (insertError.code === '23505') {
          toast({
            title: 'Duplicate Entry',
            description: `${vehicleNumber} already washed today`,
            variant: 'destructive',
          });
        } else {
          throw insertError;
        }
        return;
      }

      // Update vehicle last seen
      await supabase
        .from('vehicles')
        .update({
          last_seen_location_id: userProfile.location_id,
          last_seen_date: format(date, 'yyyy-MM-dd'),
        })
        .eq('id', finalVehicleId);

      toast({
        title: '✓ Vehicle Added',
        description: `${vehicleNumber} added successfully`,
        className: 'bg-green-50 text-green-900 border-green-200',
      });

      // Refresh entries
      fetchWeekEntries();
    } catch (error: any) {
      console.error('Error adding wash entry:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add wash entry',
        variant: 'destructive',
      });
    }
  };

  const handleCreateVehicle = async (vehicleTypeId: string) => {
    if (!userProfile?.location_id) return;

    try {
      // Create new vehicle with selected type
      const { data: newVehicle, error: createError } = await supabase
        .from('vehicles')
        .insert({
          vehicle_number: pendingVehicleNumber,
          vehicle_type_id: vehicleTypeId,
          home_location_id: userProfile.location_id,
          is_active: true,
        })
        .select('id')
        .single();

      if (createError || !newVehicle) {
        toast({
          title: 'Error',
          description: 'Failed to create vehicle. Try again.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'New Vehicle Created',
        description: `Vehicle ${pendingVehicleNumber} has been added to the system.`,
      });

      // Now add the wash entry with the newly created vehicle
      const { error: insertError } = await supabase
        .from('wash_entries')
        .insert({
          employee_id: userProfile.id,
          vehicle_id: newVehicle.id,
          wash_date: format(pendingWashDate, 'yyyy-MM-dd'),
          actual_location_id: userProfile.location_id,
        });

      if (insertError) {
        if (insertError.code === '23505') {
          toast({
            title: 'Duplicate Entry',
            description: `${pendingVehicleNumber} already washed today`,
            variant: 'destructive',
          });
        } else {
          throw insertError;
        }
        return;
      }

      // Update vehicle last seen
      await supabase
        .from('vehicles')
        .update({
          last_seen_location_id: userProfile.location_id,
          last_seen_date: format(pendingWashDate, 'yyyy-MM-dd'),
        })
        .eq('id', newVehicle.id);

      toast({
        title: '✓ Vehicle Added',
        description: `${pendingVehicleNumber} added successfully`,
        className: 'bg-green-50 text-green-900 border-green-200',
      });

      // Clear pending state and refresh entries
      setPendingVehicleNumber('');
      fetchWeekEntries();
    } catch (error: any) {
      console.error('Error creating vehicle and wash entry:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add vehicle',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteWash = async (id: string) => {
    try {
      const { error } = await supabase
        .from('wash_entries')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Wash entry deleted',
      });

      fetchWeekEntries();
    } catch (error: any) {
      console.error('Error deleting wash entry:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete wash entry',
        variant: 'destructive',
      });
    }
  };

  if (!userProfile?.location_id) {
    return (
      <Layout>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Contact admin to assign your location before tracking washes
          </AlertDescription>
        </Alert>
      </Layout>
    );
  }

  // Get entries for selected date
  const todayEntries = entries.filter(entry => entry.wash_date === format(selectedDate, 'yyyy-MM-dd'));
  
  // Get entries by day for week summary
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const entriesByDay = weekDays.map(day => ({
    day,
    count: entries.filter(entry => entry.wash_date === format(day, 'yyyy-MM-dd')).length
  }));

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-4 pb-20">
        <CutoffBanner />

        {/* Date Navigation */}
        <Card className={cn(
          "sticky top-4 z-10 shadow-lg",
          isToday(selectedDate) && "bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/30"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePreviousDay}
                className="h-12 w-12"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              
              <div className="text-center flex-1">
                <div className="text-lg md:text-xl font-bold">
                  {isToday(selectedDate) ? 'Today' : format(selectedDate, 'EEEE')}
                </div>
                <div className="text-sm md:text-base text-muted-foreground">
                  {format(selectedDate, 'MMMM d, yyyy')}
                </div>
                {!isToday(selectedDate) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedDate(new Date())}
                    className="mt-2 h-7 text-xs"
                  >
                    Back to Today
                  </Button>
                )}
              </div>
              
              <Button
                variant="outline"
                size="icon"
                onClick={handleNextDay}
                className="h-12 w-12"
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Vehicle Entry Section */}
        <Card>
          <CardContent className="p-4 md:p-6 space-y-4">
            <form onSubmit={handleSubmitSearch} className="relative">
              <Input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                placeholder="Enter vehicle number..."
                className="text-lg h-14 text-center font-medium tracking-wide"
                autoComplete="off"
                autoCapitalize="characters"
              />
              
              {showDropdown && vehicles.length > 0 && (
                <div
                  ref={dropdownRef}
                  className="absolute z-50 w-full mt-2 bg-card border rounded-lg shadow-xl overflow-hidden"
                >
                  {vehicles.map((vehicle) => (
                    <button
                      key={vehicle.id}
                      type="button"
                      onClick={() => handleSelectVehicle(vehicle)}
                      className="w-full px-4 py-4 text-left hover:bg-accent transition-colors border-b last:border-b-0 min-h-[48px]"
                    >
                      <div className="font-semibold text-base">{vehicle.vehicle_number}</div>
                      <div className="text-sm text-muted-foreground mt-0.5">
                        {vehicle.vehicle_type?.type_name || 'Unknown'}
                        {vehicle.home_location && ` • ${vehicle.home_location.name}`}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              {showDropdown && searchTerm && vehicles.length === 0 && !isSearching && (
                <div
                  ref={dropdownRef}
                  className="absolute z-50 w-full mt-2 bg-card border rounded-lg shadow-xl p-4 text-center text-muted-foreground"
                >
                  No vehicles found
                </div>
              )}
            </form>

            {searchTerm.trim() && (
              <Button
                type="button"
                onClick={() => handleAddWash(selectedDate, searchTerm.trim(), '')}
                className="w-full h-14 text-lg font-semibold"
                size="lg"
              >
                Add Wash
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Today's Washes Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-bold">
              Washed Today ({todayEntries.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading...
              </div>
            ) : todayEntries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No washes logged yet today
              </div>
            ) : (
              <div className="space-y-2">
                {todayEntries.map((entry) => {
                  const canDelete = isToday(new Date(entry.wash_date));
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-4 bg-accent/50 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-bold text-lg">
                          {entry.vehicle?.vehicle_number}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {entry.vehicle?.vehicle_type?.type_name}
                          {' • '}
                          {format(new Date(entry.created_at), 'h:mm a')}
                        </div>
                      </div>
                      
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteWash(entry.id)}
                          className="h-11 w-11 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <X className="h-5 w-5" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Week Summary - Collapsible */}
        <Collapsible open={weekSummaryOpen} onOpenChange={setWeekSummaryOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold">This Week</CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{entries.length}</span>
                    <span className="text-muted-foreground">vehicles</span>
                    {weekSummaryOpen ? (
                      <ChevronUp className="h-5 w-5 ml-2" />
                    ) : (
                      <ChevronDown className="h-5 w-5 ml-2" />
                    )}
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-2">
                {entriesByDay.map(({ day, count }) => (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                      isSameDay(day, selectedDate)
                        ? 'bg-primary/10 border border-primary/20'
                        : 'bg-accent/30 hover:bg-accent/50'
                    }`}
                  >
                    <div className="font-medium">
                      {format(day, 'EEEE, MMM d')}
                      {isToday(day) && (
                        <span className="ml-2 text-xs text-primary font-bold">TODAY</span>
                      )}
                    </div>
                    <div className="text-lg font-bold">{count}</div>
                  </button>
                ))}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
        
        {/* New Vehicle Dialog */}
        <NewVehicleDialog
          open={showNewVehicleDialog}
          onOpenChange={setShowNewVehicleDialog}
          vehicleNumber={pendingVehicleNumber}
          onConfirm={handleCreateVehicle}
        />

        {/* Confirmation Dialog for Non-Today Dates */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Date</AlertDialogTitle>
              <AlertDialogDescription>
                You are adding a wash for <strong>{pendingWash && format(pendingWash.date, 'EEEE, MMMM d, yyyy')}</strong>, not today.
                <br /><br />
                Vehicle: <strong>{pendingWash?.vehicleNumber}</strong>
                <br /><br />
                Do you want to continue?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmWash}>
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
