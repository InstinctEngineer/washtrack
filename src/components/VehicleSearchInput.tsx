import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { VehicleWithDetails } from '@/types/database';
import { Plus, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface VehicleSearchInputProps {
  onSelect: (vehicleNumber: string, vehicleId: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function VehicleSearchInput({ onSelect, disabled, placeholder = "Search vehicle number..." }: VehicleSearchInputProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [vehicles, setVehicles] = useState<VehicleWithDetails[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { userProfile } = useAuth();

  // Debounced search
  useEffect(() => {
    if (searchTerm.length === 0) {
      setVehicles([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        // Search for vehicles that start with or contain the search term
        // Only show vehicles from employee's location
        let startsWithQuery = supabase
          .from('vehicles')
          .select(`
            *,
            vehicle_type:vehicle_types(*),
            client:clients(*),
            home_location:locations!vehicles_home_location_id_fkey(*)
          `)
          .ilike('vehicle_number', `${searchTerm}%`)
          .eq('is_active', true)
          .limit(10);
        
        if (userProfile?.location_id) {
          startsWithQuery = startsWithQuery.eq('home_location_id', userProfile.location_id);
        }
        
        const { data: startsWithData } = await startsWithQuery;

        const startsWithNumbers = startsWithData?.map(v => v.vehicle_number) || [];
        
        let containsQuery = supabase
          .from('vehicles')
          .select(`
            *,
            vehicle_type:vehicle_types(*),
            client:clients(*),
            home_location:locations!vehicles_home_location_id_fkey(*)
          `)
          .ilike('vehicle_number', `%${searchTerm}%`)
          .eq('is_active', true);
        
        if (userProfile?.location_id) {
          containsQuery = containsQuery.eq('home_location_id', userProfile.location_id);
        }
        
        if (startsWithNumbers.length > 0) {
          containsQuery = containsQuery.not('vehicle_number', 'in', `(${startsWithNumbers.join(',')})`);
        }
        
        const { data: containsData } = await containsQuery.limit(10);

        // Combine results (already filtered by location)
        const allVehicles = [...(startsWithData || []), ...(containsData || [])];

        setVehicles(allVehicles.slice(0, 20));
        setShowDropdown(true);
      } catch (error) {
        console.error('Error searching vehicles:', error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, userProfile?.location_id]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (vehicle: VehicleWithDetails) => {
    onSelect(vehicle.vehicle_number, vehicle.id);
    setSearchTerm('');
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      onSelect(searchTerm.trim(), '');
      setSearchTerm('');
      setShowDropdown(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="pl-9"
          />
          
          {showDropdown && vehicles.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-80 overflow-auto"
            >
              {vehicles.map((vehicle) => (
                <button
                  key={vehicle.id}
                  type="button"
                  onClick={() => handleSelect(vehicle)}
                  className="w-full px-4 py-3 text-left hover:bg-accent transition-colors border-b last:border-b-0"
                >
                  <div className="font-medium">
                    Vehicle #{vehicle.vehicle_number}
                    {vehicle.client && (
                      <span className="ml-2 text-sm font-normal text-primary">
                        • {vehicle.client.client_name}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Type: {vehicle.vehicle_type?.type_name || 'Unknown'}
                    {vehicle.home_location && ` • Home: ${vehicle.home_location.name}`}
                  </div>
                </button>
              ))}
            </div>
          )}
          
          {showDropdown && searchTerm && vehicles.length === 0 && !loading && (
            <div
              ref={dropdownRef}
              className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg p-4 text-sm text-muted-foreground"
            >
              No vehicles found
            </div>
          )}
        </div>
        
        <Button type="submit" disabled={disabled || !searchTerm.trim()} size="icon">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
