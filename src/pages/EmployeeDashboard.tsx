import { useState, useEffect, useCallback } from 'react';
import { format, subDays, addDays, isToday, isFuture, startOfDay } from 'date-fns';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { CutoffBanner } from '@/components/CutoffBanner';
import { WorkItemGrid, WorkItemWithDetails } from '@/components/WorkItemGrid';
import { LogWorkModal, RateConfigWithDetails } from '@/components/LogWorkModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Clock, Truck, ChevronLeft, ChevronRight, CalendarDays, Send, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getCurrentCutoff } from '@/lib/cutoff';
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

interface Location {
  id: string;
  name: string;
}

interface WorkLogWithDetails {
  id: string;
  work_date: string;
  quantity: number;
  notes: string | null;
  created_at: string;
  work_item_id: string | null;
  rate_config_id: string | null;
  work_item: {
    id: string;
    identifier: string;
    rate_config: {
      id: string;
      rate: number | null;
      frequency: string | null;
      work_type: { id: string; name: string; rate_type: string };
    };
  } | null;
  direct_rate_config: {
    id: string;
    rate: number | null;
    frequency: string | null;
    work_type: { id: string; name: string; rate_type: string };
  } | null;
}

interface PendingEntry {
  workItemId: string;
  identifier: string;
  workTypeName: string;
  quantity: number;
}

function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export default function EmployeeDashboard() {
  const { user, userLocations } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [hourlyConfigs, setHourlyConfigs] = useState<RateConfigWithDetails[]>([]);
  const [recentLogs, setRecentLogs] = useState<WorkLogWithDetails[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [loadingHourly, setLoadingHourly] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  
  // Date navigation state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [cutoffDate, setCutoffDate] = useState<Date | null>(null);
  
  // Pending entries for batch submit
  const [pendingEntries, setPendingEntries] = useState<Map<string, PendingEntry>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Completed items (already logged today at this location by anyone)
  const [completedWorkItemIds, setCompletedWorkItemIds] = useState<Set<string>>(new Set());
  
  // Modal state (for hourly)
  const [selectedRateConfig, setSelectedRateConfig] = useState<RateConfigWithDetails | null>(null);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  

  // Fetch cutoff date
  useEffect(() => {
    getCurrentCutoff().then(setCutoffDate);
  }, []);

  // Fetch locations for employee
  useEffect(() => {
    const fetchLocations = async () => {
      if (!userLocations || userLocations.length === 0) {
        setLoadingLocations(false);
        return;
      }

      const { data, error } = await supabase
        .from('locations')
        .select('id, name')
        .in('id', userLocations)
        .eq('is_active', true)
        .order('name');

      if (!error && data) {
        setLocations(data);
        if (data.length > 0) {
          setSelectedLocationId(data[0].id);
        }
      }
      setLoadingLocations(false);
    };

    fetchLocations();
  }, [userLocations]);

  // Fetch hourly rate configs for selected location
  useEffect(() => {
    const fetchHourlyConfigs = async () => {
      if (!selectedLocationId) return;
      
      setLoadingHourly(true);
      const { data, error } = await supabase
        .from('rate_configs')
        .select(`
          id, rate, frequency,
          work_type:work_types!inner(id, name, rate_type)
        `)
        .eq('location_id', selectedLocationId)
        .eq('is_active', true);

      if (!error && data) {
        // Filter to hourly items
        const hourlyItems = data
          .filter((item: any) => item.work_type?.rate_type === 'hourly')
          .map((item: any) => ({
            id: item.id,
            rate: item.rate,
            frequency: item.frequency,
            work_type: item.work_type,
          })) as RateConfigWithDetails[];
        setHourlyConfigs(hourlyItems);
      }
      setLoadingHourly(false);
    };

    fetchHourlyConfigs();
  }, [selectedLocationId]);

  // Fetch completed work items for selected date at this location (by anyone)
  const fetchCompletedItems = useCallback(async () => {
    if (!selectedLocationId) return;
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    const { data, error } = await supabase
      .from('work_logs')
      .select('work_item_id')
      .eq('work_date', dateStr)
      .not('work_item_id', 'is', null);
    
    if (!error && data) {
      setCompletedWorkItemIds(new Set(data.map(d => d.work_item_id).filter(Boolean) as string[]));
    }
  }, [selectedLocationId, selectedDate]);

  useEffect(() => {
    fetchCompletedItems();
  }, [fetchCompletedItems]);

  // Fetch recent work logs
  const fetchRecentLogs = useCallback(async () => {
    if (!user) return;
    
    setLoadingLogs(true);
    const sevenDaysAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');
    
    const { data, error } = await supabase
      .from('work_logs')
      .select(`
        id, work_date, quantity, notes, created_at, work_item_id, rate_config_id,
        work_item:work_items(
          id, identifier,
          rate_config:rate_configs(
            id, rate, frequency,
            work_type:work_types(id, name, rate_type)
          )
        ),
        direct_rate_config:rate_configs(
          id, rate, frequency,
          work_type:work_types(id, name, rate_type)
        )
      `)
      .eq('employee_id', user.id)
      .gte('work_date', sevenDaysAgo)
      .order('work_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setRecentLogs(data as unknown as WorkLogWithDetails[]);
    }
    setLoadingLogs(false);
  }, [user]);

  useEffect(() => {
    fetchRecentLogs();
  }, [fetchRecentLogs]);

  // Date navigation handlers
  const canGoNext = !isToday(selectedDate);
  const canGoPrev = true; // Employees can always navigate to past dates
  const isNotToday = !isToday(selectedDate);

  const handlePrevDay = () => {
    if (canGoPrev) {
      setSelectedDate(prev => subDays(prev, 1));
    }
  };

  const handleNextDay = () => {
    if (canGoNext) {
      setSelectedDate(prev => addDays(prev, 1));
    }
  };

  const handleGoToToday = () => {
    setSelectedDate(new Date());
  };

  // Work item toggle handler for batch selection
  const handleWorkItemToggle = (workItem: WorkItemWithDetails) => {
    setPendingEntries(prev => {
      const next = new Map(prev);
      if (next.has(workItem.id)) {
        next.delete(workItem.id);
      } else {
        next.set(workItem.id, {
          workItemId: workItem.id,
          identifier: workItem.identifier,
          workTypeName: workItem.rate_config.work_type.name,
          quantity: 1,
        });
      }
      return next;
    });
  };

  // Get selected IDs for WorkItemGrid
  const selectedWorkItemIds = new Set(pendingEntries.keys());

  // Batch submit handler
  const handleBatchSubmit = async () => {
    if (!user || pendingEntries.size === 0) return;
    
    setIsSubmitting(true);
    try {
      const entries = Array.from(pendingEntries.values()).map(entry => ({
        work_item_id: entry.workItemId,
        rate_config_id: null,
        employee_id: user.id,
        work_date: format(selectedDate, 'yyyy-MM-dd'),
        quantity: entry.quantity,
        notes: null,
      }));
      
      const { error } = await supabase.from('work_logs').insert(entries);
      
      if (error) {
        // Handle unique constraint violation
        if (error.code === '23505') {
          toast.error('Some items were already logged for this date');
          await fetchCompletedItems();
          setPendingEntries(new Map());
          return;
        }
        throw error;
      }
      
      toast.success(`Submitted ${pendingEntries.size} ${pendingEntries.size === 1 ? 'entry' : 'entries'}`);
      setPendingEntries(new Map());
      fetchRecentLogs();
      fetchCompletedItems();
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit entries');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Clear all selections
  const handleClearSelections = () => {
    setPendingEntries(new Map());
  };

  const handleHourlySelect = (config: RateConfigWithDetails) => {
    setSelectedRateConfig(config);
    setIsLogModalOpen(true);
  };

  const handleLogSuccess = () => {
    fetchRecentLogs();
  };


  const getLogDisplayInfo = (log: WorkLogWithDetails) => {
    if (log.work_item_id && log.work_item) {
      return {
        label: log.work_item.identifier,
        typeName: log.work_item.rate_config?.work_type?.name || 'Unknown',
        isHourly: false,
      };
    } else if (log.rate_config_id && log.direct_rate_config) {
      return {
        label: log.direct_rate_config.work_type?.name || 'Unknown',
        typeName: null,
        isHourly: true,
      };
    }
    return { label: 'Unknown', typeName: null, isHourly: false };
  };


  if (!userLocations || userLocations.length === 0) {
    return (
      <Layout>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Contact admin to assign your location before tracking work
          </AlertDescription>
        </Alert>
      </Layout>
    );
  }

  if (loadingLocations) {
    return (
      <Layout>
        <div className="space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4 pb-24">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">Log Work</h1>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center justify-between gap-2 p-3 bg-card border rounded-lg">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevDay}
            disabled={!canGoPrev}
            className="h-12 w-12 shrink-0"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          
          <div className="flex-1 text-center">
            <div className="flex items-center justify-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-base">
                {format(selectedDate, 'EEE, MMM d, yyyy')}
              </span>
            </div>
            {isNotToday && (
              <Button
                variant="link"
                size="sm"
                onClick={handleGoToToday}
                className="text-primary p-0 h-auto mt-1"
              >
                Go to Today
              </Button>
            )}
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextDay}
            disabled={!canGoNext}
            className="h-12 w-12 shrink-0"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>

        {/* Past Date Warning Banner */}
        {isNotToday && (
          <div className="sticky top-0 z-50 animate-pulse">
            <div className="bg-amber-500 text-white px-4 py-3 rounded-lg shadow-lg">
              <div className="flex items-center justify-center gap-2">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span className="font-bold text-center">
                  LOGGING FOR {format(selectedDate, 'MMMM d, yyyy').toUpperCase()}
                </span>
              </div>
              <p className="text-center text-sm mt-1 text-amber-100">
                Entries will be recorded for this past date
              </p>
            </div>
          </div>
        )}

        <CutoffBanner />

        {/* Location selector (only if multiple) */}
        {locations.length > 1 && (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Location:</span>
            <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Vehicles / Equipment Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Vehicles / Equipment
            </CardTitle>
            {pendingEntries.size === 0 && (
              <p className="text-sm text-muted-foreground">
                Tap vehicles to select them, then submit all at once
              </p>
            )}
          </CardHeader>
          <CardContent>
            {selectedLocationId && (
              <WorkItemGrid
                locationId={selectedLocationId}
                selectedIds={selectedWorkItemIds}
                completedIds={completedWorkItemIds}
                onToggle={handleWorkItemToggle}
              />
            )}
          </CardContent>
        </Card>

        {/* Selection Summary */}
        {pendingEntries.size > 0 && (
          <Card className="border-green-500/50 bg-green-500/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center">
                    <span className="font-bold text-green-600 dark:text-green-400">
                      {pendingEntries.size}
                    </span>
                  </div>
                  <span className="text-sm font-medium">
                    {pendingEntries.size === 1 ? 'vehicle' : 'vehicles'} selected
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearSelections}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Hourly Services Section */}
        {loadingHourly ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20" />
            </CardContent>
          </Card>
        ) : hourlyConfigs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Hourly Services
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {hourlyConfigs.map((config) => (
                  <div
                    key={config.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{config.work_type.name}</span>
                      {config.rate && (
                        <Badge variant="secondary">${config.rate.toFixed(2)}/hr</Badge>
                      )}
                    </div>
                    <Button size="sm" onClick={() => handleHourlySelect(config)}>
                      Log Hours
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Entries Section */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Entries (Last 7 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingLogs ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : recentLogs.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No entries in the last 7 days
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Item / Service</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentLogs.map((log) => {
                    const info = getLogDisplayInfo(log);
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">
                          {format(parseLocalDate(log.work_date), 'MMM d')}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{info.label}</span>
                            {info.typeName && (
                              <Badge variant="outline" className="text-xs">
                                {info.typeName}
                              </Badge>
                            )}
                            {info.isHourly && (
                              <Badge variant="secondary" className="text-xs">
                                Hourly
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {info.isHourly ? `${log.quantity}h` : log.quantity}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sticky Submit Button */}
      {pendingEntries.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t shadow-lg z-40">
          <Button
            onClick={handleBatchSubmit}
            disabled={isSubmitting}
            className={cn(
              "w-full h-16 text-lg font-bold",
              "bg-green-600 hover:bg-green-700 text-white"
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-5 w-5 mr-2" />
                SUBMIT {pendingEntries.size} {pendingEntries.size === 1 ? 'ENTRY' : 'ENTRIES'}
              </>
            )}
          </Button>
          <p className="text-center text-sm text-muted-foreground mt-2">
            For {format(selectedDate, 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
      )}

      {/* Log Work Modal (for hourly) */}
      <LogWorkModal
        open={isLogModalOpen}
        onOpenChange={setIsLogModalOpen}
        workItem={undefined}
        rateConfig={selectedRateConfig || undefined}
        onSuccess={handleLogSuccess}
      />

    </Layout>
  );
}
