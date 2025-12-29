import { useEffect, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface FilterOption {
  id: string;
  name: string;
  clientId?: string;
}

interface ReportFiltersProps {
  selectedClients: string[];
  selectedLocations: string[];
  selectedWorkTypes: string[];
  onClientsChange: (clients: string[]) => void;
  onLocationsChange: (locations: string[]) => void;
  onWorkTypesChange: (workTypes: string[]) => void;
}

export function ReportFilters({
  selectedClients,
  selectedLocations,
  selectedWorkTypes,
  onClientsChange,
  onLocationsChange,
  onWorkTypesChange,
}: ReportFiltersProps) {
  const [clients, setClients] = useState<FilterOption[]>([]);
  const [locations, setLocations] = useState<FilterOption[]>([]);
  const [workTypes, setWorkTypes] = useState<FilterOption[]>([]);
  const [clientsOpen, setClientsOpen] = useState(false);
  const [locationsOpen, setLocationsOpen] = useState(false);
  const [workTypesOpen, setWorkTypesOpen] = useState(false);

  useEffect(() => {
    fetchClients();
    fetchWorkTypes();
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [selectedClients]);

  const fetchClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    setClients(data || []);
  };

  const fetchLocations = async () => {
    let query = supabase
      .from('locations')
      .select('id, name, client_id')
      .eq('is_active', true)
      .order('name');

    if (selectedClients.length > 0) {
      query = query.in('client_id', selectedClients);
    }

    const { data } = await query;
    setLocations(data?.map(l => ({ id: l.id, name: l.name, clientId: l.client_id })) || []);
  };

  const fetchWorkTypes = async () => {
    const { data } = await supabase
      .from('work_types')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    setWorkTypes(data || []);
  };

  const toggleSelection = (
    value: string,
    selected: string[],
    onChange: (values: string[]) => void
  ) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const getSelectedLabel = (selected: string[], options: FilterOption[], singular: string) => {
    if (selected.length === 0) return `All ${singular}s`;
    if (selected.length === 1) {
      const item = options.find((o) => o.id === selected[0]);
      return item?.name || `1 ${singular}`;
    }
    return `${selected.length} ${singular}s`;
  };

  return (
    <div className="flex flex-wrap gap-4">
      {/* Clients Multi-select */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-muted-foreground">Clients</label>
        <Popover open={clientsOpen} onOpenChange={setClientsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={clientsOpen}
              className="w-[200px] justify-between"
            >
              <span className="truncate">
                {getSelectedLabel(selectedClients, clients, 'Client')}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0 bg-popover">
            <Command>
              <CommandInput placeholder="Search clients..." />
              <CommandList>
                <CommandEmpty>No clients found.</CommandEmpty>
                <CommandGroup>
                  {clients.map((client) => (
                    <CommandItem
                      key={client.id}
                      value={client.name}
                      onSelect={() => toggleSelection(client.id, selectedClients, onClientsChange)}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          selectedClients.includes(client.id) ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      {client.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
            {selectedClients.length > 0 && (
              <div className="border-t p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => onClientsChange([])}
                >
                  Clear selection
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* Locations Multi-select */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-muted-foreground">Locations</label>
        <Popover open={locationsOpen} onOpenChange={setLocationsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={locationsOpen}
              className="w-[200px] justify-between"
            >
              <span className="truncate">
                {getSelectedLabel(selectedLocations, locations, 'Location')}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0 bg-popover">
            <Command>
              <CommandInput placeholder="Search locations..." />
              <CommandList>
                <CommandEmpty>No locations found.</CommandEmpty>
                <CommandGroup>
                  {locations.map((location) => (
                    <CommandItem
                      key={location.id}
                      value={location.name}
                      onSelect={() => toggleSelection(location.id, selectedLocations, onLocationsChange)}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          selectedLocations.includes(location.id) ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      {location.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
            {selectedLocations.length > 0 && (
              <div className="border-t p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => onLocationsChange([])}
                >
                  Clear selection
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* Work Types Multi-select */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-muted-foreground">Work Types</label>
        <Popover open={workTypesOpen} onOpenChange={setWorkTypesOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={workTypesOpen}
              className="w-[200px] justify-between"
            >
              <span className="truncate">
                {getSelectedLabel(selectedWorkTypes, workTypes, 'Work Type')}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0 bg-popover">
            <Command>
              <CommandInput placeholder="Search work types..." />
              <CommandList>
                <CommandEmpty>No work types found.</CommandEmpty>
                <CommandGroup>
                  {workTypes.map((wt) => (
                    <CommandItem
                      key={wt.id}
                      value={wt.name}
                      onSelect={() => toggleSelection(wt.id, selectedWorkTypes, onWorkTypesChange)}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          selectedWorkTypes.includes(wt.id) ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      {wt.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
            {selectedWorkTypes.length > 0 && (
              <div className="border-t p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => onWorkTypesChange([])}
                >
                  Clear selection
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* Selected filters display */}
      {(selectedClients.length > 0 || selectedLocations.length > 0 || selectedWorkTypes.length > 0) && (
        <div className="flex items-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onClientsChange([]);
              onLocationsChange([]);
              onWorkTypesChange([]);
            }}
          >
            Clear All Filters
          </Button>
        </div>
      )}
    </div>
  );
}
