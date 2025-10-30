import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { WashEntryWithDetails } from '@/types/database';
import { toast } from '@/hooks/use-toast';
import { format, startOfWeek, endOfWeek, addDays, isToday } from 'date-fns';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { CutoffBanner } from '@/components/CutoffBanner';
import { getCurrentCutoff } from '@/lib/cutoff';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { VehicleGridSelector } from '@/components/VehicleGridSelector';
import { cn } from '@/lib/utils';

export default function EmployeeDashboard() {
  const { userProfile, userLocations } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [entries, setEntries] = useState<WashEntryWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [cutoffDate, setCutoffDate] = useState<Date | null>(null);
  const [weekSummaryOpen, setWeekSummaryOpen] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile?.id) {
      fetchWeekEntries();
      loadCutoffDate();
    }
  }, [userProfile?.id, currentWeek]);

  // Check for date change at midnight
  useEffect(() => {
    const checkDateChange = () => {
      const now = new Date();
      const selected = new Date(selectedDate);
      
      if (now.getDate() !== selected.getDate() && isToday(now)) {
        setSelectedDate(new Date());
        fetchWeekEntries();
        toast({
          title: 'New Day Started',
          description: `Now tracking ${format(new Date(), 'EEEE, MMMM d')}`,
        });
      }
    };

    const interval = setInterval(checkDateChange, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [selectedDate]);

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
            client:clients(*),
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


  const handlePreviousDay = () => {
    setSelectedDate(prev => addDays(prev, -1));
  };

  const handleNextDay = () => {
    setSelectedDate(prev => addDays(prev, 1));
  };


  if (!userLocations || userLocations.length === 0) {
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
  const washedVehicleIds = new Set(todayEntries.map(entry => entry.vehicle_id));
  
  // Get entries by day for week summary
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const entriesByDay = weekDays.map(day => {
    const dayEntries = entries.filter(entry => entry.wash_date === format(day, 'yyyy-MM-dd'));
    return {
      day,
      count: dayEntries.length,
      entries: dayEntries
    };
  });

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

        {/* Vehicle Grid Selection */}
        <Card>
          <CardContent className="p-4 md:p-6">
            <VehicleGridSelector
              selectedDate={selectedDate}
              locationIds={userLocations}
              employeeId={userProfile.id}
              onWashAdded={fetchWeekEntries}
              cutoffDate={cutoffDate}
              washedVehicleIds={washedVehicleIds}
            />
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
                {entriesByDay.map(({ day, count, entries: dayEntries }) => {
                  const dayKey = day.toISOString();
                  const isExpanded = expandedDay === dayKey;
                  
                  return (
                    <div key={dayKey} className="space-y-2">
                      <div
                        className={cn(
                          "w-full flex items-center justify-between p-3 rounded-lg transition-colors",
                          isToday(day) && selectedDate.getDate() === day.getDate()
                            ? 'bg-primary/10 border border-primary/20'
                            : 'bg-accent/30'
                        )}
                      >
                        <button
                          onClick={() => setSelectedDate(day)}
                          className="flex-1 flex items-center justify-between hover:opacity-80 transition-opacity"
                        >
                          <div className="font-medium text-left">
                            {format(day, 'EEEE, MMM d')}
                            {isToday(day) && (
                              <span className="ml-2 text-xs text-primary font-bold">TODAY</span>
                            )}
                          </div>
                          <div className="text-lg font-bold">{count}</div>
                        </button>
                        
                        {count > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 ml-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedDay(isExpanded ? null : dayKey);
                            }}
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                      
                      {isExpanded && count > 0 && (
                        <div className="pl-3 pr-3 pb-2 space-y-1">
                          <div className="text-xs text-muted-foreground font-medium mb-2">
                            Vehicles Washed:
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {dayEntries.map((entry) => (
                              <div
                                key={entry.id}
                                className="text-sm bg-background/50 border rounded px-2 py-1 font-mono"
                              >
                                {entry.vehicle?.vehicle_number || 'Unknown'}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    </Layout>
  );
}
