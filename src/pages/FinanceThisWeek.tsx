import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { Download, Filter, ChevronUp, ChevronDown, ChevronsUpDown, X, Calendar as CalendarIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { exportToExcel } from '@/lib/excelExporter';
import { toast } from 'sonner';

interface FilterOption {
  id: string;
  name: string;
}

interface WorkLogEntry {
  id: string;
  workDate: string;
  employeeName: string;
  employeeId: string;
  employeeUserId: string;
  clientName: string;
  clientId: string;
  locationName: string;
  locationId: string;
  workTypeName: string;
  workTypeId: string;
  frequency: string;
  workItemIdentifier: string;
  quantity: number;
  rate: number;
  lineTotal: number;
  notes: string;
  createdAt: string;
}

type SortField = 'workDate' | 'employeeName' | 'clientName' | 'locationName' | 'workTypeName' | 'quantity' | 'lineTotal' | 'createdAt';
type SortDirection = 'asc' | 'desc';

export default function FinanceThisWeek() {
  const [searchParams, setSearchParams] = useSearchParams();

  // URL params for deep linking
  const urlWorkLogIds = searchParams.get('workLogIds')?.split(',').filter(Boolean) || [];
  const urlEmployeeId = searchParams.get('employeeId') || '';
  const urlStartDate = searchParams.get('startDate') || '';
  const urlEndDate = searchParams.get('endDate') || '';

  const today = new Date();
  const defaultStart = startOfWeek(today, { weekStartsOn: 1 });
  const defaultEnd = endOfWeek(today, { weekStartsOn: 1 });

  // State
  const [startDate, setStartDate] = useState<Date>(urlStartDate ? parseISO(urlStartDate) : defaultStart);
  const [endDate, setEndDate] = useState<Date>(urlEndDate ? parseISO(urlEndDate) : defaultEnd);
  const [workLogs, setWorkLogs] = useState<WorkLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Filter options
  const [employees, setEmployees] = useState<FilterOption[]>([]);
  const [clients, setClients] = useState<FilterOption[]>([]);
  const [locations, setLocations] = useState<FilterOption[]>([]);
  const [workTypes, setWorkTypes] = useState<FilterOption[]>([]);

  // Selected filters
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>(urlEmployeeId ? [urlEmployeeId] : []);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedWorkTypes, setSelectedWorkTypes] = useState<string[]>([]);

  // Sorting
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Deep link mode
  const isDeepLinked = urlWorkLogIds.length > 0 || !!urlEmployeeId;

  // Fetch filter options
  useEffect(() => {
    const fetchFilters = async () => {
      const [employeesRes, clientsRes, locationsRes, workTypesRes] = await Promise.all([
        supabase.from('users').select('id, name').eq('is_active', true).order('name'),
        supabase.from('clients').select('id, name').eq('is_active', true).order('name'),
        supabase.from('locations').select('id, name').eq('is_active', true).order('name'),
        supabase.from('work_types').select('id, name').eq('is_active', true).order('name'),
      ]);

      if (employeesRes.data) setEmployees(employeesRes.data);
      if (clientsRes.data) setClients(clientsRes.data);
      if (locationsRes.data) setLocations(locationsRes.data);
      if (workTypesRes.data) setWorkTypes(workTypesRes.data);
    };
    fetchFilters();
  }, []);

  // Fetch work logs
  useEffect(() => {
    const fetchWorkLogs = async () => {
      setLoading(true);
      try {
        const startStr = format(startDate, 'yyyy-MM-dd');
        const endStr = format(endDate, 'yyyy-MM-dd');
        const offset = (currentPage - 1) * pageSize;

        let query = supabase
          .from('work_logs')
          .select('id, work_date, quantity, notes, created_at, employee_id, work_item_id, rate_config_id', { count: 'exact' })
          .gte('work_date', startStr)
          .lte('work_date', endStr);

        // Apply deep link filter for specific work log IDs
        if (urlWorkLogIds.length > 0) {
          query = query.in('id', urlWorkLogIds);
        }

        const { data: logsData, count, error } = await query
          .order('created_at', { ascending: false })
          .range(offset, offset + pageSize - 1);

        if (error) throw error;
        setTotalCount(count || 0);

        if (!logsData || logsData.length === 0) {
          setWorkLogs([]);
          setLoading(false);
          return;
        }

        // Batch fetch related data
        const employeeIds = [...new Set(logsData.map(l => l.employee_id))];
        const workItemIds = [...new Set(logsData.map(l => l.work_item_id).filter(Boolean))];
        const rateConfigIds = [...new Set(logsData.map(l => l.rate_config_id).filter(Boolean))];

        const [usersRes, workItemsRes, rateConfigsRes] = await Promise.all([
          supabase.from('users').select('id, name, employee_id').in('id', employeeIds),
          workItemIds.length > 0 
            ? supabase.from('work_items').select('id, identifier, rate_config_id').in('id', workItemIds)
            : Promise.resolve({ data: [] }),
          rateConfigIds.length > 0
            ? supabase.from('rate_configs').select('id, rate, frequency, client_id, location_id, work_type_id').in('id', rateConfigIds)
            : Promise.resolve({ data: [] }),
        ]);

        const usersMap = new Map((usersRes.data || []).map(u => [u.id, u]));
        const workItemsMap = new Map((workItemsRes.data || []).map(w => [w.id, w]));
        
        // Get all rate config IDs including from work items
        const allRateConfigIds = new Set(rateConfigIds);
        (workItemsRes.data || []).forEach(w => {
          if (w.rate_config_id) allRateConfigIds.add(w.rate_config_id);
        });

        // Fetch rate configs for work items if needed
        const additionalRateConfigIds = [...allRateConfigIds].filter(id => !rateConfigIds.includes(id));
        let allRateConfigs = rateConfigsRes.data || [];
        
        if (additionalRateConfigIds.length > 0) {
          const { data: additionalConfigs } = await supabase
            .from('rate_configs')
            .select('id, rate, frequency, client_id, location_id, work_type_id')
            .in('id', additionalRateConfigIds);
          if (additionalConfigs) {
            allRateConfigs = [...allRateConfigs, ...additionalConfigs];
          }
        }

        const rateConfigsMap = new Map(allRateConfigs.map(r => [r.id, r]));

        // Fetch clients, locations, work types for rate configs
        const clientIds = [...new Set(allRateConfigs.map(r => r.client_id))];
        const locationIds = [...new Set(allRateConfigs.map(r => r.location_id))];
        const workTypeIds = [...new Set(allRateConfigs.map(r => r.work_type_id))];

        const [clientsRes, locationsRes, workTypesRes] = await Promise.all([
          clientIds.length > 0 ? supabase.from('clients').select('id, name').in('id', clientIds) : Promise.resolve({ data: [] }),
          locationIds.length > 0 ? supabase.from('locations').select('id, name').in('id', locationIds) : Promise.resolve({ data: [] }),
          workTypeIds.length > 0 ? supabase.from('work_types').select('id, name').in('id', workTypeIds) : Promise.resolve({ data: [] }),
        ]);

        const clientsMap = new Map((clientsRes.data || []).map(c => [c.id, c]));
        const locationsMap = new Map((locationsRes.data || []).map(l => [l.id, l]));
        const workTypesMap = new Map((workTypesRes.data || []).map(w => [w.id, w]));

        // Build entries
        const entries: WorkLogEntry[] = logsData.map(log => {
          const user = usersMap.get(log.employee_id);
          const workItem = log.work_item_id ? workItemsMap.get(log.work_item_id) : null;
          const rateConfigId = workItem?.rate_config_id || log.rate_config_id;
          const rateConfig = rateConfigId ? rateConfigsMap.get(rateConfigId) : null;
          const client = rateConfig ? clientsMap.get(rateConfig.client_id) : null;
          const location = rateConfig ? locationsMap.get(rateConfig.location_id) : null;
          const workType = rateConfig ? workTypesMap.get(rateConfig.work_type_id) : null;

          const rate = rateConfig?.rate || 0;
          const lineTotal = log.quantity * rate;

          return {
            id: log.id,
            workDate: log.work_date,
            employeeName: user?.name || 'Unknown',
            employeeId: user?.employee_id || '',
            employeeUserId: log.employee_id,
            clientName: client?.name || 'Unknown',
            clientId: client?.id || '',
            locationName: location?.name || 'Unknown',
            locationId: location?.id || '',
            workTypeName: workType?.name || 'Unknown',
            workTypeId: workType?.id || '',
            frequency: rateConfig?.frequency || '',
            workItemIdentifier: workItem?.identifier || '-',
            quantity: log.quantity,
            rate,
            lineTotal,
            notes: log.notes || '',
            createdAt: log.created_at,
          };
        });

        setWorkLogs(entries);
      } catch (error) {
        console.error('Error fetching work logs:', error);
        toast.error('Failed to load work logs');
      } finally {
        setLoading(false);
      }
    };

    fetchWorkLogs();
  }, [startDate, endDate, currentPage, pageSize, urlWorkLogIds.join(',')]);

  // Filter and sort logs
  const filteredAndSortedLogs = useMemo(() => {
    let result = [...workLogs];

    // Apply filters
    if (selectedEmployees.length > 0) {
      result = result.filter(log => selectedEmployees.includes(log.employeeUserId));
    }
    if (selectedClients.length > 0) {
      result = result.filter(log => selectedClients.includes(log.clientId));
    }
    if (selectedLocations.length > 0) {
      result = result.filter(log => selectedLocations.includes(log.locationId));
    }
    if (selectedWorkTypes.length > 0) {
      result = result.filter(log => selectedWorkTypes.includes(log.workTypeId));
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'workDate':
          comparison = a.workDate.localeCompare(b.workDate);
          break;
        case 'employeeName':
          comparison = a.employeeName.localeCompare(b.employeeName);
          break;
        case 'clientName':
          comparison = a.clientName.localeCompare(b.clientName);
          break;
        case 'locationName':
          comparison = a.locationName.localeCompare(b.locationName);
          break;
        case 'workTypeName':
          comparison = a.workTypeName.localeCompare(b.workTypeName);
          break;
        case 'quantity':
          comparison = a.quantity - b.quantity;
          break;
        case 'lineTotal':
          comparison = a.lineTotal - b.lineTotal;
          break;
        case 'createdAt':
          comparison = a.createdAt.localeCompare(b.createdAt);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [workLogs, selectedEmployees, selectedClients, selectedLocations, selectedWorkTypes, sortField, sortDirection]);

  // Summary stats
  const summaryStats = useMemo(() => {
    const totalQty = filteredAndSortedLogs.reduce((sum, log) => sum + log.quantity, 0);
    const totalValue = filteredAndSortedLogs.reduce((sum, log) => sum + log.lineTotal, 0);
    return { count: filteredAndSortedLogs.length, totalQty, totalValue };
  }, [filteredAndSortedLogs]);

  const totalPages = Math.ceil(totalCount / pageSize);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const toggleFilter = (list: string[], setList: (v: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter(v => v !== value) : [...list, value]);
  };

  const clearAllFilters = () => {
    setSelectedEmployees([]);
    setSelectedClients([]);
    setSelectedLocations([]);
    setSelectedWorkTypes([]);
  };

  const clearDeepLink = () => {
    setSearchParams({});
    setSelectedEmployees([]);
  };

  const handleExport = () => {
    if (filteredAndSortedLogs.length === 0) {
      toast.error('No data to export');
      return;
    }

    if (filteredAndSortedLogs.length > 5000) {
      toast.warning('Large export - this may take a moment');
    }

    const exportData = filteredAndSortedLogs.map(log => ({
      'Date': log.workDate,
      'Employee': log.employeeName,
      'Emp ID': log.employeeId,
      'Client': log.clientName,
      'Location': log.locationName,
      'Type': log.workTypeName,
      'Frequency': log.frequency,
      'Item': log.workItemIdentifier,
      'Qty': log.quantity,
      'Rate': log.rate,
      'Total': log.lineTotal,
      'Notes': log.notes,
    }));

    exportToExcel(exportData, `work-logs-${format(startDate, 'yyyy-MM-dd')}-to-${format(endDate, 'yyyy-MM-dd')}`);
    toast.success('Export complete');
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronsUpDown className="h-3 w-3 text-muted-foreground" />;
    return sortDirection === 'asc' 
      ? <ChevronUp className="h-3 w-3" /> 
      : <ChevronDown className="h-3 w-3" />;
  };

  const FilterPopover = ({ 
    options, 
    selected, 
    onToggle, 
    label 
  }: { 
    options: FilterOption[]; 
    selected: string[]; 
    onToggle: (id: string) => void; 
    label: string;
  }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={cn("h-5 w-5 p-0", selected.length > 0 && "text-primary")}>
          <Filter className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="text-xs font-medium text-muted-foreground mb-2">Filter {label}</div>
        <ScrollArea className="h-48">
          <div className="space-y-1">
            {options.map(opt => (
              <label 
                key={opt.id} 
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer text-sm"
              >
                <Checkbox 
                  checked={selected.includes(opt.id)} 
                  onCheckedChange={() => onToggle(opt.id)}
                />
                <span className="truncate">{opt.name}</span>
              </label>
            ))}
          </div>
        </ScrollArea>
        {selected.length > 0 && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full mt-2 text-xs"
            onClick={() => options.forEach(opt => {
              if (selected.includes(opt.id)) onToggle(opt.id);
            })}
          >
            Clear
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );

  const activeFiltersCount = selectedEmployees.length + selectedClients.length + selectedLocations.length + selectedWorkTypes.length;

  return (
    <Layout>
      <div className="h-full flex flex-col">
        {/* Minimal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
          <h1 className="text-lg font-semibold">Work Logs</h1>

          <div className="flex items-center gap-4">
            {/* Compact date range */}
            <div className="flex items-center gap-1 text-sm">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-sm font-normal">
                    <CalendarIcon className="h-3 w-3 mr-1" />
                    {format(startDate, 'MMM d')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground">→</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-sm font-normal">
                    <CalendarIcon className="h-3 w-3 mr-1" />
                    {format(endDate, 'MMM d, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Summary */}
            <div className="text-sm text-muted-foreground">
              {summaryStats.count.toLocaleString()} entries
              <span className="mx-1">|</span>
              <span className="text-green-600 font-medium">${summaryStats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>

            {/* Clear filters */}
            {activeFiltersCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-xs"
                onClick={clearAllFilters}
              >
                Clear {activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''}
              </Button>
            )}

            {/* Export */}
            <Button variant="outline" size="sm" className="h-7" onClick={handleExport}>
              <Download className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Deep link notice */}
        {isDeepLinked && (
          <div className="flex items-center justify-between px-4 py-2 bg-blue-50 dark:bg-blue-950 border-b text-sm">
            <span className="text-blue-700 dark:text-blue-300">
              {urlWorkLogIds.length > 0 
                ? `Showing ${urlWorkLogIds.length} linked work items` 
                : 'Filtered by employee from message'}
            </span>
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={clearDeepLink}>
              <X className="h-3 w-3 mr-1" /> Clear
            </Button>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-24">
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleSort('workDate')} className="flex items-center gap-1 hover:text-foreground">
                      Date <SortIcon field="workDate" />
                    </button>
                  </div>
                </TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleSort('employeeName')} className="flex items-center gap-1 hover:text-foreground">
                      Employee <SortIcon field="employeeName" />
                    </button>
                    <FilterPopover 
                      options={employees} 
                      selected={selectedEmployees} 
                      onToggle={(id) => toggleFilter(selectedEmployees, setSelectedEmployees, id)}
                      label="Employee"
                    />
                  </div>
                </TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleSort('clientName')} className="flex items-center gap-1 hover:text-foreground">
                      Client <SortIcon field="clientName" />
                    </button>
                    <FilterPopover 
                      options={clients} 
                      selected={selectedClients} 
                      onToggle={(id) => toggleFilter(selectedClients, setSelectedClients, id)}
                      label="Client"
                    />
                  </div>
                </TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleSort('locationName')} className="flex items-center gap-1 hover:text-foreground">
                      Location <SortIcon field="locationName" />
                    </button>
                    <FilterPopover 
                      options={locations} 
                      selected={selectedLocations} 
                      onToggle={(id) => toggleFilter(selectedLocations, setSelectedLocations, id)}
                      label="Location"
                    />
                  </div>
                </TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleSort('workTypeName')} className="flex items-center gap-1 hover:text-foreground">
                      Type <SortIcon field="workTypeName" />
                    </button>
                    <FilterPopover 
                      options={workTypes} 
                      selected={selectedWorkTypes} 
                      onToggle={(id) => toggleFilter(selectedWorkTypes, setSelectedWorkTypes, id)}
                      label="Type"
                    />
                  </div>
                </TableHead>
                <TableHead className="w-20">Freq</TableHead>
                <TableHead className="w-24">Item</TableHead>
                <TableHead className="w-16 text-right">
                  <button onClick={() => handleSort('quantity')} className="flex items-center gap-1 hover:text-foreground ml-auto">
                    Qty <SortIcon field="quantity" />
                  </button>
                </TableHead>
                <TableHead className="w-20 text-right">Rate</TableHead>
                <TableHead className="w-24 text-right">
                  <button onClick={() => handleSort('lineTotal')} className="flex items-center gap-1 hover:text-foreground ml-auto">
                    Total <SortIcon field="lineTotal" />
                  </button>
                </TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredAndSortedLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    No work logs found for this period
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedLogs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs">{log.workDate}</TableCell>
                    <TableCell>{log.employeeName}</TableCell>
                    <TableCell>{log.clientName}</TableCell>
                    <TableCell>{log.locationName}</TableCell>
                    <TableCell>{log.workTypeName}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{log.frequency || '-'}</TableCell>
                    <TableCell className="font-mono text-xs">{log.workItemIdentifier}</TableCell>
                    <TableCell className="text-right">{log.quantity}</TableCell>
                    <TableCell className="text-right font-mono text-xs">${log.rate.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">${log.lineTotal.toFixed(2)}</TableCell>
                    <TableCell className="text-muted-foreground text-xs max-w-32 truncate">{log.notes || '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Compact Pagination Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t bg-background text-sm">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
            >
              ← Prev
            </Button>
            <span className="text-muted-foreground">
              Page {currentPage} of {totalPages || 1}
            </span>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              Next →
            </Button>
          </div>
          <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
            <SelectTrigger className="w-20 h-7">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="200">200</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </Layout>
  );
}
