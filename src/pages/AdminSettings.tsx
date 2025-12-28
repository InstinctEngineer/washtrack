import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronRight, Filter, X, Download, ArrowRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';
import { getCurrentCutoff, getLastSunday, getDaysUntilNextCutoff, getCutoffStatusColor, extendCutoffByDays, updateCutoffDate } from '@/lib/cutoff';
import { SystemSettingsAudit } from '@/types/database';
import { exportToExcel } from '@/lib/excelExporter';

type AuditTrailItem = SystemSettingsAudit & { 
  user?: { 
    id: string; 
    name: string; 
  } 
};

type HistoryColumnKey = 'changedBy' | 'oldValue' | 'newValue' | 'reason' | 'changedAt';

const HISTORY_COLUMN_CONFIG: { key: HistoryColumnKey; label: string; filterable: boolean }[] = [
  { key: 'changedBy', label: 'Changed By', filterable: true },
  { key: 'oldValue', label: 'Old Value', filterable: false },
  { key: 'newValue', label: 'New Value', filterable: false },
  { key: 'reason', label: 'Reason', filterable: true },
  { key: 'changedAt', label: 'Changed At', filterable: false },
];

// Column filter dropdown component
function ColumnFilterDropdown({ 
  columnKey, 
  label, 
  uniqueValues, 
  selectedValues, 
  onSelectionChange 
}: { 
  columnKey: string;
  label: string;
  uniqueValues: string[];
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
}) {
  const hasFilters = selectedValues.length > 0;
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={cn("h-6 px-1", hasFilters && "text-primary")}>
          <Filter className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <ScrollArea className="h-64">
          <div className="p-2">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-medium">{label}</span>
              {hasFilters && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-5 px-1 text-xs"
                  onClick={() => onSelectionChange([])}
                >
                  Clear
                </Button>
              )}
            </div>
            {uniqueValues.map((value) => (
              <DropdownMenuCheckboxItem
                key={value}
                checked={selectedValues.includes(value)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onSelectionChange([...selectedValues, value]);
                  } else {
                    onSelectionChange(selectedValues.filter(v => v !== value));
                  }
                }}
              >
                {value || '(empty)'}
              </DropdownMenuCheckboxItem>
            ))}
          </div>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function AdminSettings() {
  const { user } = useAuth();
  const [cutoffDate, setCutoffDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [auditTrail, setAuditTrail] = useState<AuditTrailItem[]>([]);
  const [showExtendDialog, setShowExtendDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [manualDate, setManualDate] = useState<Date | undefined>(undefined);
  const [activeUsers, setActiveUsers] = useState(0);

  // History section state
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [historyDateMode, setHistoryDateMode] = useState<'recent' | 'month' | 'custom'>('recent');
  const [historySelectedMonth, setHistorySelectedMonth] = useState(new Date());
  const [historyCustomStartDate, setHistoryCustomStartDate] = useState<Date | undefined>();
  const [historyCustomEndDate, setHistoryCustomEndDate] = useState<Date | undefined>();
  const [historyColumnFilters, setHistoryColumnFilters] = useState<Record<HistoryColumnKey, string[]>>({
    changedBy: [],
    oldValue: [],
    newValue: [],
    reason: [],
    changedAt: [],
  });
  const [historyColumnSearches, setHistoryColumnSearches] = useState<Record<HistoryColumnKey, string>>({
    changedBy: '',
    oldValue: '',
    newValue: '',
    reason: '',
    changedAt: '',
  });
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());
  const [historySortColumn, setHistorySortColumn] = useState<HistoryColumnKey>('changedAt');
  const [historySortDirection, setHistorySortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchData();
  }, []);

  // Refetch history when date mode changes (when expanded)
  useEffect(() => {
    if (isHistoryExpanded) {
      fetchHistoryData();
    }
  }, [isHistoryExpanded, historyDateMode, historySelectedMonth, historyCustomStartDate, historyCustomEndDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch cutoff date
      const cutoff = await getCurrentCutoff();
      setCutoffDate(cutoff);

      // Fetch initial audit trail (20 most recent)
      await fetchHistoryData();

      // Fetch system stats
      const { count: usersCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      setActiveUsers(usersCount || 0);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchHistoryData = async () => {
    try {
      let query = supabase
        .from('system_settings_audit')
        .select('*')
        .eq('setting_key', 'entry_cutoff_date')
        .order('changed_at', { ascending: false });

      if (historyDateMode === 'recent') {
        query = query.limit(20);
      } else if (historyDateMode === 'month') {
        const monthStart = startOfMonth(historySelectedMonth);
        const monthEnd = endOfMonth(historySelectedMonth);
        query = query
          .gte('changed_at', monthStart.toISOString())
          .lte('changed_at', monthEnd.toISOString());
      } else if (historyDateMode === 'custom' && historyCustomStartDate && historyCustomEndDate) {
        const startDate = new Date(historyCustomStartDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(historyCustomEndDate);
        endDate.setHours(23, 59, 59, 999);
        query = query
          .gte('changed_at', startDate.toISOString())
          .lte('changed_at', endDate.toISOString());
      }

      const { data: auditData, error: auditError } = await query;

      if (auditError) throw auditError;

      // Fetch user names for audit trail
      if (auditData && auditData.length > 0) {
        const userIds = auditData.map(a => a.changed_by).filter(Boolean);
        const { data: usersData } = await supabase
          .from('users')
          .select('id, name')
          .in('id', userIds);

        const usersMap = new Map(usersData?.map(u => [u.id, u]) || []);
        const enrichedAudit = auditData.map(audit => ({
          ...audit,
          user: audit.changed_by ? usersMap.get(audit.changed_by) : undefined,
        }));
        setAuditTrail(enrichedAudit);
      } else {
        setAuditTrail([]);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  // Get unique values for filter dropdowns
  const uniqueFilterValues = useMemo(() => {
    const values: Record<HistoryColumnKey, string[]> = {
      changedBy: [],
      oldValue: [],
      newValue: [],
      reason: [],
      changedAt: [],
    };

    auditTrail.forEach(audit => {
      const changedBy = audit.user?.name || 'System';
      const reason = audit.change_reason || '';
      
      if (!values.changedBy.includes(changedBy)) values.changedBy.push(changedBy);
      if (reason && !values.reason.includes(reason)) values.reason.push(reason);
    });

    values.changedBy.sort();
    values.reason.sort();

    return values;
  }, [auditTrail]);

  // Filter audit trail
  const filteredAuditTrail = useMemo(() => {
    return auditTrail.filter(audit => {
      const changedBy = audit.user?.name || 'System';
      const oldValue = audit.old_value ? format(new Date(audit.old_value), 'PPP p') : 'N/A';
      const newValue = format(new Date(audit.new_value), 'PPP p');
      const reason = audit.change_reason || '';
      const changedAt = format(new Date(audit.changed_at), 'PPP p');

      // Check dropdown filters
      if (historyColumnFilters.changedBy.length > 0 && !historyColumnFilters.changedBy.includes(changedBy)) return false;
      if (historyColumnFilters.reason.length > 0 && !historyColumnFilters.reason.includes(reason)) return false;

      // Check text searches
      if (historyColumnSearches.changedBy && !changedBy.toLowerCase().includes(historyColumnSearches.changedBy.toLowerCase())) return false;
      if (historyColumnSearches.oldValue && !oldValue.toLowerCase().includes(historyColumnSearches.oldValue.toLowerCase())) return false;
      if (historyColumnSearches.newValue && !newValue.toLowerCase().includes(historyColumnSearches.newValue.toLowerCase())) return false;
      if (historyColumnSearches.reason && !reason.toLowerCase().includes(historyColumnSearches.reason.toLowerCase())) return false;
      if (historyColumnSearches.changedAt && !changedAt.toLowerCase().includes(historyColumnSearches.changedAt.toLowerCase())) return false;

      return true;
    });
  }, [auditTrail, historyColumnFilters, historyColumnSearches]);

  // Sorting handlers
  const handleHistorySort = (column: HistoryColumnKey) => {
    if (historySortColumn === column) {
      setHistorySortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setHistorySortColumn(column);
      setHistorySortDirection('asc');
    }
  };

  // Sort entries
  const sortedAuditTrail = useMemo(() => {
    return [...filteredAuditTrail].sort((a, b) => {
      const getValue = (audit: AuditTrailItem, key: HistoryColumnKey): string => {
        switch (key) {
          case 'changedBy': return audit.user?.name || 'System';
          case 'oldValue': return audit.old_value || '';
          case 'newValue': return audit.new_value;
          case 'reason': return audit.change_reason || '';
          case 'changedAt': return audit.changed_at;
          default: return '';
        }
      };

      const aValue = getValue(a, historySortColumn);
      const bValue = getValue(b, historySortColumn);

      // Handle date column
      if (historySortColumn === 'changedAt' || historySortColumn === 'oldValue' || historySortColumn === 'newValue') {
        const aDate = aValue ? new Date(aValue).getTime() : 0;
        const bDate = bValue ? new Date(bValue).getTime() : 0;
        return historySortDirection === 'asc' ? aDate - bDate : bDate - aDate;
      }

      // String comparison for other columns
      if (historySortDirection === 'asc') {
        return aValue.localeCompare(bValue);
      } else {
        return bValue.localeCompare(aValue);
      }
    });
  }, [filteredAuditTrail, historySortColumn, historySortDirection]);

  const getHistorySortIcon = (column: HistoryColumnKey) => {
    if (historySortColumn !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return historySortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    Object.values(historyColumnFilters).forEach(arr => { if (arr.length > 0) count++; });
    Object.values(historyColumnSearches).forEach(str => { if (str) count++; });
    return count;
  }, [historyColumnFilters, historyColumnSearches]);

  const clearAllFilters = () => {
    setHistoryColumnFilters({
      changedBy: [],
      oldValue: [],
      newValue: [],
      reason: [],
      changedAt: [],
    });
    setHistoryColumnSearches({
      changedBy: '',
      oldValue: '',
      newValue: '',
      reason: '',
      changedAt: '',
    });
  };

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedHistoryIds.size === filteredAuditTrail.length) {
      setSelectedHistoryIds(new Set());
    } else {
      setSelectedHistoryIds(new Set(filteredAuditTrail.map(a => a.id)));
    }
  };

  const toggleSelectRow = (id: string) => {
    const newSelected = new Set(selectedHistoryIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedHistoryIds(newSelected);
  };

  // Export handlers
  const handleExport = (exportAll: boolean) => {
    const dataToExport = exportAll 
      ? filteredAuditTrail 
      : filteredAuditTrail.filter(a => selectedHistoryIds.has(a.id));

    const exportData = dataToExport.map(audit => ({
      'Changed By': audit.user?.name || 'System',
      'Old Value': audit.old_value ? format(new Date(audit.old_value), 'PPP p') : 'N/A',
      'New Value': format(new Date(audit.new_value), 'PPP p'),
      'Reason': audit.change_reason || '-',
      'Changed At': format(new Date(audit.changed_at), 'PPP p'),
    }));

    exportToExcel(exportData, `cutoff-change-history-${format(new Date(), 'yyyy-MM-dd')}`, 'Change History');
    toast({
      title: 'Export Complete',
      description: `Exported ${dataToExport.length} records`,
    });
  };

  // Custom range validation
  const isCustomRangeValid = historyCustomStartDate && historyCustomEndDate && 
    differenceInDays(historyCustomEndDate, historyCustomStartDate) <= 365;

  const handleExtendCutoff = async () => {
    if (!user || !cutoffDate) return;

    try {
      const result = await extendCutoffByDays(7, user.id, 'Extended by 1 week');
      
      if (result.success && result.newDate) {
        toast({
          title: 'Success',
          description: `Cutoff date extended to ${format(result.newDate, 'PPP p')}`,
        });
        await fetchData();
      } else {
        throw new Error(result.error || 'Failed to extend cutoff');
      }
    } catch (error) {
      console.error('Error extending cutoff:', error);
      toast({
        title: 'Error',
        description: 'Failed to extend cutoff date',
        variant: 'destructive',
      });
    }
    setShowExtendDialog(false);
  };

  const handleResetToLastSunday = async () => {
    if (!user) return;

    try {
      const lastSunday = getLastSunday();
      const result = await updateCutoffDate(lastSunday, user.id, 'Reset to last Sunday');
      
      if (result.success) {
        toast({
          title: 'Success',
          description: `Cutoff date reset to ${format(lastSunday, 'PPP p')}`,
        });
        await fetchData();
      } else {
        throw new Error(result.error || 'Failed to reset cutoff');
      }
    } catch (error) {
      console.error('Error resetting cutoff:', error);
      toast({
        title: 'Error',
        description: 'Failed to reset cutoff date',
        variant: 'destructive',
      });
    }
    setShowResetDialog(false);
  };

  const handleManualDateSet = async () => {
    if (!user || !manualDate) return;

    try {
      // Set time to 23:59:59
      const dateWithTime = new Date(manualDate);
      dateWithTime.setHours(23, 59, 59, 999);

      const result = await updateCutoffDate(dateWithTime, user.id, 'Manual date selection');
      
      if (result.success) {
        toast({
          title: 'Success',
          description: `Cutoff date set to ${format(dateWithTime, 'PPP p')}`,
        });
        await fetchData();
      } else {
        throw new Error(result.error || 'Failed to set cutoff');
      }
    } catch (error) {
      console.error('Error setting cutoff:', error);
      toast({
        title: 'Error',
        description: 'Failed to set cutoff date',
        variant: 'destructive',
      });
    }
    setShowManualDialog(false);
    setManualDate(undefined);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading settings...</div>
        </div>
      </Layout>
    );
  }

  const statusColor = cutoffDate ? getCutoffStatusColor(cutoffDate) : 'red';
  const daysUntilNextCutoff = getDaysUntilNextCutoff();

  const StatusIcon = statusColor === 'green' ? CheckCircle : statusColor === 'yellow' ? AlertTriangle : XCircle;
  const statusColorClass = statusColor === 'green' ? 'text-green-600' : statusColor === 'yellow' ? 'text-yellow-600' : 'text-red-600';
  const statusBgClass = statusColor === 'green' ? 'bg-green-50' : statusColor === 'yellow' ? 'bg-yellow-50' : 'bg-red-50';

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">System Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage entry cutoff dates and system configuration
          </p>
        </div>

        {/* System Status Card */}
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>Current system statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Active Employees</div>
                <div className="text-2xl font-bold mt-1">{activeUsers}</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Active Locations</div>
                <div className="text-2xl font-bold mt-1">-</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Days Until Next Cutoff</div>
                <div className="text-2xl font-bold mt-1">{daysUntilNextCutoff}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cutoff Date Section */}
        <Card className={statusBgClass}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Entry Cutoff Date
                </CardTitle>
                <CardDescription className="mt-2">
                  Employees cannot enter washes before this date
                </CardDescription>
              </div>
              <StatusIcon className={`h-8 w-8 ${statusColorClass}`} />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {cutoffDate && (
              <div className="space-y-4">
                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-semibold text-lg">
                      {format(cutoffDate, 'EEEE, MMMM d, yyyy')} at {format(cutoffDate, 'h:mm a')}
                    </div>
                    <div className="text-sm mt-1">
                      {statusColor === 'green' && 'Entry period is open'}
                      {statusColor === 'yellow' && 'Entry deadline approaching'}
                      {statusColor === 'red' && 'Entry period is closed'}
                    </div>
                  </AlertDescription>
                </Alert>

                <div className="flex gap-3 flex-wrap">
                  <Button onClick={() => setShowExtendDialog(true)}>
                    Extend Cutoff by 1 Week
                  </Button>
                  <Button variant="outline" onClick={() => setShowResetDialog(true)}>
                    Reset to Last Sunday
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline">
                        <Calendar className="mr-2 h-4 w-4" />
                        Set Custom Date
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={manualDate}
                        onSelect={(date) => {
                          setManualDate(date);
                          if (date) {
                            setShowManualDialog(true);
                          }
                        }}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Collapsible Change History */}
        <Card>
          <Collapsible open={isHistoryExpanded} onOpenChange={setIsHistoryExpanded}>
            <CardHeader className="pb-3">
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2">
                    {isHistoryExpanded ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <CardTitle>Change History</CardTitle>
                      <CardDescription className="mt-1">
                        {historyDateMode === 'recent' 
                          ? `${auditTrail.length} most recent entries`
                          : historyDateMode === 'month'
                          ? `${format(historySelectedMonth, 'MMMM yyyy')}`
                          : historyCustomStartDate && historyCustomEndDate
                          ? `${format(historyCustomStartDate, 'MMM d')} - ${format(historyCustomEndDate, 'MMM d, yyyy')}`
                          : 'Custom range'
                        }
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary">{auditTrail.length} entries</Badge>
                </div>
              </CollapsibleTrigger>
            </CardHeader>

            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                {/* Controls toolbar */}
                <div className="flex flex-wrap items-center gap-4 pb-2 border-b">
                  {/* Date mode tabs */}
                  <Tabs value={historyDateMode} onValueChange={(v) => setHistoryDateMode(v as any)}>
                    <TabsList>
                      <TabsTrigger value="recent">Recent (20)</TabsTrigger>
                      <TabsTrigger value="month">Month</TabsTrigger>
                      <TabsTrigger value="custom">Custom Range</TabsTrigger>
                    </TabsList>
                  </Tabs>

                  {/* Month picker */}
                  {historyDateMode === 'month' && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Calendar className="mr-2 h-4 w-4" />
                          {format(historySelectedMonth, 'MMMM yyyy')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={historySelectedMonth}
                          onSelect={(date) => date && setHistorySelectedMonth(date)}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  )}

                  {/* Custom range pickers */}
                  {historyDateMode === 'custom' && (
                    <div className="flex items-center gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm">
                            {historyCustomStartDate ? format(historyCustomStartDate, 'MMM d, yyyy') : 'Start date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={historyCustomStartDate}
                            onSelect={setHistoryCustomStartDate}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm">
                            {historyCustomEndDate ? format(historyCustomEndDate, 'MMM d, yyyy') : 'End date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={historyCustomEndDate}
                            onSelect={setHistoryCustomEndDate}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                      {historyCustomStartDate && historyCustomEndDate && !isCustomRangeValid && (
                        <span className="text-sm text-destructive">Max 365 days</span>
                      )}
                    </div>
                  )}

                  <div className="flex-1" />

                  {/* Clear filters */}
                  {activeFilterCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                      <X className="mr-1 h-4 w-4" />
                      Clear Filters
                      <Badge variant="secondary" className="ml-1">{activeFilterCount}</Badge>
                    </Button>
                  )}

                  {/* Export buttons */}
                  {selectedHistoryIds.size > 0 && (
                    <Button variant="outline" size="sm" onClick={() => handleExport(false)}>
                      <Download className="mr-2 h-4 w-4" />
                      Export Selected ({selectedHistoryIds.size})
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => handleExport(true)}>
                    <Download className="mr-2 h-4 w-4" />
                    Export All
                  </Button>
                </div>

                {/* Table */}
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">
                          <Checkbox
                            checked={sortedAuditTrail.length > 0 && selectedHistoryIds.size === sortedAuditTrail.length}
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                        {HISTORY_COLUMN_CONFIG.map(col => (
                          <TableHead 
                            key={col.key}
                            className="cursor-pointer select-none hover:bg-muted/50"
                            onClick={() => handleHistorySort(col.key)}
                          >
                            <div className="flex items-center gap-1">
                              {col.label}
                              {getHistorySortIcon(col.key)}
                              {col.filterable && (
                                <ColumnFilterDropdown
                                  columnKey={col.key}
                                  label={col.label}
                                  uniqueValues={uniqueFilterValues[col.key]}
                                  selectedValues={historyColumnFilters[col.key]}
                                  onSelectionChange={(values) => 
                                    setHistoryColumnFilters(prev => ({ ...prev, [col.key]: values }))
                                  }
                                />
                              )}
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                      {/* Search row */}
                      <TableRow>
                        <TableHead />
                        {HISTORY_COLUMN_CONFIG.map(col => (
                          <TableHead key={`search-${col.key}`} className="py-1">
                            <Input
                              placeholder={`Search...`}
                              className="h-7 text-xs"
                              value={historyColumnSearches[col.key]}
                              onChange={(e) => 
                                setHistoryColumnSearches(prev => ({ ...prev, [col.key]: e.target.value }))
                              }
                            />
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedAuditTrail.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            No changes recorded
                          </TableCell>
                        </TableRow>
                      ) : (
                        sortedAuditTrail.map((audit) => (
                          <TableRow key={audit.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedHistoryIds.has(audit.id)}
                                onCheckedChange={() => toggleSelectRow(audit.id)}
                              />
                            </TableCell>
                            <TableCell>{audit.user?.name || 'System'}</TableCell>
                            <TableCell>
                              {audit.old_value ? format(new Date(audit.old_value), 'PPP p') : 'N/A'}
                            </TableCell>
                            <TableCell>
                              {format(new Date(audit.new_value), 'PPP p')}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {audit.change_reason || '-'}
                            </TableCell>
                            <TableCell>
                              {format(new Date(audit.changed_at), 'PPP p')}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      </div>

      {/* Extend Confirmation Dialog */}
      <AlertDialog open={showExtendDialog} onOpenChange={setShowExtendDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Extend Entry Period?</AlertDialogTitle>
            <AlertDialogDescription>
              This will add 7 days to the current cutoff date. Employees will be able to edit data
              from {cutoffDate && format(cutoffDate, 'PPP')} to{' '}
              {cutoffDate && format(new Date(cutoffDate.getTime() + 7 * 24 * 60 * 60 * 1000), 'PPP')}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleExtendCutoff}>
              Extend Cutoff
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset to Last Sunday?</AlertDialogTitle>
            <AlertDialogDescription>
              This will set the cutoff to the end of the previous week. Employees can enter washes for the 7-day period ending on{' '}
              {format(getLastSunday(), 'EEEE, MMMM d, yyyy')} at{' '}
              {format(getLastSunday(), 'h:mm a')}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetToLastSunday}>
              Reset Cutoff
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manual Date Confirmation Dialog */}
      <AlertDialog open={showManualDialog} onOpenChange={setShowManualDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set Custom Cutoff Date?</AlertDialogTitle>
            <AlertDialogDescription>
              {manualDate && (
                <>
                  This will set the cutoff date to {format(manualDate, 'EEEE, MMMM d, yyyy')} at 11:59 PM.
                  Employees will be able to enter washes for 7 days leading up to this date.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setManualDate(undefined)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleManualDateSet}>
              Set Cutoff
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
