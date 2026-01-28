import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { format, subDays, addDays, isToday, isFuture, startOfDay, startOfWeek, parseISO, differenceInDays } from 'date-fns';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { CutoffBanner } from '@/components/CutoffBanner';
import { WorkItemGrid, WorkItemWithDetails } from '@/components/WorkItemGrid';
import { LogWorkModal, RateConfigWithDetails } from '@/components/LogWorkModal';
import { GuidedDemo } from '@/components/GuidedDemo';
import { AddVehicleModal } from '@/components/AddVehicleModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle, Clock, Truck, ChevronLeft, ChevronRight, CalendarDays, Send, X, Loader2, MessageSquare, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
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
  const [workNote, setWorkNote] = useState('');
  const [isSendingNote, setIsSendingNote] = useState(false);
  
  // Completed items (already logged today at this location by anyone)
  const [completedWorkItemIds, setCompletedWorkItemIds] = useState<Set<string>>(new Set());
  
  // Modal state (for hourly)
  const [selectedRateConfig, setSelectedRateConfig] = useState<RateConfigWithDetails | null>(null);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  
  // Add vehicle modal state
  const [addVehicleModalOpen, setAddVehicleModalOpen] = useState(false);
  const [addVehiclePreselectedType, setAddVehiclePreselectedType] = useState<string>('');
  const [vehicleRefreshKey, setVehicleRefreshKey] = useState(0);
  
  // Work type filter for recent entries
  const [filterWorkType, setFilterWorkType] = useState<string>('all');
  
  // Comment modal state
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [recentComments, setRecentComments] = useState<any[]>([]);
  const [commentReplies, setCommentReplies] = useState<Record<string, any[]>>({});
  
  // Submit button visibility tracking for glow effect
  const [isSubmitButtonVisible, setIsSubmitButtonVisible] = useState(false);
  const submitButtonRef = useRef<HTMLDivElement>(null);
  

  // Fetch cutoff date
  useEffect(() => {
    getCurrentCutoff().then(setCutoffDate);
  }, []);

  // Track submit button visibility for glow transition
  useEffect(() => {
    if (!submitButtonRef.current || pendingEntries.size === 0) {
      setIsSubmitButtonVisible(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsSubmitButtonVisible(entry.isIntersecting);
      },
      { 
        threshold: 0.5,
        rootMargin: '0px' 
      }
    );

    observer.observe(submitButtonRef.current);
    return () => observer.disconnect();
  }, [pendingEntries.size]);

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

  // Fetch recent work logs for the selected location (all employees)
  const fetchRecentLogs = useCallback(async () => {
    if (!selectedLocationId) return;
    
    setLoadingLogs(true);
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    
    // First get work_item_ids at this location
    const { data: workItemData } = await supabase
      .from('work_items')
      .select('id, rate_config:rate_configs!inner(location_id)')
      .eq('rate_config.location_id', selectedLocationId);
    
    const workItemIds = workItemData?.map(wi => wi.id) || [];
    
    // Also get rate_config_ids at this location for hourly services
    const { data: rateConfigData } = await supabase
      .from('rate_configs')
      .select('id')
      .eq('location_id', selectedLocationId);
    
    const rateConfigIds = rateConfigData?.map(rc => rc.id) || [];
    
    // Fetch logs for work items OR direct rate configs at this location
    let query = supabase
      .from('work_logs')
      .select(`
        id, work_date, quantity, notes, created_at, work_item_id, rate_config_id, employee_id,
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
      .gte('work_date', weekStart)
      .order('work_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50);
    
    // Build OR filter for work_item_id or rate_config_id
    const orConditions: string[] = [];
    if (workItemIds.length > 0) {
      orConditions.push(`work_item_id.in.(${workItemIds.join(',')})`);
    }
    if (rateConfigIds.length > 0) {
      orConditions.push(`rate_config_id.in.(${rateConfigIds.join(',')})`);
    }
    
    if (orConditions.length === 0) {
      setRecentLogs([]);
      setLoadingLogs(false);
      return;
    }
    
    const { data, error } = await query.or(orConditions.join(','));

    if (!error && data) {
      setRecentLogs(data as unknown as WorkLogWithDetails[]);
    }
    setLoadingLogs(false);
  }, [selectedLocationId]);

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
      const noteText = workNote.trim() || null;
      const workDateStr = format(selectedDate, 'yyyy-MM-dd');
      
      const entries = Array.from(pendingEntries.values()).map(entry => ({
        work_item_id: entry.workItemId,
        rate_config_id: null,
        employee_id: user.id,
        work_date: workDateStr,
        quantity: entry.quantity,
        notes: noteText,
      }));
      
      const { data: insertedLogs, error } = await supabase
        .from('work_logs')
        .insert(entries)
        .select('id');
      
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
      
      // If there was a note, also create employee_comments entry for finance visibility
      if (noteText && insertedLogs && insertedLogs.length > 0) {
        const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
        await supabase.from('employee_comments').insert({
          employee_id: user.id,
          location_id: selectedLocationId || null,
          comment_text: noteText,
          week_start_date: weekStart,
          work_submission_date: workDateStr,
          work_log_ids: insertedLogs.map(l => l.id),
        });
      }
      
      const noteMsg = noteText ? ' with note' : '';
      toast.success(`Submitted ${pendingEntries.size} ${pendingEntries.size === 1 ? 'entry' : 'entries'}${noteMsg}`);
      setPendingEntries(new Map());
      setWorkNote('');
      fetchRecentLogs();
      fetchCompletedItems();
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit entries');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Send standalone note without work items
  const handleSendStandaloneNote = async () => {
    if (!user || !workNote.trim()) return;
    
    setIsSendingNote(true);
    try {
      const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      await supabase.from('employee_comments').insert({
        employee_id: user.id,
        location_id: selectedLocationId || null,
        comment_text: workNote.trim(),
        week_start_date: weekStart,
      });
      
      toast.success('Message sent to finance');
      setWorkNote('');
    } catch (error: any) {
      toast.error('Failed to send message');
    } finally {
      setIsSendingNote(false);
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
        workItemId: log.work_item_id,
      };
    } else if (log.rate_config_id && log.direct_rate_config) {
      return {
        label: log.direct_rate_config.work_type?.name || 'Unknown',
        typeName: null,
        isHourly: true,
        workItemId: null,
      };
    }
    return { label: 'Unknown', typeName: null, isHourly: false, workItemId: null };
  };

  // Compute weekly statistics for the summary card
  const weeklyStats = useMemo(() => {
    const perUnitLogs = recentLogs.filter(log => log.work_item_id !== null);
    const myLogs = perUnitLogs.filter(log => (log as any).employee_id === user?.id);
    
    // Group by work type
    const byType: Record<string, number> = {};
    perUnitLogs.forEach(log => {
      const typeName = log.work_item?.rate_config?.work_type?.name || 'Unknown';
      byType[typeName] = (byType[typeName] || 0) + 1;
    });
    
    return {
      total: perUnitLogs.length,
      myTotal: myLogs.length,
      byType
    };
  }, [recentLogs, user?.id]);

  // Compute back-to-back day flags for work items
  const backToBackFlags = useMemo(() => {
    const flags = new Set<string>(); // Set of work_log IDs that are back-to-back
    
    // Only check logs with work_item_id (per-unit items, not hourly)
    const perUnitLogs = recentLogs.filter(log => log.work_item_id);
    
    // Group by work_item_id
    const logsByWorkItem: Record<string, WorkLogWithDetails[]> = {};
    perUnitLogs.forEach(log => {
      const key = log.work_item_id!;
      if (!logsByWorkItem[key]) logsByWorkItem[key] = [];
      logsByWorkItem[key].push(log);
    });
    
    // For each work item, check for consecutive days
    Object.values(logsByWorkItem).forEach(logs => {
      if (logs.length < 2) return;
      
      // Sort by date
      const sorted = [...logs].sort((a, b) => 
        parseLocalDate(a.work_date).getTime() - parseLocalDate(b.work_date).getTime()
      );
      
      for (let i = 1; i < sorted.length; i++) {
        const prevDate = parseLocalDate(sorted[i - 1].work_date);
        const currDate = parseLocalDate(sorted[i].work_date);
        const diff = differenceInDays(currDate, prevDate);
        
        if (diff === 1) {
          // Mark both as flagged
          flags.add(sorted[i - 1].id);
          flags.add(sorted[i].id);
        }
      }
    });
    
    return flags;
  }, [recentLogs]);

  // Get unique work types from logs for filtering
  const uniqueWorkTypes = useMemo(() => {
    const types = new Set<string>();
    recentLogs.forEach(log => {
      const typeName = log.work_item?.rate_config?.work_type?.name 
                    || log.direct_rate_config?.work_type?.name;
      if (typeName) types.add(typeName);
    });
    return Array.from(types).sort();
  }, [recentLogs]);

  // Filter recent logs by work type
  const filteredLogs = useMemo(() => {
    if (filterWorkType === 'all') return recentLogs;
    return recentLogs.filter(log => {
      const typeName = log.work_item?.rate_config?.work_type?.name 
                    || log.direct_rate_config?.work_type?.name;
      return typeName === filterWorkType;
    });
  }, [recentLogs, filterWorkType]);

  // Add vehicle handler
  const handleAddVehicle = (typeName: string) => {
    setAddVehiclePreselectedType(typeName);
    setAddVehicleModalOpen(true);
  };

  const handleVehicleAdded = () => {
    setVehicleRefreshKey(prev => prev + 1);
    fetchCompletedItems();
  };

  // Fetch recent comments and replies for this week
  const fetchRecentComments = useCallback(async () => {
    if (!user?.id) return;
    
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    
    const { data } = await supabase
      .from('employee_comments')
      .select('*')
      .eq('employee_id', user.id)
      .eq('week_start_date', weekStart)
      .order('created_at', { ascending: false });
    
    setRecentComments(data || []);
    
    // Fetch replies for these comments
    if (data && data.length > 0) {
      const commentIds = data.map(c => c.id);
      const { data: repliesData } = await supabase
        .from('message_replies')
        .select('*, users!message_replies_user_id_fkey(id, name)')
        .in('comment_id', commentIds)
        .order('created_at', { ascending: true });
      
      // Group replies by comment_id
      const grouped: Record<string, any[]> = {};
      (repliesData || []).forEach(r => {
        if (!grouped[r.comment_id]) grouped[r.comment_id] = [];
        grouped[r.comment_id].push(r);
      });
      setCommentReplies(grouped);
    } else {
      setCommentReplies({});
    }
  }, [user?.id]);

  useEffect(() => {
    if (commentModalOpen) {
      fetchRecentComments();
    }
  }, [commentModalOpen, fetchRecentComments]);

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !user?.id) return;
    
    setSubmittingComment(true);
    try {
      const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      
      const { error } = await supabase
        .from('employee_comments')
        .insert({
          employee_id: user.id,
          location_id: selectedLocationId || null,
          comment_text: commentText.trim(),
          week_start_date: weekStart,
        });

      if (error) throw error;

      toast.success('Message sent to finance');
      setCommentText('');
      fetchRecentComments();
    } catch (error: any) {
      console.error('Error submitting comment:', error);
      toast.error('Failed to send message');
    } finally {
      setSubmittingComment(false);
    }
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
      <div className="space-y-4 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">Log Work</h1>
          <GuidedDemo />
        </div>

        {/* Date Navigation */}
        <div data-demo="date-nav" className="flex items-center justify-between gap-2 p-3 bg-card border rounded-lg">
          <Button
            data-demo="prev-day"
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
            data-demo="next-day"
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
          <div data-demo="location-select" className="flex items-center gap-3">
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

        {/* Weekly Stats Summary Card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            {loadingLogs ? (
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                      <Truck className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold">{weeklyStats.total}</span>
                        <span className="text-lg text-muted-foreground">
                          {weeklyStats.total === 1 ? 'Wash' : 'Washes'}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        This week at {locations.find(l => l.id === selectedLocationId)?.name || 'this location'}
                      </p>
                    </div>
                  </div>
                  {weeklyStats.myTotal > 0 && (
                    <Badge variant="secondary" className="text-sm">
                      {weeklyStats.myTotal} by you
                    </Badge>
                  )}
                </div>
                {Object.keys(weeklyStats.byType).length > 1 && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
                    {Object.entries(weeklyStats.byType)
                      .sort(([a], [b]) => {
                        if (a === 'PUD') return -1;
                        if (b === 'PUD') return 1;
                        return a.localeCompare(b);
                      })
                      .map(([typeName, count]) => (
                        <Badge key={typeName} variant="outline" className="text-xs">
                          {typeName}: {count}
                        </Badge>
                      ))}
                  </div>
                )}
                {weeklyStats.total === 0 && (
                  <p className="text-sm text-muted-foreground italic">
                    No washes logged this week yet. Tap vehicles below to get started!
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vehicles / Equipment Section */}
        <Card data-demo="vehicles-grid">
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
                onAddVehicle={handleAddVehicle}
                refreshKey={vehicleRefreshKey}
              />
            )}
          </CardContent>
        </Card>

        {/* Selection Summary & Submit Button */}
        {pendingEntries.size > 0 && (
          <div className="space-y-3">
            <Card data-demo="selection-summary" className="border-green-500/50 bg-green-500/5">
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

            {/* Submit Button with underglow effect */}
            <div data-demo="submit-button" ref={submitButtonRef}>
              {/* Container for positioning */}
              <div className="relative">
                {/* Glow layer - sits behind button, only this animates */}
                {isSubmitButtonVisible && !isSubmitting && (
                  <div 
                    className="pending-glow-layer absolute inset-[-4px] rounded-lg pointer-events-none"
                    aria-hidden="true"
                  />
                )}
                {/* Button - static, sits above glow */}
                <Button
                  onClick={handleBatchSubmit}
                  disabled={isSubmitting}
                  className={cn(
                    "submit-button-clean",
                    "relative z-10 w-full h-14 text-lg font-bold",
                    "bg-green-700 hover:bg-green-800 text-white",
                    "transition-all duration-500"
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
              </div>
              <p className="text-center text-sm text-muted-foreground mt-2">
                For {format(selectedDate, 'EEEE, MMMM d, yyyy')}
              </p>
            </div>
          </div>
        )}

        {/* Bottom Edge Glow - shows when items selected but Submit button not visible */}
        {pendingEntries.size > 0 && !isSubmitButtonVisible && (
          <div 
            className={cn(
              "fixed bottom-0 left-0 right-0 h-2",
              "pending-glow-edge",
              "z-40 pointer-events-none"
            )}
          />
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
          <Card data-demo="hourly-services">
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

        {/* Message/Note Field - Always visible */}
        <Card className="border-muted">
          <CardContent className="p-4 space-y-3">
            <label htmlFor="work-note" className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Message for Office (optional)
            </label>
            <Textarea
              id="work-note"
              placeholder="e.g., 'Truck had damage', 'Worked extra due to weather'"
              rows={3}
              value={workNote}
              onChange={(e) => setWorkNote(e.target.value)}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {pendingEntries.size > 0 && workNote.trim()
                ? `✓ Will be attached to your ${pendingEntries.size} selected item(s) when submitted`
                : 'Leave blank if no message needed'}
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={!workNote.trim() || isSendingNote}
              onClick={handleSendStandaloneNote}
              className="w-full"
            >
              {isSendingNote ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Message Now
            </Button>
          </CardContent>
        </Card>

        {/* Recent Entries Section */}
        <Card data-demo="recent-entries">
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle>Recent Entries (Current Week)</CardTitle>
              {uniqueWorkTypes.length > 1 && (
                <Select value={filterWorkType} onValueChange={setFilterWorkType}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {uniqueWorkTypes.map(wt => (
                      <SelectItem key={wt} value={wt}>{wt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loadingLogs ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : filteredLogs.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {recentLogs.length === 0 ? 'No entries this week' : 'No entries match the selected filter'}
              </p>
            ) : (
              <TooltipProvider>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Item / Service</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => {
                      const info = getLogDisplayInfo(log);
                      const isFlagged = backToBackFlags.has(log.id);
                      
                      return (
                        <TableRow key={log.id} className={cn(isFlagged && "bg-amber-500/5")}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-1.5">
                              {format(parseLocalDate(log.work_date), 'MMM d')}
                              {isFlagged && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Back-to-back: This vehicle was also logged on consecutive day(s)</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
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
              </TooltipProvider>
            )}
          </CardContent>
        </Card>
      </div>


      {/* Log Work Modal (for hourly) */}
      <LogWorkModal
        open={isLogModalOpen}
        onOpenChange={setIsLogModalOpen}
        workItem={undefined}
        rateConfig={selectedRateConfig || undefined}
        onSuccess={handleLogSuccess}
      />

      {/* Floating Message Button */}
      <button
        data-demo="comment-button"
        onClick={() => navigate('/messages')}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-green-600 text-white shadow-lg hover:bg-green-700 transition-all hover:scale-105 flex items-center justify-center"
        aria-label="View my messages"
      >
        <MessageSquare className="h-6 w-6" />
      </button>

      {/* Comment Modal */}
      <Dialog open={commentModalOpen} onOpenChange={setCommentModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Message to Finance
            </DialogTitle>
            <DialogDescription>
              Send a message to the finance team. They will see your name, location, and submission date.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Comment Input */}
            <Textarea
              placeholder="Type your message here... (e.g., equipment issues, schedule changes, questions)"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="min-h-[100px] resize-none"
            />
            
            {/* Previous Comments This Week */}
            {recentComments.length > 0 && (
              <div className="border-t pt-4 space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Your messages this week:</p>
                <div className="max-h-[200px] overflow-y-auto space-y-3">
                  {recentComments.map((c) => (
                    <div key={c.id} className="space-y-2">
                      <div className="bg-accent/30 rounded-lg p-3">
                        <p className="text-sm">{c.comment_text}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(c.created_at), 'MMM d, h:mm a')}
                        </p>
                      </div>
                      {/* Show replies */}
                      {commentReplies[c.id]?.map((reply) => (
                        <div key={reply.id} className="ml-4 bg-primary/10 border-l-2 border-primary rounded-lg p-3">
                          <p className="text-xs text-primary font-medium">
                            {reply.users?.name || 'Finance Team'}
                          </p>
                          <p className="text-sm">{reply.reply_text}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(reply.created_at), 'MMM d, h:mm a')}
                          </p>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommentModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitComment} 
              disabled={submittingComment || !commentText.trim()}
            >
              {submittingComment ? 'Sending...' : 'Send Message'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Vehicle Modal */}
      {selectedLocationId && (
        <AddVehicleModal
          open={addVehicleModalOpen}
          onOpenChange={setAddVehicleModalOpen}
          locationId={selectedLocationId}
          preselectedTypeName={addVehiclePreselectedType}
          onSuccess={handleVehicleAdded}
        />
      )}

    </Layout>
  );
}
