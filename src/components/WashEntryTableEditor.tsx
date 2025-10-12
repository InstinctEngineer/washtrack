import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { CalendarIcon, Trash2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VehicleSearchInput } from './VehicleSearchInput';

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

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Get start and end of selected month
      const startOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
      const endOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0);

      // Fetch wash entries for the month
      const { data: entriesData, error: entriesError } = await supabase
        .from('wash_entries')
        .select(`
          *,
          vehicle:vehicles(vehicle_number, vehicle_type:vehicle_types(type_name, rate_per_wash)),
          location:locations!wash_entries_actual_location_id_fkey(name),
          employee:users!wash_entries_employee_id_fkey(name)
        `)
        .gte('wash_date', startOfMonth.toISOString().split('T')[0])
        .lte('wash_date', endOfMonth.toISOString().split('T')[0])
        .order('wash_date', { ascending: false });

      if (entriesError) throw entriesError;

      // Fetch locations
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
      const { error } = await supabase
        .from('wash_entries')
        .delete()
        .eq('id', entryId);

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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Wash Entry Management</CardTitle>
            <CardDescription>
              Viewing entries for {format(selectedMonth, 'MMMM yyyy')}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(selectedMonth, 'MMM yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={selectedMonth}
                  onSelect={(date) => date && setSelectedMonth(date)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <Button onClick={() => setShowAddForm(!showAddForm)}>
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
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={newEntry.wash_date}
                      onSelect={(date) => date && setNewEntry({ ...newEntry, wash_date: date })}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Vehicle</label>
                <VehicleSearchInput
                  onSelect={(vehicleNumber, vehicleId) => setNewEntry({ ...newEntry, vehicle_id: vehicleId })}
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

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No wash entries found for this month
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{format(new Date(entry.wash_date), 'MMM d, yyyy')}</TableCell>
                    <TableCell>{entry.vehicle?.vehicle_number || 'N/A'}</TableCell>
                    <TableCell>{entry.vehicle?.vehicle_type?.type_name || 'N/A'}</TableCell>
                    <TableCell>
                      ${entry.vehicle?.vehicle_type?.rate_per_wash?.toFixed(2) || '0.00'}
                    </TableCell>
                    <TableCell>{entry.location?.name || 'N/A'}</TableCell>
                    <TableCell>{entry.employee?.name || 'N/A'}</TableCell>
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
