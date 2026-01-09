import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ReportDateRangePicker } from '@/components/reports/ReportDateRangePicker';
import { exportToExcel } from '@/lib/excelExporter';
import { format, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { 
  Calendar, Search, Download, ChevronLeft, ChevronRight, 
  Check, ChevronsUpDown, RefreshCw, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterOption {
  id: string;
  name: string;
}

interface WorkLogEntry {
  id: string;
  work_date: string;
  quantity: number;
  notes: string | null;
  created_at: string;
  employee_name: string;
  employee_code: string;
  employee_id: string;
  work_item_identifier: string | null;
  work_type_name: string;
  rate_type: string;
  frequency: string | null;
  rate: number | null;
  location_name: string;
  location_id: string;
  client_name: string;
  client_id: string;
}

type SortField = 'work_date' | 'employee_name' | 'client_name' | 'location_name' | 'work_type_name' | 'quantity' | 'rate' | 'line_total' | 'created_at';
type SortDirection = 'asc' | 'desc';

export default function FinanceThisWeek() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Parse URL params for deep linking
  const urlWorkLogIds = searchParams.get('workLogIds')?.split(',').filter(Boolean) || [];
  const urlEmployeeId = searchParams.get('employeeId') || '';
  const urlStartDate = searchParams.get('startDate') || '';
  const urlEndDate = searchParams.get('endDate') || '';

  // Date range state - default to current week
  const today = new Date();
  const defaultStart = startOfWeek(today, { weekStartsOn: 1 });
  const defaultEnd = endOfWeek(today, { weekStartsOn: 1 });
  
  const [startDate, setStartDate] = useState<Date>(
    urlStartDate ? parseISO(urlStartDate) : defaultStart
  );
  const [endDate, setEndDate] = useState<Date>(
    urlEndDate ? parseISO(urlEndDate) : defaultEnd
  );

  // Filter options
  const [clients, setClients] = useState<FilterOption[]>([]);
  const [locations, setLocations] = useState<FilterOption[]>([]);
  const [workTypes, setWorkTypes] = useState<FilterOption[]>([]);
  const [employees, setEmployees] = useState<FilterOption[]>([]);

  // Selected filters
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedWorkTypes, setSelectedWorkTypes] = useState<string[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>(
    urlEmployeeId ? [urlEmployeeId] : []
  );

  // Popover open states
  const [clientsOpen, setClientsOpen] = useState(false);
  const [locationsOpen, setLocationsOpen] = useState(false);
  const [workTypesOpen, setWorkTypesOpen] = useState(false);
  const [employeesOpen, setEmployeesOpen] = useState(false);

  // Data state
  const [workLogs, setWorkLogs] = useState<WorkLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Sorting
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch filter options on mount
  useEffect(() => {
    fetchFilterOptions();
  }, []);

  // Fetch locations when clients change
  useEffect(() => {
    fetchLocations();
  }, [selectedClients]);

  // Fetch data when filters change
  useEffect(() => {
    fetchWorkLogs();
  }, [startDate, endDate, selectedClients, selectedLocations, selectedWorkTypes, selectedEmployees, currentPage, pageSize, sortField, sortDirection, urlWorkLogIds.join(',')]);

  const fetchFilterOptions = async () => {
    const [clientsRes, workTypesRes, employeesRes] = await Promise.all([
      supabase.from('clients').select('id, name').eq('is_active', true).order('name'),
      supabase.from('work_types').select('id, name').eq('is_active', true).order('name'),
      supabase.from('users_safe_view').select('id, name').order('name')
    ]);

    setClients(clientsRes.data || []);
    setWorkTypes(workTypesRes.data || []);
    setEmployees(employeesRes.data || []);
  };

  const fetchLocations = async () => {
    let query = supabase
      .from('locations')
      .select('id, name')
      .eq('is_active', true)
      .order('name');

    if (selectedClients.length > 0) {
      query = query.in('client_id', selectedClients);
    }

    const { data } = await query;
    setLocations(data || []);
  };

  const fetchWorkLogs = async () => {
    setLoading(true);
    try {
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');

      // Build query for work_logs with all joins
      let query = supabase
        .from('work_logs')
        .select(`
          id,
          work_date,
          quantity,
          notes,
          created_at,
          employee_id,
          work_item_id,
          rate_config_id
        `, { count: 'exact' })
        .gte('work_date', startStr)
        .lte('work_date', endStr);

      // Filter by specific work log IDs if provided via deep link
      if (urlWorkLogIds.length > 0) {
        query = query.in('id', urlWorkLogIds);
      }

      // Apply employee filter
      if (selectedEmployees.length > 0) {
        query = query.in('employee_id', selectedEmployees);
      }

      // Sort
      const ascending = sortDirection === 'asc';
      if (sortField === 'work_date' || sortField === 'created_at') {
        query = query.order(sortField, { ascending });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      // Pagination
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data: rawLogs, error, count } = await query;

      if (error) throw error;
      if (!rawLogs || rawLogs.length === 0) {
        setWorkLogs([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }

      setTotalCount(count || 0);

      // Collect IDs for batch fetching
      const employeeIds = [...new Set(rawLogs.map(l => l.employee_id))];
      const workItemIds = [...new Set(rawLogs.filter(l => l.work_item_id).map(l => l.work_item_id!))];
      const rateConfigIds = [...new Set(rawLogs.filter(l => l.rate_config_id).map(l => l.rate_config_id!))];

      // Batch fetch related data
      const [employeesRes, workItemsRes, directRateConfigsRes] = await Promise.all([
        supabase.from('users_safe_view').select('id, name, employee_id').in('id', employeeIds),
        workItemIds.length > 0 
          ? supabase.from('work_items').select('id, identifier, rate_config_id').in('id', workItemIds)
          : Promise.resolve({ data: [] }),
        rateConfigIds.length > 0
          ? supabase.from('rate_configs').select('id, rate, frequency, work_type_id, location_id, client_id').in('id', rateConfigIds)
          : Promise.resolve({ data: [] })
      ]);

      // Get rate_config_ids from work_items too
      const workItemRateConfigIds = (workItemsRes.data || []).map(wi => wi.rate_config_id);
      const allRateConfigIds = [...new Set([...rateConfigIds, ...workItemRateConfigIds])];

      // Fetch all rate configs
      const { data: allRateConfigs } = allRateConfigIds.length > 0
        ? await supabase.from('rate_configs').select('id, rate, frequency, work_type_id, location_id, client_id').in('id', allRateConfigIds)
        : { data: [] };

      // Get work type, location, client IDs
      const workTypeIds = [...new Set((allRateConfigs || []).map(rc => rc.work_type_id))];
      const locationIds = [...new Set((allRateConfigs || []).map(rc => rc.location_id))];
      const clientIds = [...new Set((allRateConfigs || []).map(rc => rc.client_id))];

      // Batch fetch work types, locations, clients
      const [workTypesRes, locationsRes, clientsRes] = await Promise.all([
        workTypeIds.length > 0 
          ? supabase.from('work_types').select('id, name, rate_type').in('id', workTypeIds)
          : Promise.resolve({ data: [] }),
        locationIds.length > 0
          ? supabase.from('locations').select('id, name').in('id', locationIds)
          : Promise.resolve({ data: [] }),
        clientIds.length > 0
          ? supabase.from('clients').select('id, name').in('id', clientIds)
          : Promise.resolve({ data: [] })
      ]);

      // Create lookup maps
      const employeesMap = new Map((employeesRes.data || []).map(e => [e.id, e]));
      const workItemsMap = new Map((workItemsRes.data || []).map(wi => [wi.id, wi]));
      const rateConfigsMap = new Map((allRateConfigs || []).map(rc => [rc.id, rc]));
      const workTypesMap = new Map((workTypesRes.data || []).map(wt => [wt.id, wt]));
      const locationsMap = new Map((locationsRes.data || []).map(l => [l.id, l]));
      const clientsMap = new Map((clientsRes.data || []).map(c => [c.id, c]));

      // Transform data
      const entries: WorkLogEntry[] = rawLogs.map(log => {
        const employee = employeesMap.get(log.employee_id);
        const workItem = log.work_item_id ? workItemsMap.get(log.work_item_id) : null;
        const rateConfigId = workItem?.rate_config_id || log.rate_config_id;
        const rateConfig = rateConfigId ? rateConfigsMap.get(rateConfigId) : null;
        const workType = rateConfig ? workTypesMap.get(rateConfig.work_type_id) : null;
        const location = rateConfig ? locationsMap.get(rateConfig.location_id) : null;
        const client = rateConfig ? clientsMap.get(rateConfig.client_id) : null;

        return {
          id: log.id,
          work_date: log.work_date,
          quantity: log.quantity,
          notes: log.notes,
          created_at: log.created_at,
          employee_name: employee?.name || 'Unknown',
          employee_code: employee?.employee_id || 'N/A',
          employee_id: log.employee_id,
          work_item_identifier: workItem?.identifier || null,
          work_type_name: workType?.name || 'Unknown',
          rate_type: workType?.rate_type || 'per_unit',
          frequency: rateConfig?.frequency || null,
          rate: rateConfig?.rate || null,
          location_name: location?.name || 'Unknown',
          location_id: location?.id || '',
          client_name: client?.name || 'Unknown',
          client_id: client?.id || ''
        };
      });

      // Apply client-side filters for client, location, work type
      let filtered = entries;
      if (selectedClients.length > 0) {
        filtered = filtered.filter(e => selectedClients.includes(e.client_id));
      }
      if (selectedLocations.length > 0) {
        filtered = filtered.filter(e => selectedLocations.includes(e.location_id));
      }
      if (selectedWorkTypes.length > 0) {
        // Get work type IDs by name match
        const selectedWTNames = workTypes.filter(wt => selectedWorkTypes.includes(wt.id)).map(wt => wt.name);
        filtered = filtered.filter(e => selectedWTNames.includes(e.work_type_name));
      }

      setWorkLogs(filtered);
    } catch (error: any) {
      console.error('Error fetching work logs:', error);
      toast.error('Failed to load work logs');
    } finally {
      setLoading(false);
    }
  };

  // Apply search filter
  const filteredLogs = useMemo(() => {
    if (!debouncedSearch) return workLogs;
    const query = debouncedSearch.toLowerCase();
    return workLogs.filter(log => 
      log.employee_name.toLowerCase().includes(query) ||
      log.employee_code.toLowerCase().includes(query) ||
      log.client_name.toLowerCase().includes(query) ||
      log.location_name.toLowerCase().includes(query) ||
      log.work_type_name.toLowerCase().includes(query) ||
      log.work_item_identifier?.toLowerCase().includes(query) ||
      log.notes?.toLowerCase().includes(query)
    );
  }, [workLogs, debouncedSearch]);

  // Client-side sorting for non-date fields
  const sortedLogs = useMemo(() => {
    if (sortField === 'work_date' || sortField === 'created_at') {
      return filteredLogs; // Already sorted server-side
    }

    return [...filteredLogs].sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortField) {
        case 'employee_name':
          aVal = a.employee_name;
          bVal = b.employee_name;
          break;
        case 'client_name':
          aVal = a.client_name;
          bVal = b.client_name;
          break;
        case 'location_name':
          aVal = a.location_name;
          bVal = b.location_name;
          break;
        case 'work_type_name':
          aVal = a.work_type_name;
          bVal = b.work_type_name;
          break;
        case 'quantity':
          aVal = a.quantity;
          bVal = b.quantity;
          break;
        case 'rate':
          aVal = a.rate || 0;
          bVal = b.rate || 0;
          break;
        case 'line_total':
          aVal = (a.rate || 0) * a.quantity;
          bVal = (b.rate || 0) * b.quantity;
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [filteredLogs, sortField, sortDirection]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const totalQty = sortedLogs.reduce((sum, log) => sum + log.quantity, 0);
    const totalValue = sortedLogs.reduce((sum, log) => sum + (log.rate || 0) * log.quantity, 0);
    return { count: sortedLogs.length, totalQty, totalValue };
  }, [sortedLogs]);

  // Toggle selection helper
  const toggleSelection = (value: string, selected: string[], onChange: (values: string[]) => void) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  // Get label for selected items
  const getSelectedLabel = (selected: string[], options: FilterOption[], singular: string) => {
    if (selected.length === 0) return `All ${singular}s`;
    if (selected.length === 1) {
      const item = options.find(o => o.id === selected[0]);
      return item?.name || `1 ${singular}`;
    }
    return `${selected.length} ${singular}s`;
  };

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  // Handle export
  const handleExport = () => {
    if (sortedLogs.length === 0) {
      toast.error('No data to export');
      return;
    }

    if (sortedLogs.length > 5000) {
      toast.warning('Large export may take a moment...', { duration: 3000 });
    }

    const exportData = sortedLogs.map(log => ({
      'Work Date': format(new Date(log.work_date), 'MM/dd/yyyy'),
      'Employee': log.employee_name,
      'Employee ID': log.employee_code,
      'Client': log.client_name,
      'Location': log.location_name,
      'Work Type': log.work_type_name,
      'Frequency': log.frequency || '-',
      'Item ID': log.work_item_identifier || '-',
      'Quantity': log.quantity,
      'Rate': log.rate !== null ? `$${log.rate.toFixed(2)}` : 'TBD',
      'Line Total': log.rate !== null ? `$${(log.rate * log.quantity).toFixed(2)}` : 'TBD',
      'Notes': log.notes || '-',
      'Submitted': format(new Date(log.created_at), 'MM/dd/yyyy h:mm a')
    }));

    try {
      const dateRange = `${format(startDate, 'MMM_d')}-${format(endDate, 'MMM_d_yyyy')}`;
      exportToExcel(exportData, `WorkLogs_${dateRange}`, 'Work Logs');
      toast.success('Export complete');
    } catch (error) {
      toast.error('Export failed');
    }
  };

  // Clear deep link filters
  const clearDeepLink = () => {
    setSearchParams({});
    setSelectedEmployees([]);
  };

  // Render sort icon
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 text-muted-foreground/50" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 text-primary" />
      : <ArrowDown className="h-4 w-4 text-primary" />;
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              This Week's Work Logs
            </h1>
            <p className="text-muted-foreground">
              Detailed view of all submitted work
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="icon"
              onClick={fetchWorkLogs} 
              disabled={loading}
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={handleExport} disabled={loading || sortedLogs.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
          </div>
        </div>

        {/* Deep link notice */}
        {(urlWorkLogIds.length > 0 || urlEmployeeId) && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-primary" />
              <span className="text-sm">
                {urlWorkLogIds.length > 0 
                  ? `Showing ${urlWorkLogIds.length} specific work items from message`
                  : `Filtered to show work from a specific employee`}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={clearDeepLink}>
              Clear Filter
            </Button>
          </div>
        )}

        {/* Date Range */}
        <Card>
          <CardContent className="p-4">
            <ReportDateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={(date) => {
                setStartDate(date);
                setCurrentPage(1);
              }}
              onEndDateChange={(date) => {
                setEndDate(date);
                setCurrentPage(1);
              }}
            />
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4">
              {/* Clients */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-muted-foreground">Clients</label>
                <Popover open={clientsOpen} onOpenChange={setClientsOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[180px] justify-between">
                      <span className="truncate">{getSelectedLabel(selectedClients, clients, 'Client')}</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0 bg-popover">
                    <Command>
                      <CommandInput placeholder="Search clients..." />
                      <CommandList>
                        <CommandEmpty>No clients found.</CommandEmpty>
                        <CommandGroup>
                          {clients.map(client => (
                            <CommandItem
                              key={client.id}
                              value={client.name}
                              onSelect={() => toggleSelection(client.id, selectedClients, setSelectedClients)}
                            >
                              <Check className={cn('mr-2 h-4 w-4', selectedClients.includes(client.id) ? 'opacity-100' : 'opacity-0')} />
                              {client.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                    {selectedClients.length > 0 && (
                      <div className="border-t p-2">
                        <Button variant="ghost" size="sm" className="w-full" onClick={() => setSelectedClients([])}>
                          Clear
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              {/* Locations */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-muted-foreground">Locations</label>
                <Popover open={locationsOpen} onOpenChange={setLocationsOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[180px] justify-between">
                      <span className="truncate">{getSelectedLabel(selectedLocations, locations, 'Location')}</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0 bg-popover">
                    <Command>
                      <CommandInput placeholder="Search locations..." />
                      <CommandList>
                        <CommandEmpty>No locations found.</CommandEmpty>
                        <CommandGroup>
                          {locations.map(location => (
                            <CommandItem
                              key={location.id}
                              value={location.name}
                              onSelect={() => toggleSelection(location.id, selectedLocations, setSelectedLocations)}
                            >
                              <Check className={cn('mr-2 h-4 w-4', selectedLocations.includes(location.id) ? 'opacity-100' : 'opacity-0')} />
                              {location.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                    {selectedLocations.length > 0 && (
                      <div className="border-t p-2">
                        <Button variant="ghost" size="sm" className="w-full" onClick={() => setSelectedLocations([])}>
                          Clear
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              {/* Work Types */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-muted-foreground">Work Types</label>
                <Popover open={workTypesOpen} onOpenChange={setWorkTypesOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[180px] justify-between">
                      <span className="truncate">{getSelectedLabel(selectedWorkTypes, workTypes, 'Type')}</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0 bg-popover">
                    <Command>
                      <CommandInput placeholder="Search work types..." />
                      <CommandList>
                        <CommandEmpty>No work types found.</CommandEmpty>
                        <CommandGroup>
                          {workTypes.map(wt => (
                            <CommandItem
                              key={wt.id}
                              value={wt.name}
                              onSelect={() => toggleSelection(wt.id, selectedWorkTypes, setSelectedWorkTypes)}
                            >
                              <Check className={cn('mr-2 h-4 w-4', selectedWorkTypes.includes(wt.id) ? 'opacity-100' : 'opacity-0')} />
                              {wt.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                    {selectedWorkTypes.length > 0 && (
                      <div className="border-t p-2">
                        <Button variant="ghost" size="sm" className="w-full" onClick={() => setSelectedWorkTypes([])}>
                          Clear
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              {/* Employees */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-muted-foreground">Employees</label>
                <Popover open={employeesOpen} onOpenChange={setEmployeesOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[180px] justify-between">
                      <span className="truncate">{getSelectedLabel(selectedEmployees, employees, 'Employee')}</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0 bg-popover">
                    <Command>
                      <CommandInput placeholder="Search employees..." />
                      <CommandList>
                        <CommandEmpty>No employees found.</CommandEmpty>
                        <CommandGroup>
                          {employees.map(emp => (
                            <CommandItem
                              key={emp.id}
                              value={emp.name}
                              onSelect={() => toggleSelection(emp.id, selectedEmployees, setSelectedEmployees)}
                            >
                              <Check className={cn('mr-2 h-4 w-4', selectedEmployees.includes(emp.id) ? 'opacity-100' : 'opacity-0')} />
                              {emp.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                    {selectedEmployees.length > 0 && (
                      <div className="border-t p-2">
                        <Button variant="ghost" size="sm" className="w-full" onClick={() => setSelectedEmployees([])}>
                          Clear
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              {/* Clear all */}
              {(selectedClients.length > 0 || selectedLocations.length > 0 || selectedWorkTypes.length > 0 || selectedEmployees.length > 0) && (
                <div className="flex items-end">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      setSelectedClients([]);
                      setSelectedLocations([]);
                      setSelectedWorkTypes([]);
                      setSelectedEmployees([]);
                    }}
                  >
                    Clear All
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats + Search + Pagination Controls */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              {/* Stats */}
              <div className="flex items-center gap-4 text-sm">
                <span className="font-medium">{summaryStats.count.toLocaleString()} entries</span>
                <span className="text-muted-foreground">|</span>
                <span>Qty: <span className="font-medium">{summaryStats.totalQty.toLocaleString()}</span></span>
                <span className="text-muted-foreground">|</span>
                <span>Value: <span className="font-medium text-green-600">${summaryStats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></span>
              </div>

              {/* Search + Page Size */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-[200px]"
                  />
                </div>
                <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20 rows</SelectItem>
                    <SelectItem value="50">50 rows</SelectItem>
                    <SelectItem value="100">100 rows</SelectItem>
                    <SelectItem value="200">200 rows</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('work_date')}>
                      <div className="flex items-center gap-1">Date <SortIcon field="work_date" /></div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('employee_name')}>
                      <div className="flex items-center gap-1">Employee <SortIcon field="employee_name" /></div>
                    </TableHead>
                    <TableHead>Emp ID</TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('client_name')}>
                      <div className="flex items-center gap-1">Client <SortIcon field="client_name" /></div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('location_name')}>
                      <div className="flex items-center gap-1">Location <SortIcon field="location_name" /></div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('work_type_name')}>
                      <div className="flex items-center gap-1">Type <SortIcon field="work_type_name" /></div>
                    </TableHead>
                    <TableHead>Freq</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('quantity')}>
                      <div className="flex items-center justify-end gap-1">Qty <SortIcon field="quantity" /></div>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('rate')}>
                      <div className="flex items-center justify-end gap-1">Rate <SortIcon field="rate" /></div>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('line_total')}>
                      <div className="flex items-center justify-end gap-1">Total <SortIcon field="line_total" /></div>
                    </TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('created_at')}>
                      <div className="flex items-center gap-1">Submitted <SortIcon field="created_at" /></div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : sortedLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                        No work logs found for this date range
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedLogs.map((log, index) => {
                      const lineTotal = log.rate !== null ? log.rate * log.quantity : null;
                      return (
                        <TableRow key={log.id} className={index % 2 === 0 ? '' : 'bg-muted/30'}>
                          <TableCell className="whitespace-nowrap">{format(new Date(log.work_date), 'MM/dd')}</TableCell>
                          <TableCell className="font-medium">{log.employee_name}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">{log.employee_code}</TableCell>
                          <TableCell>{log.client_name}</TableCell>
                          <TableCell>{log.location_name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {log.work_type_name}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">{log.frequency || '-'}</TableCell>
                          <TableCell className="font-mono text-xs">{log.work_item_identifier || '-'}</TableCell>
                          <TableCell className="text-right font-medium">{log.quantity}</TableCell>
                          <TableCell className="text-right">
                            {log.rate !== null ? (
                              `$${log.rate.toFixed(2)}`
                            ) : (
                              <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">TBD</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {lineTotal !== null ? (
                              <span className="text-green-600">${lineTotal.toFixed(2)}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate text-xs text-muted-foreground" title={log.notes || ''}>
                            {log.notes || '-'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(log.created_at), 'MM/dd h:mma')}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalCount)} of {totalCount.toLocaleString()}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm px-2">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
