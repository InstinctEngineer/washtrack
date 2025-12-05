import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format, differenceInDays, startOfWeek, endOfWeek } from 'date-fns';
import { CalendarIcon, Trash2, Plus, Filter, X, Columns3, ChevronDown, ArrowRight, RotateCcw, Download, Pencil, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VehicleSearchInput } from './VehicleSearchInput';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
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
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { exportToExcel } from '@/lib/excelExporter';

interface WashEntry {
  id: string;
  wash_date: string;
  vehicle_id: string;
  actual_location_id: string;
  employee_id: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  deletion_reason?: string | null;
  comment?: string | null;
  rate_override?: number | null;
  vehicle?: {
    vehicle_number: string;
    vehicle_type?: {
      type_name: string;
      rate_per_wash: number;
    };
    client?: {
      client_name: string;
    };
  };
  location?: {
    name: string;
  };
  employee?: {
    name: string;
  };
}

interface Location {
  id: string;
  name: string;
}

type ColumnKey = 'date' | 'vehicle' | 'client' | 'type' | 'rate' | 'location' | 'employee' | 'comment';

const COLUMN_CONFIG: { key: ColumnKey; label: string; filterable: boolean; editable?: boolean }[] = [
  { key: 'date', label: 'Date', filterable: true, editable: true },
  { key: 'vehicle', label: 'Vehicle', filterable: true },
  { key: 'client', label: 'Client', filterable: true },
  { key: 'type', label: 'Type', filterable: true },
  { key: 'rate', label: 'Rate', filterable: true, editable: true },
  { key: 'location', label: 'Location', filterable: true, editable: true },
  { key: 'employee', label: 'Employee', filterable: true },
  { key: 'comment', label: 'Comment', filterable: true, editable: true },
];

// Helper to get column value from entry
const getColumnValue = (entry: WashEntry, key: ColumnKey): string => {
  switch (key) {
    case 'date':
      return format(new Date(entry.wash_date), 'MMM d, yyyy');
    case 'vehicle':
      return entry.vehicle?.vehicle_number || '';
    case 'client':
      return entry.vehicle?.client?.client_name || '';
    case 'type':
      return entry.vehicle?.vehicle_type?.type_name || '';
    case 'rate':
      // Show rate_override if set, otherwise vehicle type rate
      if (entry.rate_override != null) {
        return entry.rate_override.toFixed(2);
      }
      return entry.vehicle?.vehicle_type?.rate_per_wash?.toFixed(2) || '0.00';
    case 'location':
      return entry.location?.name || '';
    case 'employee':
      return entry.employee?.name || '';
    case 'comment':
      return entry.comment || '';
    default:
      return '';
  }
};

// Column Filter Dropdown Component
function ColumnFilterDropdown({
  columnKey,
  label,
  uniqueValues,
  selectedValues,
  onSelectionChange,
}: {
  columnKey: ColumnKey;
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

// Editable Location Cell Component with Dropdown
function EditableLocationCell({
  value,
  entryId,
  locationId,
  locations,
  isEditing,
  onStartEdit,
  onSave,
  onCancel,
  isDeleted,
}: {
  value: string;
  entryId: string;
  locationId: string;
  locations: Location[];
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (locationId: string) => void;
  onCancel: () => void;
  isDeleted?: boolean;
}) {
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (isEditing && selectRef.current) {
      selectRef.current.focus();
    }
  }, [isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onSave(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  if (isEditing) {
    return (
      <select
        ref={selectRef}
        value={locationId}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={onCancel}
        className="h-7 text-xs w-full min-w-[120px] rounded border border-input bg-background px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {locations.map((loc) => (
          <option key={loc.id} value={loc.id}>
            {loc.name}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div
      className={cn(
        'group cursor-pointer rounded px-1 py-0.5 -mx-1 transition-colors',
        !isDeleted && 'hover:bg-muted',
        isDeleted && 'line-through'
      )}
      onDoubleClick={isDeleted ? undefined : onStartEdit}
      title={isDeleted ? undefined : 'Double-click to edit'}
    >
      <span className="flex items-center gap-1">
        {value || <span className="text-muted-foreground italic">N/A</span>}
        {!isDeleted && (
          <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
        )}
      </span>
    </div>
  );
}

// Editable Cell Component
function EditableCell({
  value,
  entryId,
  field,
  isEditing,
  onStartEdit,
  onSave,
  onCancel,
  type = 'text',
  isDeleted,
}: {
  value: string;
  entryId: string;
  field: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (value: string) => void;
  onCancel: () => void;
  type?: 'text' | 'number' | 'date';
  isDeleted?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [editValue, setEditValue] = useState(value);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSave(editValue);
    } else if (e.key === 'Escape') {
      setEditValue(value);
      onCancel();
    }
  };

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          onSave(editValue);
        }}
        type={type === 'number' ? 'number' : 'text'}
        step={type === 'number' ? '0.01' : undefined}
        className="h-7 text-xs w-full min-w-[80px]"
      />
    );
  }

  return (
    <div
      className={cn(
        'group cursor-pointer rounded px-1 py-0.5 -mx-1 transition-colors',
        !isDeleted && 'hover:bg-muted',
        isDeleted && 'line-through'
      )}
      onDoubleClick={isDeleted ? undefined : onStartEdit}
      title={isDeleted ? undefined : 'Double-click to edit'}
    >
      <span className="flex items-center gap-1">
        {value || <span className="text-muted-foreground italic">Empty</span>}
        {!isDeleted && (
          <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
        )}
      </span>
    </div>
  );
}

export function WashEntryTableEditor({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<WashEntry[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [newEntry, setNewEntry] = useState({
    wash_date: new Date(),
    vehicle_id: '',
    actual_location_id: '',
  });
  const [showAddForm, setShowAddForm] = useState(false);

  // Date range mode state
  const [dateMode, setDateMode] = useState<'week' | 'month' | 'custom'>('week');
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);

  // Inline editing state
  const [editingCell, setEditingCell] = useState<{ id: string; field: ColumnKey } | null>(null);

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>({
    date: true,
    vehicle: true,
    client: true,
    type: true,
    rate: true,
    location: true,
    employee: true,
    comment: true,
  });

  // Per-column text search
  const [columnSearches, setColumnSearches] = useState<Record<ColumnKey, string>>({
    date: '',
    vehicle: '',
    client: '',
    type: '',
    rate: '',
    location: '',
    employee: '',
    comment: '',
  });

  // Per-column dropdown filters (selected values)
  const [columnFilters, setColumnFilters] = useState<Record<ColumnKey, string[]>>({
    date: [],
    vehicle: [],
    client: [],
    type: [],
    rate: [],
    location: [],
    employee: [],
    comment: [],
  });

  // Row selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Status filter: 'active' | 'deleted' | 'all'
  const [statusFilter, setStatusFilter] = useState<'active' | 'deleted' | 'all'>('active');

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entriesToDelete, setEntriesToDelete] = useState<WashEntry[]>([]);

  // Sorting state
  const [sortColumn, setSortColumn] = useState<ColumnKey>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

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
    if (dateMode === 'week' || dateMode === 'month' || (dateMode === 'custom' && isCustomRangeValid && customStartDate && customEndDate)) {
      fetchData();
    }
  }, [selectedMonth, selectedWeek, dateMode, customStartDate, customEndDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let startDate: Date;
      let endDate: Date;

      if (dateMode === 'week') {
        startDate = startOfWeek(selectedWeek, { weekStartsOn: 0 });
        endDate = endOfWeek(selectedWeek, { weekStartsOn: 0 });
      } else if (dateMode === 'month') {
        startDate = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
        endDate = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0);
      } else {
        startDate = customStartDate!;
        endDate = customEndDate!;
      }

      // Always fetch all entries (status filter applied client-side)
      const { data: entriesData, error: entriesError } = await supabase
        .from('wash_entries')
        .select(`
          *,
          vehicle:vehicles(vehicle_number, vehicle_type:vehicle_types(type_name, rate_per_wash), client:clients(client_name)),
          location:locations!wash_entries_actual_location_id_fkey(name),
          employee:users!wash_entries_employee_id_fkey(name)
        `)
        .gte('wash_date', startDate.toISOString().split('T')[0])
        .lte('wash_date', endDate.toISOString().split('T')[0])
        .order('wash_date', { ascending: false });

      if (entriesError) throw entriesError;

      const { data: locationsData, error: locationsError } = await supabase
        .from('locations')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (locationsError) throw locationsError;

      setEntries(entriesData || []);
      setLocations(locationsData || []);
      // Clear selection when data changes
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load wash entries',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Get display text for the current date range
  const dateRangeDisplay = useMemo(() => {
    if (dateMode === 'week') {
      const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 0 });
      return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
    }
    if (dateMode === 'month') {
      return format(selectedMonth, 'MMMM yyyy');
    }
    if (customStartDate && customEndDate) {
      return `${format(customStartDate, 'MMM d, yyyy')} - ${format(customEndDate, 'MMM d, yyyy')}`;
    }
    return 'Select date range';
  }, [dateMode, selectedMonth, selectedWeek, customStartDate, customEndDate]);

  // Handle switching date modes - pre-populate custom range
  const handleDateModeChange = (mode: string) => {
    if (mode === 'custom' && !customStartDate && !customEndDate) {
      if (dateMode === 'week') {
        setCustomStartDate(startOfWeek(selectedWeek, { weekStartsOn: 0 }));
        setCustomEndDate(endOfWeek(selectedWeek, { weekStartsOn: 0 }));
      } else {
        setCustomStartDate(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1));
        setCustomEndDate(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0));
      }
    }
    setDateMode(mode as 'week' | 'month' | 'custom');
  };

  // Get unique values for each column
  const uniqueValues = useMemo(() => {
    const values: Record<ColumnKey, string[]> = {
      date: [],
      vehicle: [],
      client: [],
      type: [],
      rate: [],
      location: [],
      employee: [],
      comment: [],
    };

    entries.forEach((entry) => {
      COLUMN_CONFIG.forEach(({ key }) => {
        const value = getColumnValue(entry, key);
        if (value && !values[key].includes(value)) {
          values[key].push(value);
        }
      });
    });

    // Sort each array
    Object.keys(values).forEach((key) => {
      values[key as ColumnKey].sort();
    });

    return values;
  }, [entries]);

  // Filter entries based on all filters and status
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      // Apply status filter first
      const isDeleted = !!entry.deleted_at;
      if (statusFilter === 'active' && isDeleted) return false;
      if (statusFilter === 'deleted' && !isDeleted) return false;
      // 'all' shows everything

      // Apply column filters
      return COLUMN_CONFIG.every(({ key }) => {
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
  }, [entries, columnSearches, columnFilters, statusFilter]);

  // Separate active and deleted entries (for selection logic)
  const activeEntries = useMemo(() => filteredEntries.filter(e => !e.deleted_at), [filteredEntries]);
  const deletedEntries = useMemo(() => filteredEntries.filter(e => e.deleted_at), [filteredEntries]);

  // Sorting handlers
  const handleSort = (column: ColumnKey) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Sort entries
  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => {
      const aValue = getColumnValue(a, sortColumn);
      const bValue = getColumnValue(b, sortColumn);

      // Handle rate column numerically
      if (sortColumn === 'rate') {
        const aNum = parseFloat(aValue) || 0;
        const bNum = parseFloat(bValue) || 0;
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }

      // Handle date column
      if (sortColumn === 'date') {
        const aDate = new Date(a.wash_date).getTime();
        const bDate = new Date(b.wash_date).getTime();
        return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
      }

      // String comparison for other columns
      if (sortDirection === 'asc') {
        return aValue.localeCompare(bValue);
      } else {
        return bValue.localeCompare(aValue);
      }
    });
  }, [filteredEntries, sortColumn, sortDirection]);

  const getSortIcon = (column: ColumnKey) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  // Check if any column has active filters (for badge display)
  const hasActiveFilters = useMemo(() => {
    return COLUMN_CONFIG.some(({ key }) => columnFilters[key].length > 0);
  }, [columnFilters]);

  // Remove a single filter value from a column
  const removeFilterValue = (columnKey: ColumnKey, value: string) => {
    setColumnFilters((prev) => ({
      ...prev,
      [columnKey]: prev[columnKey].filter((v) => v !== value),
    }));
  };

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
      date: '',
      vehicle: '',
      client: '',
      type: '',
      rate: '',
      location: '',
      employee: '',
      comment: '',
    });
    setColumnFilters({
      date: [],
      vehicle: [],
      client: [],
      type: [],
      rate: [],
      location: [],
      employee: [],
      comment: [],
    });
  };

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(activeEntries.map(e => e.id)));
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

  const isAllSelected = activeEntries.length > 0 && activeEntries.every(e => selectedIds.has(e.id));
  const isSomeSelected = activeEntries.some(e => selectedIds.has(e.id)) && !isAllSelected;

  // Delete confirmation handlers
  const openDeleteDialog = (entries: WashEntry[]) => {
    setEntriesToDelete(entries);
    setDeleteDialogOpen(true);
  };

  const handleSingleDelete = (entry: WashEntry) => {
    openDeleteDialog([entry]);
  };

  const handleBulkDelete = () => {
    const selected = activeEntries.filter(e => selectedIds.has(e.id));
    if (selected.length > 0) {
      openDeleteDialog(selected);
    }
  };

  // Soft delete implementation
  const confirmDelete = async () => {
    try {
      const ids = entriesToDelete.map(e => e.id);
      
      const { error } = await supabase
        .from('wash_entries')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: userId,
        })
        .in('id', ids);

      if (error) throw error;

      const count = entriesToDelete.length;
      toast({
        title: 'Entries Deleted',
        description: `${count} ${count === 1 ? 'entry' : 'entries'} moved to trash`,
        action: (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleRestoreEntries(ids)}
          >
            Undo
          </Button>
        ),
      });

      setDeleteDialogOpen(false);
      setEntriesToDelete([]);
      setSelectedIds(new Set());
      fetchData();
    } catch (error) {
      console.error('Error deleting entries:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete entries',
        variant: 'destructive',
      });
    }
  };

  // Restore deleted entries
  const handleRestoreEntries = async (ids: string[]) => {
    try {
      const { error } = await supabase
        .from('wash_entries')
        .update({
          deleted_at: null,
          deleted_by: null,
          deletion_reason: null,
        })
        .in('id', ids);

      if (error) throw error;

      toast({
        title: 'Entries Restored',
        description: `${ids.length} ${ids.length === 1 ? 'entry' : 'entries'} restored`,
      });

      fetchData();
    } catch (error) {
      console.error('Error restoring entries:', error);
      toast({
        title: 'Error',
        description: 'Failed to restore entries',
        variant: 'destructive',
      });
    }
  };

  // Inline edit save handler
  const handleInlineEdit = async (entryId: string, field: ColumnKey, value: string) => {
    setEditingCell(null);
    
    // Find the entry to get the original value
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;

    // Determine the database field and value
    let dbField: string;
    let dbValue: any;

    switch (field) {
      case 'date':
        dbField = 'wash_date';
        // Parse the date from various formats
        try {
          const parsedDate = new Date(value);
          if (isNaN(parsedDate.getTime())) {
            toast({ title: 'Invalid date', variant: 'destructive' });
            return;
          }
          dbValue = format(parsedDate, 'yyyy-MM-dd');
        } catch {
          toast({ title: 'Invalid date format', variant: 'destructive' });
          return;
        }
        break;
      case 'rate':
        dbField = 'rate_override';
        dbValue = value ? parseFloat(value) : null;
        if (value && isNaN(dbValue)) {
          toast({ title: 'Invalid rate', variant: 'destructive' });
          return;
        }
        break;
      case 'comment':
        dbField = 'comment';
        dbValue = value || null;
        break;
      case 'location':
        dbField = 'actual_location_id';
        dbValue = value; // This is the location UUID from the dropdown
        // Validate that it's a valid location ID
        if (!locations.find(l => l.id === value)) {
          toast({ title: 'Invalid location', variant: 'destructive' });
          return;
        }
        break;
      default:
        return; // Non-editable field
    }

    // Check if value actually changed
    const originalValue = getColumnValue(entry, field);
    if (value === originalValue) return;

    try {
      const { error } = await supabase
        .from('wash_entries')
        .update({ [dbField]: dbValue })
        .eq('id', entryId);

      if (error) throw error;

      toast({
        title: 'Updated',
        description: `${COLUMN_CONFIG.find(c => c.key === field)?.label} updated successfully`,
      });

      // Refresh data to get updated values
      fetchData();
    } catch (error) {
      console.error('Error updating entry:', error);
      toast({
        title: 'Error',
        description: 'Failed to update entry',
        variant: 'destructive',
      });
    }
  };

  // Export functionality
  const handleExport = (entriesToExport: WashEntry[]) => {
    const exportData = entriesToExport.map(entry => ({
      'Date': format(new Date(entry.wash_date), 'yyyy-MM-dd'),
      'Vehicle': entry.vehicle?.vehicle_number || 'N/A',
      'Client': entry.vehicle?.client?.client_name || 'No Client',
      'Type': entry.vehicle?.vehicle_type?.type_name || 'N/A',
      'Rate': entry.rate_override ?? entry.vehicle?.vehicle_type?.rate_per_wash ?? 0,
      'Location': entry.location?.name || 'N/A',
      'Employee': entry.employee?.name || 'N/A',
      'Comment': entry.comment || '',
    }));

    exportToExcel(exportData, `wash_entries_${format(new Date(), 'yyyy-MM-dd')}`, 'Wash Entries', {
      addSumRow: true,
      sumColumns: ['Rate'],
    });

    toast({
      title: 'Export Complete',
      description: `Exported ${entriesToExport.length} entries`,
    });
  };

  const handleExportSelected = () => {
    const selected = activeEntries.filter(e => selectedIds.has(e.id));
    handleExport(selected);
  };

  const handleAddEntry = async () => {
    if (!newEntry.vehicle_id || !newEntry.actual_location_id) {
      toast({
        title: 'Error',
        description: 'Please select a vehicle and location',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase.from('wash_entries').insert({
        wash_date: format(newEntry.wash_date, 'yyyy-MM-dd'),
        vehicle_id: newEntry.vehicle_id,
        actual_location_id: newEntry.actual_location_id,
        employee_id: userId,
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Wash entry added',
      });

      setShowAddForm(false);
      setNewEntry({
        wash_date: new Date(),
        vehicle_id: '',
        actual_location_id: '',
      });
      fetchData();
    } catch (error) {
      console.error('Error adding entry:', error);
      toast({
        title: 'Error',
        description: 'Failed to add wash entry',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Wash Entries</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const visibleColumnCount = Object.values(visibleColumns).filter(Boolean).length;

  // Render cell content based on whether it's editable
  const renderCell = (entry: WashEntry, key: ColumnKey, isDeleted: boolean) => {
    const config = COLUMN_CONFIG.find(c => c.key === key);
    const value = getColumnValue(entry, key);
    const isEditing = editingCell?.id === entry.id && editingCell?.field === key;

    // For location column, use dropdown editor
    if (key === 'location' && config?.editable && !isDeleted) {
      return (
        <EditableLocationCell
          value={value}
          entryId={entry.id}
          locationId={entry.actual_location_id}
          locations={locations}
          isEditing={isEditing}
          onStartEdit={() => setEditingCell({ id: entry.id, field: key })}
          onSave={(locationId) => handleInlineEdit(entry.id, key, locationId)}
          onCancel={() => setEditingCell(null)}
          isDeleted={isDeleted}
        />
      );
    }

    // For other editable columns, show text editable cell
    if (config?.editable && !isDeleted) {
      return (
        <EditableCell
          value={value}
          entryId={entry.id}
          field={key}
          isEditing={isEditing}
          onStartEdit={() => setEditingCell({ id: entry.id, field: key })}
          onSave={(newValue) => handleInlineEdit(entry.id, key, newValue)}
          onCancel={() => setEditingCell(null)}
          type={key === 'rate' ? 'number' : 'text'}
          isDeleted={isDeleted}
        />
      );
    }

    // For rate column, show $ prefix
    if (key === 'rate') {
      return (
        <span className={cn(isDeleted && 'line-through')}>
          ${value}
          {entry.rate_override != null && (
            <span className="text-xs text-muted-foreground ml-1">(override)</span>
          )}
        </span>
      );
    }

    // For client column, show italic if empty
    if (key === 'client' && !value) {
      return (
        <span className={cn('text-muted-foreground italic', isDeleted && 'line-through')}>
          No Client
        </span>
      );
    }

    // Default display
    return (
      <span className={cn(isDeleted && 'line-through')}>
        {value || 'N/A'}
      </span>
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle>Wash Entry Management</CardTitle>
                <CardDescription>
                  Viewing {filteredEntries.length} of {entries.length} entries for {dateRangeDisplay}
                  {statusFilter !== 'active' && (
                    <span className="text-muted-foreground ml-2">
                      ({statusFilter === 'deleted' ? 'showing deleted only' : 'showing all'})
                    </span>
                  )}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2 items-center">

            {/* Date Range Controls */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
              <Tabs value={dateMode} onValueChange={handleDateModeChange} className="w-auto">
                <TabsList className="h-8">
                  <TabsTrigger value="week" className="text-xs px-3">Week</TabsTrigger>
                  <TabsTrigger value="month" className="text-xs px-3">Month</TabsTrigger>
                  <TabsTrigger value="custom" className="text-xs px-3">Custom Range</TabsTrigger>
                </TabsList>
              </Tabs>

              {dateMode === 'week' && (
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedWeek(prev => {
                      const newDate = new Date(prev);
                      newDate.setDate(newDate.getDate() - 7);
                      return newDate;
                    })}
                  >
                    ← Prev
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(startOfWeek(selectedWeek, { weekStartsOn: 0 }), 'MMM d')} - {format(endOfWeek(selectedWeek, { weekStartsOn: 0 }), 'MMM d')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-popover" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedWeek}
                        onSelect={(date) => date && setSelectedWeek(date)}
                        initialFocus
                        className={cn('p-3 pointer-events-auto')}
                      />
                    </PopoverContent>
                  </Popover>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedWeek(prev => {
                      const newDate = new Date(prev);
                      newDate.setDate(newDate.getDate() + 7);
                      return newDate;
                    })}
                  >
                    Next →
                  </Button>
                </div>
              )}

              {dateMode === 'month' && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(selectedMonth, 'MMM yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedMonth}
                      onSelect={(date) => date && setSelectedMonth(date)}
                      initialFocus
                      className={cn('p-3 pointer-events-auto')}
                    />
                  </PopoverContent>
                </Popover>
              )}

              {dateMode === 'custom' && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn(!customStartDate && 'text-muted-foreground')}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customStartDate ? format(customStartDate, 'MMM d, yyyy') : 'Start date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-popover" align="start">
                      <Calendar
                        mode="single"
                        selected={customStartDate}
                        onSelect={setCustomStartDate}
                        initialFocus
                        className={cn('p-3 pointer-events-auto')}
                      />
                    </PopoverContent>
                  </Popover>

                  <ArrowRight className="h-4 w-4 text-muted-foreground" />

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn(!customEndDate && 'text-muted-foreground')}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customEndDate ? format(customEndDate, 'MMM d, yyyy') : 'End date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-popover" align="start">
                      <Calendar
                        mode="single"
                        selected={customEndDate}
                        onSelect={setCustomEndDate}
                        initialFocus
                        className={cn('p-3 pointer-events-auto')}
                      />
                    </PopoverContent>
                  </Popover>

                  {dateRangeError && (
                    <span className="text-xs text-destructive">{dateRangeError}</span>
                  )}
                </div>
              )}
            </div>
          </div>

              {/* Column Visibility */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Columns3 className="mr-2 h-4 w-4" />
                    Columns
                    <ChevronDown className="ml-2 h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-popover">
                  <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {COLUMN_CONFIG.map(({ key, label }) => (
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

              {/* Clear Filters */}
              {activeFilterCount > 0 && (
                <Button variant="outline" size="sm" onClick={clearAllFilters}>
                  <X className="mr-2 h-4 w-4" />
                  Clear Filters
                  <Badge variant="secondary" className="ml-2">
                    {activeFilterCount}
                  </Badge>
                </Button>
              )}

              {/* Add Entry */}
              <Button size="sm" onClick={() => setShowAddForm(!showAddForm)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Entry
              </Button>
            </div>

          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Bulk Action Toolbar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg border">
              <span className="text-sm font-medium">
                {selectedIds.size} {selectedIds.size === 1 ? 'entry' : 'entries'} selected
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleExportSelected}>
                  <Download className="mr-2 h-4 w-4" />
                  Export Selected
                </Button>
                <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Selected
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {showAddForm && (
            <div className="border rounded-lg p-4 space-y-4 bg-muted/50">
              <h3 className="font-semibold">Add New Wash Entry</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-sm font-medium mb-2 block">Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(newEntry.wash_date, 'PPP')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-popover" align="start">
                      <Calendar
                        mode="single"
                        selected={newEntry.wash_date}
                        onSelect={(date) => date && setNewEntry({ ...newEntry, wash_date: date })}
                        initialFocus
                        className={cn('p-3 pointer-events-auto')}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Vehicle</label>
                  <VehicleSearchInput
                    onSelect={(vehicleNumber, vehicleId) =>
                      setNewEntry({ ...newEntry, vehicle_id: vehicleId })
                    }
                    placeholder="Search vehicle..."
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Location</label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={newEntry.actual_location_id}
                    onChange={(e) => setNewEntry({ ...newEntry, actual_location_id: e.target.value })}
                  >
                    <option value="">Select location</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddEntry}>Save Entry</Button>
                <Button variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                {/* Header Row with Filter Icons */}
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[50px]"></TableHead>
                  {COLUMN_CONFIG.map(
                    ({ key, label, filterable, editable }) =>
                      visibleColumns[key] && (
                        <TableHead 
                          key={key}
                          className="cursor-pointer select-none hover:bg-muted/50"
                          onClick={() => handleSort(key)}
                        >
                          <div className="flex items-center gap-1">
                            <span>{label}</span>
                            {getSortIcon(key)}
                            {editable && (
                              <span title="Editable">
                                <Pencil className="h-3 w-3 text-muted-foreground" />
                              </span>
                            )}
                            {filterable && (
                              <ColumnFilterDropdown
                                columnKey={key}
                                label={label}
                                uniqueValues={uniqueValues[key]}
                                selectedValues={columnFilters[key]}
                                onSelectionChange={(values) =>
                                  setColumnFilters((prev) => ({ ...prev, [key]: values }))
                                }
                              />
                            )}
                          </div>
                        </TableHead>
                      )
                  )}
                  {/* Actions column with Status Filter */}
                  <TableHead className="w-[120px]">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn('h-auto p-1 gap-1', statusFilter !== 'active' && 'text-primary')}
                        >
                          <span>Actions</span>
                          <Filter className="h-3 w-3" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-40 p-0 bg-popover border" align="end">
                        <div className="p-2 border-b">
                          <p className="text-sm font-medium">Status Filter</p>
                        </div>
                        <div className="p-2 space-y-1">
                          {[
                            { value: 'active', label: 'Active Only' },
                            { value: 'deleted', label: 'Deleted Only' },
                            { value: 'all', label: 'All Entries' },
                          ].map((option) => (
                            <div
                              key={option.value}
                              className={cn(
                                'flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted',
                                statusFilter === option.value && 'bg-muted'
                              )}
                              onClick={() => setStatusFilter(option.value as 'active' | 'deleted' | 'all')}
                            >
                              <div
                                className={cn(
                                  'h-4 w-4 rounded-full border flex items-center justify-center',
                                  statusFilter === option.value && 'border-primary'
                                )}
                              >
                                {statusFilter === option.value && (
                                  <div className="h-2 w-2 rounded-full bg-primary" />
                                )}
                              </div>
                              <span className="text-sm">{option.label}</span>
                            </div>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </TableHead>
                </TableRow>

                {/* Active Filter Badges Row */}
                {hasActiveFilters && (
                  <TableRow className="bg-muted/20 hover:bg-muted/20">
                    <TableHead className="py-1"></TableHead>
                    {COLUMN_CONFIG.map(
                      ({ key }) =>
                        visibleColumns[key] && (
                          <TableHead key={`badges-${key}`} className="py-1 px-2">
                            {columnFilters[key].length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {columnFilters[key].slice(0, 3).map((value) => (
                                  <Badge
                                    key={value}
                                    variant="secondary"
                                    className="text-xs px-1.5 py-0 h-5 gap-1 cursor-pointer hover:bg-destructive/20"
                                    onClick={() => removeFilterValue(key, value)}
                                  >
                                    <span className="truncate max-w-[60px]">{value}</span>
                                    <X className="h-2.5 w-2.5" />
                                  </Badge>
                                ))}
                                {columnFilters[key].length > 3 && (
                                  <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">
                                    +{columnFilters[key].length - 3}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </TableHead>
                        )
                    )}
                    <TableHead className="py-1"></TableHead>
                  </TableRow>
                )}

                {/* Search Row */}
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="py-1">
                    <Checkbox
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) {
                          (el as HTMLButtonElement & { indeterminate: boolean }).indeterminate = isSomeSelected;
                        }
                      }}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  {COLUMN_CONFIG.map(
                    ({ key }) =>
                      visibleColumns[key] && (
                        <TableHead key={`search-${key}`} className="py-1 px-2">
                          <div className="relative">
                            <Input
                              placeholder={`Filter...`}
                              value={columnSearches[key]}
                              onChange={(e) =>
                                setColumnSearches((prev) => ({ ...prev, [key]: e.target.value }))
                              }
                              className="h-7 text-xs pr-6"
                            />
                            {columnSearches[key] && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-7 w-6 p-0"
                                onClick={() =>
                                  setColumnSearches((prev) => ({ ...prev, [key]: '' }))
                                }
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </TableHead>
                      )
                  )}
                  <TableHead className="py-1"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedEntries.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={visibleColumnCount + 2}
                      className="text-center text-muted-foreground h-24"
                    >
                      {entries.length === 0
                        ? 'No wash entries found for this period'
                        : 'No entries match your filters'}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedEntries.map((entry) => {
                    const isDeleted = !!entry.deleted_at;
                    return (
                      <TableRow 
                        key={entry.id} 
                        className={cn(
                          selectedIds.has(entry.id) && 'bg-muted/50',
                          isDeleted && 'opacity-50 bg-destructive/5'
                        )}
                      >
                        <TableCell>
                          {!isDeleted && (
                            <Checkbox
                              checked={selectedIds.has(entry.id)}
                              onCheckedChange={(checked) => handleSelectRow(entry.id, !!checked)}
                              aria-label="Select row"
                            />
                          )}
                        </TableCell>
                        {COLUMN_CONFIG.map(
                          ({ key }) =>
                            visibleColumns[key] && (
                              <TableCell key={key}>
                                {renderCell(entry, key, isDeleted)}
                              </TableCell>
                            )
                        )}
                        <TableCell>
                          {isDeleted ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRestoreEntries([entry.id])}
                              title="Restore entry"
                            >
                              <RotateCcw className="h-4 w-4 text-primary" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSingleDelete(entry)}
                              title="Delete entry"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {entriesToDelete.length === 1 ? (
                <>
                  This will delete the wash entry for vehicle{' '}
                  <strong>{entriesToDelete[0]?.vehicle?.vehicle_number || 'Unknown'}</strong> on{' '}
                  <strong>{entriesToDelete[0] ? format(new Date(entriesToDelete[0].wash_date), 'MMM d, yyyy') : ''}</strong>.
                </>
              ) : (
                <>
                  This will delete <strong>{entriesToDelete.length}</strong> wash entries.
                </>
              )}
              <br /><br />
              You can restore deleted entries by enabling "Show deleted entries" toggle.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
