import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Package } from 'lucide-react';

export interface WorkItemWithDetails {
  id: string;
  identifier: string;
  rate_config: {
    id: string;
    frequency: string | null;
    rate: number | null;
    work_type: {
      id: string;
      name: string;
      rate_type: string;
    };
  };
}

interface WorkItemGridProps {
  locationId: string;
  onSelect: (workItem: WorkItemWithDetails) => void;
}

export function WorkItemGrid({ locationId, onSelect }: WorkItemGridProps) {
  const [workItems, setWorkItems] = useState<WorkItemWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchWorkItems = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('work_items')
        .select(`
          id, identifier,
          rate_config:rate_configs!inner(
            id, frequency, rate, location_id,
            work_type:work_types!inner(id, name, rate_type)
          )
        `)
        .eq('is_active', true)
        .eq('rate_config.is_active', true)
        .eq('rate_config.location_id', locationId);

      if (!error && data) {
        // Filter to per_unit items and transform
        const perUnitItems = data
          .filter((item: any) => item.rate_config?.work_type?.rate_type === 'per_unit')
          .map((item: any) => ({
            id: item.id,
            identifier: item.identifier,
            rate_config: {
              id: item.rate_config.id,
              frequency: item.rate_config.frequency,
              rate: item.rate_config.rate,
              work_type: item.rate_config.work_type,
            },
          })) as WorkItemWithDetails[];
        
        // Sort by work type name, then identifier
        perUnitItems.sort((a, b) => {
          const typeCompare = a.rate_config.work_type.name.localeCompare(b.rate_config.work_type.name);
          if (typeCompare !== 0) return typeCompare;
          return a.identifier.localeCompare(b.identifier);
        });
        
        setWorkItems(perUnitItems);
      }
      setLoading(false);
    };

    if (locationId) {
      fetchWorkItems();
    }
  }, [locationId]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return workItems;
    const query = searchQuery.toLowerCase();
    return workItems.filter(item => 
      item.identifier.toLowerCase().includes(query) ||
      item.rate_config.work_type.name.toLowerCase().includes(query)
    );
  }, [workItems, searchQuery]);

  // Group items by work type
  const groupedItems = useMemo(() => {
    const groups: Record<string, WorkItemWithDetails[]> = {};
    filteredItems.forEach(item => {
      const typeName = item.rate_config.work_type.name;
      if (!groups[typeName]) {
        groups[typeName] = [];
      }
      groups[typeName].push(item);
    });
    return groups;
  }, [filteredItems]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  if (workItems.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>No vehicles or equipment configured for this location</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by identifier or type..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {Object.keys(groupedItems).length === 0 ? (
        <p className="text-center text-muted-foreground py-4">No items match your search</p>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedItems).map(([typeName, items]) => (
            <div key={typeName}>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">{typeName}</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onSelect(item)}
                    className="flex flex-col items-center justify-center p-3 rounded-lg border bg-card hover:bg-accent hover:border-primary transition-colors text-center min-h-[80px]"
                  >
                    <span className="font-mono font-semibold text-lg">{item.identifier}</span>
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {item.rate_config.work_type.name}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
