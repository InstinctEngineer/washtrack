import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Package, ChevronRight, ChevronDown, Check, Plus } from 'lucide-react';
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
  selectedIds?: Set<string>;
  completedIds?: Set<string>;
  onToggle?: (workItem: WorkItemWithDetails) => void;
  onSelect?: (workItem: WorkItemWithDetails) => void;
  onAddVehicle?: (typeName: string) => void;
  refreshKey?: number;
}

export function WorkItemGrid({ locationId, selectedIds, completedIds, onToggle, onSelect, onAddVehicle, refreshKey }: WorkItemGridProps) {
  const [workItems, setWorkItems] = useState<WorkItemWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Determine mode: toggle (batch) or select (immediate)
  const isToggleMode = !!onToggle && !!selectedIds;

  useEffect(() => {
    const fetchWorkItems = async () => {
      setLoading(true);
      
      // Fetch work items
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
        
        // Custom sort: PUD first, then alphabetical by type, then by identifier
        perUnitItems.sort((a, b) => {
          const typeA = a.rate_config.work_type.name;
          const typeB = b.rate_config.work_type.name;
          
          // PUD comes first
          if (typeA === 'PUD' && typeB !== 'PUD') return -1;
          if (typeB === 'PUD' && typeA !== 'PUD') return 1;
          
          // Then alphabetical by type
          const typeCompare = typeA.localeCompare(typeB);
          if (typeCompare !== 0) return typeCompare;
          
          // Within same type, sort by identifier
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
  }, [locationId, refreshKey]);

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

  const handleItemClick = (item: WorkItemWithDetails) => {
    // Don't allow interaction with completed items
    if (completedIds?.has(item.id)) return;
    
    if (isToggleMode) {
      onToggle(item);
    } else if (onSelect) {
      onSelect(item);
    }
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
          {Object.keys(groupedItems)
            .sort((a, b) => {
              // PUD first, then alphabetical
              if (a === 'PUD') return -1;
              if (b === 'PUD') return 1;
              return a.localeCompare(b);
            })
            .map((typeName) => {
            const items = groupedItems[typeName];
            const isExpanded = expandedSections.has(typeName);
            const selectedInSection = isToggleMode 
              ? items.filter(item => selectedIds.has(item.id)).length 
              : 0;
            const completedInSection = completedIds 
              ? items.filter(item => completedIds.has(item.id)).length 
              : 0;
            
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
                    <div className="flex items-center gap-2">
                      {completedInSection > 0 && (
                        <span className="text-sm px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                          {completedInSection} done
                        </span>
                      )}
                      {selectedInSection > 0 && (
                        <span className="text-sm px-2 py-0.5 rounded-full bg-green-500/20 text-green-600 dark:text-green-400 font-medium">
                          {selectedInSection} selected
                        </span>
                      )}
                      <span className={cn(
                        "text-sm px-2.5 py-1 rounded-full",
                        isExpanded 
                          ? "bg-primary/20 text-primary font-medium" 
                          : "bg-muted text-muted-foreground"
                      )}>
                        {items.length}
                      </span>
                    </div>
                  </button>
                </CollapsibleTrigger>

                {/* Section Content */}
                <CollapsibleContent>
                  <div className={cn(
                    "border-2 border-t-0 border-primary rounded-b-lg p-3 bg-card"
                  )}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {items.map((item) => {
                        const isSelected = isToggleMode && selectedIds.has(item.id);
                        const isCompleted = completedIds?.has(item.id);
                        
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleItemClick(item)}
                            disabled={isCompleted}
                            className={cn(
                              "relative flex items-center justify-center p-4 min-h-[64px] rounded-lg",
                              "transition-all duration-150 touch-manipulation",
                              isCompleted
                                ? "bg-muted/50 border-2 border-muted cursor-not-allowed opacity-60"
                                : isSelected
                                  ? "bg-green-500/10 border-2 border-green-500 dark:border-green-400"
                                  : "bg-background border-2 border-border hover:border-primary hover:bg-accent",
                              !isCompleted && "active:scale-95"
                            )}
                          >
                            {isCompleted && (
                              <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-muted-foreground/20 text-muted-foreground text-[10px] font-medium uppercase">
                                Done
                              </div>
                            )}
                            {isSelected && !isCompleted && (
                              <div className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                                <Check className="h-3 w-3 text-white" />
                              </div>
                            )}
                            <span className={cn(
                              "font-mono text-xl font-bold",
                              isCompleted 
                                ? "text-muted-foreground" 
                                : isSelected 
                                  ? "text-green-600 dark:text-green-400" 
                                  : "text-foreground"
                            )}>
                              {item.identifier}
                            </span>
                          </button>
                        );
                      })}
                      
                      {/* Add Vehicle Button */}
                      {onAddVehicle && (
                        <button
                          onClick={() => onAddVehicle(typeName)}
                          className={cn(
                            "flex items-center justify-center gap-1 p-4 min-h-[64px] rounded-lg",
                            "border-2 border-dashed border-muted-foreground/30",
                            "hover:border-primary hover:bg-accent text-muted-foreground hover:text-primary",
                            "transition-all duration-150 touch-manipulation active:scale-95"
                          )}
                        >
                          <Plus className="h-5 w-5" />
                          <span className="text-sm font-medium">Add</span>
                        </button>
                      )}
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
