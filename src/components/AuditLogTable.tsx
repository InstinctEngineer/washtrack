import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, ChevronRight, CalendarIcon, Filter, X, Columns3, Download, ArrowRight } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { exportToExcel } from '@/lib/excelExporter';
import { toast } from '@/hooks/use-toast';

interface AuditLogEntry {
  id: string;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data: any;
  new_data: any;
  changed_by: string;
  changed_at: string;
  changed_by_user?: {
    id: string;
    name: string;
    employee_id: string;
  };
}

type AuditColumnKey = 'table' | 'action' | 'employee' | 'vehicle' | 'date' | 'time';

const AUDIT_COLUMN_CONFIG: { key: AuditColumnKey; label: string; filterable: boolean }[] = [
  { key: 'table', label: 'Table', filterable: true },
  { key: 'action', label: 'Action', filterable: true },
  { key: 'employee', label: 'Employee', filterable: true },
  { key: 'vehicle', label: 'Vehicle', filterable: true },
  { key: 'date', label: 'Date', filterable: true },
  { key: 'time', label: 'Time', filterable: false },
];

// Helper functions
const formatCurrency = (value: any): string => {
  if (value == null) return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

const formatBoolean = (value: any): string => {
  if (value == null) return 'N/A';
  return value ? 'Yes' : 'No';
};

const formatDateTime = (value: any): string => {
  if (!value) return 'N/A';
  try {
    return format(new Date(value), 'MMM d, yyyy h:mm a');
  } catch {
    return 'Invalid Date';
  }
};

const formatDate = (value: any): string => {
  if (!value) return 'N/A';
  try {
    return format(new Date(value), 'MMM d, yyyy');
  } catch {
    return 'Invalid Date';
  }
};

// Column Filter Dropdown Component
function ColumnFilterDropdown({
  label,
  uniqueValues,
  selectedValues,
  onSelectionChange,
}: {
  label: string;
  uniqueValues: string[];
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
}) {
  const isFiltered = selectedValues.length > 0;

  const handleToggle = (value: string) => {
    if (selectedValues.includes(value)) {
      onSelectionChange(selectedValues.filter((v) => v !== value));
    } else {
      onSelectionChange([...selectedValues, value]);
    }
  };

  const handleSelectAll = () => {
    onSelectionChange([]);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-6 w-6 p-0', isFiltered && 'text-primary')}
        >
          <Filter className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0 bg-popover border" align="start">
        <div className="p-2 border-b">
          <p className="text-sm font-medium">Filter {label}</p>
        </div>
        <div className="p-2 border-b">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs"
            onClick={handleSelectAll}
          >
            {selectedValues.length === 0 ? 'All Selected' : 'Clear Filter'}
          </Button>
        </div>
        <ScrollArea className="h-[200px]">
          <div className="p-2 space-y-1">
            {uniqueValues.map((value) => (
              <div
                key={value}
                className="flex items-center space-x-2 p-1 hover:bg-muted rounded cursor-pointer"
                onClick={() => handleToggle(value)}
              >
                <Checkbox
                  checked={selectedValues.length === 0 || selectedValues.includes(value)}
                  className="pointer-events-none"
                />
                <span className="text-sm truncate">{value || '(Empty)'}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export function AuditLogTable() {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [vehicleMap, setVehicleMap] = useState<Map<string, string>>(new Map());
  const [locationMap, setLocationMap] = useState<Map<string, string>>(new Map());
  const [clientMap, setClientMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Date range state
  const [dateMode, setDateMode] = useState<'month' | 'custom'>('month');
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState<Record<AuditColumnKey, boolean>>({
    table: true,
    action: true,
    employee: true,
    vehicle: true,
    date: true,
    time: true,
  });

  // Per-column text search
  const [columnSearches, setColumnSearches] = useState<Record<AuditColumnKey, string>>({
    table: '',
    action: '',
    employee: '',
    vehicle: '',
    date: '',
    time: '',
  });

  // Per-column dropdown filters
  const [columnFilters, setColumnFilters] = useState<Record<AuditColumnKey, string[]>>({
    table: [],
    action: [],
    employee: [],
    vehicle: [],
    date: [],
    time: [],
  });

  // Row selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Validate custom date range
  const isCustomRangeValid = useMemo(() => {
    if (dateMode !== 'custom') return true;
    if (!customStartDate || !customEndDate) return false;
    if (customEndDate < customStartDate) return false;
    if (differenceInDays(customEndDate, customStartDate) > 365) return false;
    return true;
  }, [dateMode, customStartDate, customEndDate]);

  const dateRangeError = useMemo(() => {
    if (dateMode !== 'custom') return null;
    if (!customStartDate || !customEndDate) return 'Select both start and end dates';
    if (customEndDate < customStartDate) return 'End date must be after start date';
    if (differenceInDays(customEndDate, customStartDate) > 365) return 'Maximum range is 365 days';
    return null;
  }, [dateMode, customStartDate, customEndDate]);

  useEffect(() => {
    if (dateMode === 'month' || (dateMode === 'custom' && isCustomRangeValid && customStartDate && customEndDate)) {
      fetchAuditLogs();
    }
  }, [selectedMonth, dateMode, customStartDate, customEndDate]);

  // Handle switching to custom mode - pre-populate with current month
  const handleDateModeChange = (mode: string) => {
    if (mode === 'custom' && !customStartDate && !customEndDate) {
      setCustomStartDate(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1));
      setCustomEndDate(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0));
    }
    setDateMode(mode as 'month' | 'custom');
  };

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      let startDate: Date;
      let endDate: Date;

      if (dateMode === 'month') {
        startDate = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
        endDate = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0, 23, 59, 59);
      } else {
        startDate = customStartDate!;
        endDate = new Date(customEndDate!);
        endDate.setHours(23, 59, 59);
      }

      const { data, error } = await supabase
        .from('audit_log')
        .select('*, changed_by_user:users!changed_by(id, name, employee_id)')
        .eq('table_name', 'wash_entries')
        .gte('changed_at', startDate.toISOString())
        .lte('changed_at', endDate.toISOString())
        .order('changed_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      setAuditLogs(data as AuditLogEntry[] || []);

      // Fetch related data (vehicles, locations, clients)
      if (data && data.length > 0) {
        const vehicleIds = new Set<string>();
        const locationIds = new Set<string>();
        const clientIds = new Set<string>();

        data.forEach((entry) => {
          const entryData = entry.action === 'DELETE' ? entry.old_data : entry.new_data;
          if (entryData && typeof entryData === 'object' && !Array.isArray(entryData)) {
            if ((entryData as any).vehicle_id) vehicleIds.add((entryData as any).vehicle_id);
            if ((entryData as any).actual_location_id) locationIds.add((entryData as any).actual_location_id);
            if ((entryData as any).client_id) clientIds.add((entryData as any).client_id);
          }
        });

        // Fetch vehicles
        if (vehicleIds.size > 0) {
          const { data: vehicles } = await supabase
            .from('vehicles')
            .select('id, vehicle_number')
            .in('id', Array.from(vehicleIds));

          if (vehicles) {
            setVehicleMap(new Map(vehicles.map((v) => [v.id, v.vehicle_number])));
          }
        }

        // Fetch locations
        if (locationIds.size > 0) {
          const { data: locations } = await supabase
            .from('locations')
            .select('id, name')
            .in('id', Array.from(locationIds));

          if (locations) {
            setLocationMap(new Map(locations.map((l) => [l.id, l.name])));
          }
        }

        // Fetch clients
        if (clientIds.size > 0) {
          const { data: clients } = await supabase
            .from('clients')
            .select('id, client_name')
            .in('id', Array.from(clientIds));

          if (clients) {
            setClientMap(new Map(clients.map((c) => [c.id, c.client_name])));
          }
        }
      }

      // Clear selection when data changes
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  // Get column value for filtering
  const getColumnValue = (entry: AuditLogEntry, key: AuditColumnKey): string => {
    const data = entry.action === 'DELETE' ? entry.old_data : entry.new_data;
    const vehicleId = (data as any)?.vehicle_id;

    switch (key) {
      case 'table':
        return entry.table_name === 'wash_entries' ? 'Wash Entries' : entry.table_name;
      case 'action':
        return entry.action;
      case 'employee':
        return entry.changed_by_user?.name || 'Unknown';
      case 'vehicle':
        return vehicleId ? vehicleMap.get(vehicleId) || 'Unknown' : 'N/A';
      case 'date':
        return format(new Date(entry.changed_at), 'MMM d, yyyy');
      case 'time':
        return format(new Date(entry.changed_at), 'h:mm a');
      default:
        return '';
    }
  };

  // Get unique values for each column
  const uniqueValues = useMemo(() => {
    const values: Record<AuditColumnKey, string[]> = {
      table: [],
      action: [],
      employee: [],
      vehicle: [],
      date: [],
      time: [],
    };

    auditLogs.forEach((entry) => {
      AUDIT_COLUMN_CONFIG.forEach(({ key }) => {
        const value = getColumnValue(entry, key);
        if (value && !values[key].includes(value)) {
          values[key].push(value);
        }
      });
    });

    // Sort each array
    Object.keys(values).forEach((key) => {
      values[key as AuditColumnKey].sort();
    });

    return values;
  }, [auditLogs, vehicleMap]);

  // Filter entries based on all filters
  const filteredEntries = useMemo(() => {
    return auditLogs.filter((entry) => {
      return AUDIT_COLUMN_CONFIG.every(({ key }) => {
        const value = getColumnValue(entry, key).toLowerCase();
        const searchTerm = columnSearches[key].toLowerCase();
        const filterValues = columnFilters[key];

        // Check text search
        if (searchTerm && !value.includes(searchTerm)) {
          return false;
        }

        // Check dropdown filter
        if (filterValues.length > 0 && !filterValues.includes(getColumnValue(entry, key))) {
          return false;
        }

        return true;
      });
    });
  }, [auditLogs, columnSearches, columnFilters, vehicleMap]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    Object.values(columnSearches).forEach((v) => {
      if (v) count++;
    });
    Object.values(columnFilters).forEach((v) => {
      if (v.length > 0) count++;
    });
    return count;
  }, [columnSearches, columnFilters]);

  const clearAllFilters = () => {
    setColumnSearches({
      table: '',
      action: '',
      employee: '',
      vehicle: '',
      date: '',
      time: '',
    });
    setColumnFilters({
      table: [],
      action: [],
      employee: [],
      vehicle: [],
      date: [],
      time: [],
    });
  };

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredEntries.map(e => e.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const isAllSelected = filteredEntries.length > 0 && filteredEntries.every(e => selectedIds.has(e.id));
  const isSomeSelected = filteredEntries.some(e => selectedIds.has(e.id)) && !isAllSelected;

  // Export functionality
  const handleExport = (entriesToExport: AuditLogEntry[]) => {
    const exportData = entriesToExport.map(entry => {
      const data = entry.action === 'DELETE' ? entry.old_data : entry.new_data;
      const vehicleId = (data as any)?.vehicle_id;
      
      return {
        'Table': entry.table_name === 'wash_entries' ? 'Wash Entries' : entry.table_name,
        'Action': entry.action,
        'Employee Name': entry.changed_by_user?.name || 'Unknown',
        'Employee ID': entry.changed_by_user?.employee_id || 'N/A',
        'Vehicle': vehicleId ? vehicleMap.get(vehicleId) || 'Unknown' : 'N/A',
        'Date': format(new Date(entry.changed_at), 'yyyy-MM-dd'),
        'Time': format(new Date(entry.changed_at), 'h:mm a'),
        'Wash Date': data?.wash_date || 'N/A',
        'Location': data?.actual_location_id ? locationMap.get(data.actual_location_id) || 'N/A' : 'N/A',
        'Client': data?.client_id ? clientMap.get(data.client_id) || 'N/A' : 'N/A',
      };
    });

    exportToExcel(exportData, `audit_log_${format(new Date(), 'yyyy-MM-dd')}`, 'Audit Log');

    toast({
      title: 'Export Complete',
      description: `Exported ${entriesToExport.length} entries`,
    });
  };

  const handleExportSelected = () => {
    const selected = filteredEntries.filter(e => selectedIds.has(e.id));
    handleExport(selected);
  };

  const handleExportAll = () => {
    handleExport(filteredEntries);
  };

  // Date range display
  const dateRangeDisplay = useMemo(() => {
    if (dateMode === 'month') {
      return format(selectedMonth, 'MMMM yyyy');
    }
    if (customStartDate && customEndDate) {
      return `${format(customStartDate, 'MMM d, yyyy')} - ${format(customEndDate, 'MMM d, yyyy')}`;
    }
    return 'Select date range';
  }, [dateMode, selectedMonth, customStartDate, customEndDate]);

  const getTableBadge = (tableName: string) => {
    const nameMap: Record<string, string> = {
      wash_entries: 'Wash Entries',
      vehicles: 'Vehicles',
      users: 'Users',
      locations: 'Locations',
    };
    return (
      <Badge variant="outline" className="font-normal">
        {nameMap[tableName] || tableName}
      </Badge>
    );
  };

  const getActionBadge = (action: string) => {
    const variants = {
      INSERT: { variant: 'default' as const, label: 'NEW', className: 'bg-green-600 hover:bg-green-700' },
      UPDATE: { variant: 'default' as const, label: 'EDIT', className: 'bg-yellow-600 hover:bg-yellow-700' },
      DELETE: { variant: 'destructive' as const, label: 'DEL', className: '' },
    };
    const config = variants[action as keyof typeof variants];
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const getChangedFields = (oldData: any, newData: any) => {
    const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];
    const allKeys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);

    allKeys.forEach((key) => {
      const oldVal = oldData?.[key];
      const newVal = newData?.[key];
      
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push({ field: key, oldValue: oldVal, newValue: newVal });
      }
    });

    return changes;
  };

  const formatFieldValue = (field: string, value: any): string => {
    if (value == null || value === '') return 'N/A';

    if (field.includes('amount') || field.includes('rate') || field.includes('cost') || field.includes('price')) {
      return formatCurrency(value);
    }

    if (typeof value === 'boolean') {
      return formatBoolean(value);
    }

    if (field.includes('_at') && typeof value === 'string') {
      return formatDateTime(value);
    }
    if (field === 'wash_date' || field.includes('_date')) {
      return formatDate(value);
    }

    if (field === 'vehicle_id') {
      return vehicleMap.get(value) || value;
    }
    if (field === 'actual_location_id') {
      return locationMap.get(value) || value;
    }
    if (field === 'client_id') {
      return clientMap.get(value) || value;
    }

    return String(value);
  };

  const formatFieldName = (field: string): string => {
    return field
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const renderDataComparison = (entry: AuditLogEntry) => {
    const data = entry.action === 'DELETE' ? entry.old_data : entry.new_data;

    if (entry.action === 'UPDATE') {
      const changes = getChangedFields(entry.old_data, entry.new_data);

      return (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-3">Overview</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Wash Date:</span>{' '}
                <span className="font-medium">{formatDate(data?.wash_date)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Vehicle:</span>{' '}
                <span className="font-medium">{vehicleMap.get(data?.vehicle_id) || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Location:</span>{' '}
                <span className="font-medium">{locationMap.get(data?.actual_location_id) || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Client:</span>{' '}
                <span className="font-medium">{clientMap.get(data?.client_id) || 'N/A'}</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-3">Changes Made ({changes.length})</h4>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Field</TableHead>
                    <TableHead>Old Value</TableHead>
                    <TableHead>New Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {changes.map((change, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{formatFieldName(change.field)}</TableCell>
                      <TableCell className="text-destructive">{formatFieldValue(change.field, change.oldValue)}</TableCell>
                      <TableCell className="text-green-600">{formatFieldValue(change.field, change.newValue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {(data?.comment || data?.employee_notes) && (
            <div>
              <h4 className="font-semibold mb-2">Notes</h4>
              <Card>
                <CardContent className="pt-4">
                  {data?.comment && (
                    <div className="mb-2">
                      <span className="text-sm text-muted-foreground">Comment:</span>{' '}
                      <span className="text-sm">{data.comment}</span>
                    </div>
                  )}
                  {data?.employee_notes && (
                    <div>
                      <span className="text-sm text-muted-foreground">Employee Notes:</span>{' '}
                      <span className="text-sm">{data.employee_notes}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      );
    } else if (entry.action === 'DELETE') {
      return (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-3">Deleted Entry Details</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Wash Date:</span>{' '}
                <span className="font-medium">{formatDate(data?.wash_date)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Vehicle:</span>{' '}
                <span className="font-medium">{vehicleMap.get(data?.vehicle_id) || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Location:</span>{' '}
                <span className="font-medium">{locationMap.get(data?.actual_location_id) || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Client:</span>{' '}
                <span className="font-medium">{clientMap.get(data?.client_id) || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Time Started:</span>{' '}
                <span className="font-medium">{formatDateTime(data?.time_started)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Time Completed:</span>{' '}
                <span className="font-medium">{formatDateTime(data?.time_completed)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Final Amount:</span>{' '}
                <span className="font-medium">{formatCurrency(data?.final_amount)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Damage Reported:</span>{' '}
                <span className="font-medium">{formatBoolean(data?.damage_reported)}</span>
              </div>
            </div>
          </div>

          {(data?.comment || data?.employee_notes || data?.deletion_reason) && (
            <div>
              <h4 className="font-semibold mb-2">Notes</h4>
              <Card>
                <CardContent className="pt-4 space-y-2">
                  {data?.comment && (
                    <div>
                      <span className="text-sm text-muted-foreground">Comment:</span>{' '}
                      <span className="text-sm">{data.comment}</span>
                    </div>
                  )}
                  {data?.employee_notes && (
                    <div>
                      <span className="text-sm text-muted-foreground">Employee Notes:</span>{' '}
                      <span className="text-sm">{data.employee_notes}</span>
                    </div>
                  )}
                  {data?.deletion_reason && (
                    <div>
                      <span className="text-sm text-muted-foreground">Deletion Reason:</span>{' '}
                      <span className="text-sm">{data.deletion_reason}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      );
    } else {
      // INSERT
      return (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-3">New Entry Details</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Wash Date:</span>{' '}
                <span className="font-medium">{formatDate(data?.wash_date)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Vehicle:</span>{' '}
                <span className="font-medium">{vehicleMap.get(data?.vehicle_id) || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Location:</span>{' '}
                <span className="font-medium">{locationMap.get(data?.actual_location_id) || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Client:</span>{' '}
                <span className="font-medium">{clientMap.get(data?.client_id) || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Time Started:</span>{' '}
                <span className="font-medium">{formatDateTime(data?.time_started)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Time Completed:</span>{' '}
                <span className="font-medium">{formatDateTime(data?.time_completed)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Final Amount:</span>{' '}
                <span className="font-medium">{formatCurrency(data?.final_amount)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Requires Approval:</span>{' '}
                <span className="font-medium">{formatBoolean(data?.requires_approval)}</span>
              </div>
            </div>
          </div>

          {(data?.comment || data?.employee_notes) && (
            <div>
              <h4 className="font-semibold mb-2">Notes</h4>
              <Card>
                <CardContent className="pt-4 space-y-2">
                  {data?.comment && (
                    <div>
                      <span className="text-sm text-muted-foreground">Comment:</span>{' '}
                      <span className="text-sm">{data.comment}</span>
                    </div>
                  )}
                  {data?.employee_notes && (
                    <div>
                      <span className="text-sm text-muted-foreground">Employee Notes:</span>{' '}
                      <span className="text-sm">{data.employee_notes}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      );
    }
  };

  const visibleColumnCount = Object.values(visibleColumns).filter(Boolean).length;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Audit Log</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Audit Log</CardTitle>
            <CardDescription>
              {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'} • {dateRangeDisplay}
            </CardDescription>
          </div>

          {/* Selection toolbar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
              <span className="text-sm font-medium">{selectedIds.size} selected</span>
              <Button variant="outline" size="sm" onClick={handleExportSelected}>
                <Download className="h-4 w-4 mr-1" />
                Export Selected
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* Date range controls */}
          <div className="flex items-center gap-2">
            <Tabs value={dateMode} onValueChange={handleDateModeChange}>
              <TabsList>
                <TabsTrigger value="month">Month</TabsTrigger>
                <TabsTrigger value="custom">Custom Range</TabsTrigger>
              </TabsList>
            </Tabs>

            {dateMode === 'month' ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[180px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(selectedMonth, 'MMMM yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedMonth}
                    onSelect={(date) => date && setSelectedMonth(date)}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            ) : (
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-[130px] justify-start text-left font-normal", !customStartDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customStartDate ? format(customStartDate, 'MMM d, yyyy') : 'Start'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                    <Calendar
                      mode="single"
                      selected={customStartDate}
                      onSelect={setCustomStartDate}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-[130px] justify-start text-left font-normal", !customEndDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customEndDate ? format(customEndDate, 'MMM d, yyyy') : 'End'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                    <Calendar
                      mode="single"
                      selected={customEndDate}
                      onSelect={setCustomEndDate}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Columns3 className="h-4 w-4 mr-1" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {AUDIT_COLUMN_CONFIG.map(({ key, label }) => (
                  <DropdownMenuCheckboxItem
                    key={key}
                    checked={visibleColumns[key]}
                    onCheckedChange={(checked) =>
                      setVisibleColumns((prev) => ({ ...prev, [key]: checked }))
                    }
                  >
                    {label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {activeFilterCount > 0 && (
              <Button variant="outline" size="sm" onClick={clearAllFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear Filters
                <Badge variant="secondary" className="ml-1">{activeFilterCount}</Badge>
              </Button>
            )}

            <Button variant="outline" size="sm" onClick={handleExportAll}>
              <Download className="h-4 w-4 mr-1" />
              Export All
            </Button>
          </div>
        </div>

        {dateRangeError && (
          <div className="text-sm text-destructive">{dateRangeError}</div>
        )}

        {filteredEntries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No audit entries found</div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="table-fixed">
                <TableHeader>
                  {/* Header row */}
                  <TableRow className="bg-muted/50">
                    <TableHead style={{ width: '48px', minWidth: '48px' }}>
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={(checked) => handleSelectAll(!!checked)}
                        aria-label="Select all"
                        className={cn(isSomeSelected && "data-[state=checked]:bg-primary/50")}
                        ref={(el) => {
                          if (el) {
                            (el as any).indeterminate = isSomeSelected;
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead style={{ width: '40px', minWidth: '40px' }}></TableHead>
                    {visibleColumns.table && (
                      <TableHead style={{ width: '120px', minWidth: '120px' }}>
                        <div className="flex items-center gap-1">
                          Table
                          <ColumnFilterDropdown
                            label="Table"
                            uniqueValues={uniqueValues.table}
                            selectedValues={columnFilters.table}
                            onSelectionChange={(values) => setColumnFilters(prev => ({ ...prev, table: values }))}
                          />
                        </div>
                      </TableHead>
                    )}
                    {visibleColumns.action && (
                      <TableHead style={{ width: '90px', minWidth: '90px' }}>
                        <div className="flex items-center gap-1">
                          Action
                          <ColumnFilterDropdown
                            label="Action"
                            uniqueValues={uniqueValues.action}
                            selectedValues={columnFilters.action}
                            onSelectionChange={(values) => setColumnFilters(prev => ({ ...prev, action: values }))}
                          />
                        </div>
                      </TableHead>
                    )}
                    {visibleColumns.employee && (
                      <TableHead style={{ width: '180px', minWidth: '180px' }}>
                        <div className="flex items-center gap-1">
                          Employee
                          <ColumnFilterDropdown
                            label="Employee"
                            uniqueValues={uniqueValues.employee}
                            selectedValues={columnFilters.employee}
                            onSelectionChange={(values) => setColumnFilters(prev => ({ ...prev, employee: values }))}
                          />
                        </div>
                      </TableHead>
                    )}
                    {visibleColumns.vehicle && (
                      <TableHead style={{ width: '120px', minWidth: '120px' }}>
                        <div className="flex items-center gap-1">
                          Vehicle
                          <ColumnFilterDropdown
                            label="Vehicle"
                            uniqueValues={uniqueValues.vehicle}
                            selectedValues={columnFilters.vehicle}
                            onSelectionChange={(values) => setColumnFilters(prev => ({ ...prev, vehicle: values }))}
                          />
                        </div>
                      </TableHead>
                    )}
                    {visibleColumns.date && (
                      <TableHead style={{ width: '100px', minWidth: '100px' }}>
                        <div className="flex items-center gap-1">
                          Date
                          <ColumnFilterDropdown
                            label="Date"
                            uniqueValues={uniqueValues.date}
                            selectedValues={columnFilters.date}
                            onSelectionChange={(values) => setColumnFilters(prev => ({ ...prev, date: values }))}
                          />
                        </div>
                      </TableHead>
                    )}
                    {visibleColumns.time && (
                      <TableHead style={{ width: '100px', minWidth: '100px' }}>Time</TableHead>
                    )}
                  </TableRow>

                  {/* Search row */}
                  <TableRow>
                    <TableHead style={{ width: '48px', minWidth: '48px' }}></TableHead>
                    <TableHead style={{ width: '40px', minWidth: '40px' }}></TableHead>
                    {visibleColumns.table && (
                      <TableHead style={{ width: '120px', minWidth: '120px' }}>
                        <Input
                          placeholder="Search..."
                          value={columnSearches.table}
                          onChange={(e) => setColumnSearches(prev => ({ ...prev, table: e.target.value }))}
                          className="h-7 text-xs"
                        />
                      </TableHead>
                    )}
                    {visibleColumns.action && (
                      <TableHead style={{ width: '90px', minWidth: '90px' }}>
                        <Input
                          placeholder="Search..."
                          value={columnSearches.action}
                          onChange={(e) => setColumnSearches(prev => ({ ...prev, action: e.target.value }))}
                          className="h-7 text-xs"
                        />
                      </TableHead>
                    )}
                    {visibleColumns.employee && (
                      <TableHead style={{ width: '180px', minWidth: '180px' }}>
                        <Input
                          placeholder="Search..."
                          value={columnSearches.employee}
                          onChange={(e) => setColumnSearches(prev => ({ ...prev, employee: e.target.value }))}
                          className="h-7 text-xs"
                        />
                      </TableHead>
                    )}
                    {visibleColumns.vehicle && (
                      <TableHead style={{ width: '120px', minWidth: '120px' }}>
                        <Input
                          placeholder="Search..."
                          value={columnSearches.vehicle}
                          onChange={(e) => setColumnSearches(prev => ({ ...prev, vehicle: e.target.value }))}
                          className="h-7 text-xs"
                        />
                      </TableHead>
                    )}
                    {visibleColumns.date && (
                      <TableHead style={{ width: '100px', minWidth: '100px' }}>
                        <Input
                          placeholder="Search..."
                          value={columnSearches.date}
                          onChange={(e) => setColumnSearches(prev => ({ ...prev, date: e.target.value }))}
                          className="h-7 text-xs"
                        />
                      </TableHead>
                    )}
                    {visibleColumns.time && (
                      <TableHead style={{ width: '100px', minWidth: '100px' }}>
                        <Input
                          placeholder="Search..."
                          value={columnSearches.time}
                          onChange={(e) => setColumnSearches(prev => ({ ...prev, time: e.target.value }))}
                          className="h-7 text-xs"
                        />
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((entry) => (
                    <Collapsible key={entry.id} open={expandedRows.has(entry.id)} asChild>
                      <>
                        <TableRow className="cursor-pointer hover:bg-muted/50">
                          <TableCell style={{ width: '48px', minWidth: '48px' }} className="py-4" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.has(entry.id)}
                              onCheckedChange={(checked) => handleSelectRow(entry.id, !!checked)}
                              aria-label={`Select row ${entry.id}`}
                            />
                          </TableCell>
                          <CollapsibleTrigger asChild>
                            <TableCell style={{ width: '40px', minWidth: '40px' }} className="py-4" onClick={() => toggleRow(entry.id)}>
                              {expandedRows.has(entry.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </TableCell>
                          </CollapsibleTrigger>
                          {visibleColumns.table && (
                            <TableCell style={{ width: '120px', minWidth: '120px' }} className="py-4" onClick={() => toggleRow(entry.id)}>
                              {getTableBadge(entry.table_name)}
                            </TableCell>
                          )}
                          {visibleColumns.action && (
                            <TableCell style={{ width: '90px', minWidth: '90px' }} className="py-4" onClick={() => toggleRow(entry.id)}>
                              {getActionBadge(entry.action)}
                            </TableCell>
                          )}
                          {visibleColumns.employee && (
                            <TableCell style={{ width: '180px', minWidth: '180px' }} className="py-4" onClick={() => toggleRow(entry.id)}>
                              {entry.changed_by_user?.name || 'Unknown'} ({entry.changed_by_user?.employee_id || 'N/A'})
                            </TableCell>
                          )}
                          {visibleColumns.vehicle && (
                            <TableCell style={{ width: '120px', minWidth: '120px' }} className="py-4" onClick={() => toggleRow(entry.id)}>
                              {getColumnValue(entry, 'vehicle')}
                            </TableCell>
                          )}
                          {visibleColumns.date && (
                            <TableCell style={{ width: '100px', minWidth: '100px' }} className="py-4" onClick={() => toggleRow(entry.id)}>
                              {format(new Date(entry.changed_at), 'MMM d')}
                            </TableCell>
                          )}
                          {visibleColumns.time && (
                            <TableCell style={{ width: '100px', minWidth: '100px' }} className="py-4" onClick={() => toggleRow(entry.id)}>
                              {format(new Date(entry.changed_at), 'h:mm a')}
                            </TableCell>
                          )}
                        </TableRow>
                        <CollapsibleContent asChild>
                          <TableRow>
                            <TableCell colSpan={visibleColumnCount + 2} className="bg-muted/30 p-6">
                              {renderDataComparison(entry)}
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <div className="text-sm text-muted-foreground">
          Showing {filteredEntries.length} of {auditLogs.length} entries (max 1000 per date range)
        </div>
      </CardContent>
    </Card>
  );
}
