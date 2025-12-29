import { useState, useEffect, useCallback } from 'react';
import { format, subDays } from 'date-fns';
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
import { AlertCircle, Clock, Truck, Trash2, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
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
  
  // Modal state
  const [selectedWorkItem, setSelectedWorkItem] = useState<WorkItemWithDetails | null>(null);
  const [selectedRateConfig, setSelectedRateConfig] = useState<RateConfigWithDetails | null>(null);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  
  // Delete confirmation
  const [deleteLogId, setDeleteLogId] = useState<string | null>(null);

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

  const handleWorkItemSelect = (workItem: WorkItemWithDetails) => {
    setSelectedWorkItem(workItem);
    setSelectedRateConfig(null);
    setIsLogModalOpen(true);
  };

  const handleHourlySelect = (config: RateConfigWithDetails) => {
    setSelectedRateConfig(config);
    setSelectedWorkItem(null);
    setIsLogModalOpen(true);
  };

  const handleLogSuccess = () => {
    fetchRecentLogs();
  };

  const handleDeleteLog = async () => {
    if (!deleteLogId) return;
    
    try {
      const { error } = await supabase
        .from('work_logs')
        .delete()
        .eq('id', deleteLogId);

      if (error) throw error;
      
      toast.success('Entry deleted');
      fetchRecentLogs();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete entry');
    } finally {
      setDeleteLogId(null);
    }
  };

  const getLogDisplayInfo = (log: WorkLogWithDetails) => {
    if (log.work_item_id && log.work_item) {
      // Per-unit work - get info through work_item.rate_config
      return {
        label: log.work_item.identifier,
        typeName: log.work_item.rate_config?.work_type?.name || 'Unknown',
        isHourly: false,
      };
    } else if (log.rate_config_id && log.direct_rate_config) {
      // Hourly work - get info directly from rate_config
      return {
        label: log.direct_rate_config.work_type?.name || 'Unknown',
        typeName: null,
        isHourly: true,
      };
    }
    return { label: 'Unknown', typeName: null, isHourly: false };
  };

  const canDeleteLog = (log: WorkLogWithDetails) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return log.work_date === today;
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold">Log Work</h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            <span>{format(new Date(), 'EEEE, MMMM d, yyyy')}</span>
          </div>
        </div>

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
          </CardHeader>
          <CardContent>
            {selectedLocationId && (
              <WorkItemGrid
                locationId={selectedLocationId}
                onSelect={handleWorkItemSelect}
              />
            )}
          </CardContent>
        </Card>

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
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-10"></TableHead>
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
                          <div className="flex items-center gap-2">
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
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">
                          {log.notes || '-'}
                        </TableCell>
                        <TableCell>
                          {canDeleteLog(log) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteLogId(log.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
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

      {/* Log Work Modal */}
      <LogWorkModal
        open={isLogModalOpen}
        onOpenChange={setIsLogModalOpen}
        workItem={selectedWorkItem || undefined}
        rateConfig={selectedRateConfig || undefined}
        onSuccess={handleLogSuccess}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteLogId} onOpenChange={() => setDeleteLogId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this work entry? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteLog} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
