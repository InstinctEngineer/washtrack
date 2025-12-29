import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Package, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

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
        
        perUnitItems.sort((a, b) => {
          const typeCompare = a.rate_config.work_type.name.localeCompare(b.rate_config.work_type.name);
          if (typeCompare !== 0) return typeCompare;
          return a.identifier.localeCompare(b.identifier);
        });
        
        setWorkItems(perUnitItems);
        
        // Auto-expand first section
        const firstType = perUnitItems[0]?.rate_config.work_type.name;
        if (firstType) {
          setExpandedSections(new Set([firstType]));
        }
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

  // Auto-expand sections with search matches
  useEffect(() => {
    if (searchQuery.trim()) {
      setExpandedSections(new Set(Object.keys(groupedItems)));
    }
  }, [searchQuery, groupedItems]);

  const toggleSection = (typeName: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(typeName)) {
        next.delete(typeName);
      } else {
        next.add(typeName);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
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
    <div className="space-y-3">
      {/* Mobile-optimized search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-12 h-12 text-base"
        />
      </div>

      {Object.keys(groupedItems).length === 0 ? (
        <p className="text-center text-muted-foreground py-6">No items match your search</p>
      ) : (
        <div className="space-y-2">
          {Object.entries(groupedItems).map(([typeName, items]) => {
            const isExpanded = expandedSections.has(typeName);
            
            return (
              <Collapsible 
                key={typeName} 
                open={isExpanded} 
                onOpenChange={() => toggleSection(typeName)}
              >
                {/* Section Header - Large touch target */}
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      "w-full flex items-center justify-between p-4 min-h-[56px] rounded-lg transition-all duration-200",
                      "active:scale-[0.98] touch-manipulation",
                      isExpanded 
                        ? "bg-primary/10 border-2 border-primary rounded-b-none" 
                        : "bg-muted/50 border border-border hover:bg-muted/80"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-primary shrink-0" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                      )}
                      <span className={cn(
                        "text-base",
                        isExpanded ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
                      )}>
                        {typeName}
                      </span>
                    </div>
                    <span className={cn(
                      "text-sm px-2.5 py-1 rounded-full",
                      isExpanded 
                        ? "bg-primary/20 text-primary font-medium" 
                        : "bg-muted text-muted-foreground"
                    )}>
                      {items.length} {items.length === 1 ? 'item' : 'items'}
                    </span>
                  </button>
                </CollapsibleTrigger>

                {/* Section Content */}
                <CollapsibleContent>
                  <div className={cn(
                    "border-2 border-t-0 border-primary rounded-b-lg p-3 bg-card"
                  )}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => onSelect(item)}
                          className={cn(
                            "flex items-center justify-center p-4 min-h-[64px] rounded-lg",
                            "bg-background border-2 border-border",
                            "hover:border-primary hover:bg-accent",
                            "active:scale-95 active:bg-primary/10",
                            "transition-all duration-150 touch-manipulation"
                          )}
                        >
                          <span className="font-mono text-xl font-bold text-foreground">
                            {item.identifier}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}
