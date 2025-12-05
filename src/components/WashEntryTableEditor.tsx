import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { CalendarIcon, Trash2, Plus, Filter, X, Columns3, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VehicleSearchInput } from './VehicleSearchInput';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface WashEntry {
  id: string;
  wash_date: string;
  vehicle_id: string;
  actual_location_id: string;
  employee_id: string;
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

type ColumnKey = 'date' | 'vehicle' | 'client' | 'type' | 'rate' | 'location' | 'employee';

const COLUMN_CONFIG: { key: ColumnKey; label: string; filterable: boolean }[] = [
  { key: 'date', label: 'Date', filterable: true },
  { key: 'vehicle', label: 'Vehicle', filterable: true },
  { key: 'client', label: 'Client', filterable: true },
  { key: 'type', label: 'Type', filterable: true },
  { key: 'rate', label: 'Rate', filterable: false },
  { key: 'location', label: 'Location', filterable: true },
  { key: 'employee', label: 'Employee', filterable: true },
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
      return entry.vehicle?.vehicle_type?.rate_per_wash?.toFixed(2) || '0.00';
    case 'location':
      return entry.location?.name || '';
    case 'employee':
      return entry.employee?.name || '';
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

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>({
    date: true,
    vehicle: true,
    client: true,
    type: true,
    rate: true,
    location: true,
    employee: true,
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
  });

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const startOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
      const endOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0);

      const { data: entriesData, error: entriesError } = await supabase
        .from('wash_entries')
        .select(`
          *,
          vehicle:vehicles(vehicle_number, vehicle_type:vehicle_types(type_name, rate_per_wash), client:clients(client_name)),
          location:locations!wash_entries_actual_location_id_fkey(name),
          employee:users!wash_entries_employee_id_fkey(name)
        `)
        .gte('wash_date', startOfMonth.toISOString().split('T')[0])
        .lte('wash_date', endOfMonth.toISOString().split('T')[0])
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

  // Filter entries based on all filters
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
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
  }, [entries, columnSearches, columnFilters]);

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
    });
    setColumnFilters({
      date: [],
      vehicle: [],
      client: [],
      type: [],
      rate: [],
      location: [],
      employee: [],
    });
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

  const handleDeleteEntry = async (entryId: string) => {
    try {
      const { error } = await supabase.from('wash_entries').delete().eq('id', entryId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Wash entry deleted',
      });

      fetchData();
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete wash entry',
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

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Wash Entry Management</CardTitle>
            <CardDescription>
              Viewing {filteredEntries.length} of {entries.length} entries for{' '}
              {format(selectedMonth, 'MMMM yyyy')}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Month Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(selectedMonth, 'MMM yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover" align="end">
                <Calendar
                  mode="single"
                  selected={selectedMonth}
                  onSelect={(date) => date && setSelectedMonth(date)}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>

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
              <TableRow>
                {COLUMN_CONFIG.map(
                  ({ key, label, filterable }) =>
                    visibleColumns[key] && (
                      <TableHead key={key}>
                        <div className="flex items-center gap-1">
                          <span>{label}</span>
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
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>

              {/* Search Row */}
              <TableRow className="bg-muted/30 hover:bg-muted/30">
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
              {filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={Object.values(visibleColumns).filter(Boolean).length + 1}
                    className="text-center text-muted-foreground h-24"
                  >
                    {entries.length === 0
                      ? 'No wash entries found for this month'
                      : 'No entries match your filters'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    {visibleColumns.date && (
                      <TableCell>{format(new Date(entry.wash_date), 'MMM d, yyyy')}</TableCell>
                    )}
                    {visibleColumns.vehicle && (
                      <TableCell>{entry.vehicle?.vehicle_number || 'N/A'}</TableCell>
                    )}
                    {visibleColumns.client && (
                      <TableCell>
                        {entry.vehicle?.client?.client_name || (
                          <span className="text-muted-foreground italic">No Client</span>
                        )}
                      </TableCell>
                    )}
                    {visibleColumns.type && (
                      <TableCell>{entry.vehicle?.vehicle_type?.type_name || 'N/A'}</TableCell>
                    )}
                    {visibleColumns.rate && (
                      <TableCell>
                        ${entry.vehicle?.vehicle_type?.rate_per_wash?.toFixed(2) || '0.00'}
                      </TableCell>
                    )}
                    {visibleColumns.location && (
                      <TableCell>{entry.location?.name || 'N/A'}</TableCell>
                    )}
                    {visibleColumns.employee && (
                      <TableCell>{entry.employee?.name || 'N/A'}</TableCell>
                    )}
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteEntry(entry.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
