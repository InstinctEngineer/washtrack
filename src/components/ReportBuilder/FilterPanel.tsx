import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, CalendarIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface FilterPanelProps {
  dateFrom: string;
  dateTo: string;
  selectedClients: string[];
  selectedLocations: string[];
  selectedEmployees: string[];
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onClientsChange: (value: string[]) => void;
  onLocationsChange: (value: string[]) => void;
  onEmployeesChange: (value: string[]) => void;
  onClearAll: () => void;
}

interface SelectOption {
  value: string;
  label: string;
}

export function FilterPanel({
  dateFrom,
  dateTo,
  selectedClients,
  selectedLocations,
  selectedEmployees,
  onDateFromChange,
  onDateToChange,
  onClientsChange,
  onLocationsChange,
  onEmployeesChange,
  onClearAll,
}: FilterPanelProps) {
  const [clients, setClients] = useState<SelectOption[]>([]);
  const [locations, setLocations] = useState<SelectOption[]>([]);
  const [employees, setEmployees] = useState<SelectOption[]>([]);

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  const fetchFilterOptions = async () => {
    const [clientsRes, locationsRes, employeesRes] = await Promise.all([
      supabase.from('clients').select('id, client_name').eq('is_active', true).order('client_name'),
      supabase.from('locations').select('id, name').eq('is_active', true).order('name'),
      supabase.from('users').select('id, name').eq('is_active', true).order('name'),
    ]);

    if (clientsRes.data) {
      setClients(clientsRes.data.map(c => ({ value: c.id, label: c.client_name })));
    }
    if (locationsRes.data) {
      setLocations(locationsRes.data.map(l => ({ value: l.id, label: l.name })));
    }
    if (employeesRes.data) {
      setEmployees(employeesRes.data.map(e => ({ value: e.id, label: e.name })));
    }
  };

  const toggleItem = (item: string, currentList: string[], onChange: (list: string[]) => void) => {
    if (currentList.includes(item)) {
      onChange(currentList.filter(i => i !== item));
    } else {
      onChange([...currentList, item]);
    }
  };

  const hasAnyFilters = dateFrom || dateTo || selectedClients.length > 0 || 
                        selectedLocations.length > 0 || selectedEmployees.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Filters</h3>
        {hasAnyFilters && (
          <Button variant="ghost" size="sm" onClick={onClearAll} className="h-7 text-xs">
            Clear All
          </Button>
        )}
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Date Range</Label>
          <div className="grid grid-cols-2 gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal text-sm",
                    !dateFrom && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom ? format(new Date(dateFrom), "MMM d, yyyy") : "From date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFrom ? new Date(dateFrom) : undefined}
                  onSelect={(date) => onDateFromChange(date ? format(date, 'yyyy-MM-dd') : '')}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal text-sm",
                    !dateTo && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateTo ? format(new Date(dateTo), "MMM d, yyyy") : "To date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateTo ? new Date(dateTo) : undefined}
                  onSelect={(date) => onDateToChange(date ? format(date, 'yyyy-MM-dd') : '')}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <Collapsible defaultOpen={selectedClients.length > 0}>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded px-2">
            <span className="text-xs font-medium">
              Clients {selectedClients.length > 0 && `(${selectedClients.length} selected)`}
            </span>
            <ChevronDown className="h-4 w-4" />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 mt-2 max-h-[200px] overflow-y-auto">
            {clients.map(client => (
              <div key={client.value} className="flex items-center gap-2">
                <Checkbox
                  id={`client-${client.value}`}
                  checked={selectedClients.includes(client.value)}
                  onCheckedChange={() => toggleItem(client.value, selectedClients, onClientsChange)}
                />
                <Label htmlFor={`client-${client.value}`} className="text-sm cursor-pointer flex-1">
                  {client.label}
                </Label>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>

        <Collapsible defaultOpen={selectedLocations.length > 0}>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded px-2">
            <span className="text-xs font-medium">
              Locations {selectedLocations.length > 0 && `(${selectedLocations.length} selected)`}
            </span>
            <ChevronDown className="h-4 w-4" />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 mt-2 max-h-[200px] overflow-y-auto">
            {locations.map(location => (
              <div key={location.value} className="flex items-center gap-2">
                <Checkbox
                  id={`location-${location.value}`}
                  checked={selectedLocations.includes(location.value)}
                  onCheckedChange={() => toggleItem(location.value, selectedLocations, onLocationsChange)}
                />
                <Label htmlFor={`location-${location.value}`} className="text-sm cursor-pointer flex-1">
                  {location.label}
                </Label>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>

        <Collapsible defaultOpen={selectedEmployees.length > 0}>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded px-2">
            <span className="text-xs font-medium">
              Employees {selectedEmployees.length > 0 && `(${selectedEmployees.length} selected)`}
            </span>
            <ChevronDown className="h-4 w-4" />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 mt-2 max-h-[200px] overflow-y-auto">
            {employees.map(employee => (
              <div key={employee.value} className="flex items-center gap-2">
                <Checkbox
                  id={`employee-${employee.value}`}
                  checked={selectedEmployees.includes(employee.value)}
                  onCheckedChange={() => toggleItem(employee.value, selectedEmployees, onEmployeesChange)}
                />
                <Label htmlFor={`employee-${employee.value}`} className="text-sm cursor-pointer flex-1">
                  {employee.label}
                </Label>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
