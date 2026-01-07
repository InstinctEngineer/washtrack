import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Package, ChevronRight, ChevronDown, Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { subDays } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const isMobile = useIsMobile();
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
        
        // Fetch last wash dates for all work items
        const workItemIds = perUnitItems.map(item => item.id);
        const thirtyDaysAgo = subDays(new Date(), 30).toISOString().split('T')[0];
        
        // Get the most recent work_log for each work_item
        const { data: recentLogs } = await supabase
          .from('work_logs')
          .select('work_item_id, work_date')
          .in('work_item_id', workItemIds)
          .gte('work_date', thirtyDaysAgo);
        
        // Create a set of work_item_ids that have been washed in the last 30 days
        const activeWorkItemIds = new Set(recentLogs?.map(log => log.work_item_id) || []);
        
        // Filter to only include vehicles washed within 30 days
        const activeItems = perUnitItems.filter(item => activeWorkItemIds.has(item.id));
        
        // Custom sort: PUD first, then alphabetical by type, then by identifier
        activeItems.sort((a, b) => {
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
        
        setWorkItems(activeItems);
        
        // Auto-expand first section
        const firstType = activeItems[0]?.rate_config.work_type.name;
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
        <Search className={cn(
          "absolute top-1/2 -translate-y-1/2 text-muted-foreground",
          isMobile ? "left-3 h-4 w-4" : "left-4 h-5 w-5"
        )} />
        <Input
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={cn(isMobile ? "pl-10 h-10 text-sm" : "pl-12 h-12 text-base")}
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
                      "w-full flex items-center justify-between rounded-lg transition-all duration-200",
                      "active:scale-[0.98] touch-manipulation",
                      isMobile ? "p-3 min-h-[48px]" : "p-4 min-h-[56px]",
                      isExpanded 
                        ? "bg-primary/10 border-2 border-primary rounded-b-none" 
                        : "bg-muted/50 border border-border hover:bg-muted/80"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className={cn("text-primary shrink-0", isMobile ? "h-4 w-4" : "h-5 w-5")} />
                      ) : (
                        <ChevronRight className={cn("text-muted-foreground shrink-0", isMobile ? "h-4 w-4" : "h-5 w-5")} />
                      )}
                      <span className={cn(
                        isMobile ? "text-sm" : "text-base",
                        isExpanded ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
                      )}>
                        {typeName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {completedInSection > 0 && (
                        <span className={cn(
                          "px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium",
                          isMobile ? "text-xs" : "text-sm"
                        )}>
                          {completedInSection} done
                        </span>
                      )}
                      {selectedInSection > 0 && (
                        <span className={cn(
                          "px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-600 dark:text-green-400 font-medium",
                          isMobile ? "text-xs" : "text-sm"
                        )}>
                          {selectedInSection}
                        </span>
                      )}
                      <span className={cn(
                        "px-2 py-0.5 rounded-full",
                        isMobile ? "text-xs" : "text-sm",
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
                    "border-2 border-t-0 border-primary rounded-b-lg bg-card",
                    isMobile ? "p-2" : "p-3"
                  )}>
                    <div className={cn(
                      "grid gap-2",
                      isMobile ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
                    )}>
                      {items.map((item, itemIndex) => {
                        const isSelected = isToggleMode && selectedIds.has(item.id);
                        const isCompleted = completedIds?.has(item.id);
                        // Add data-demo attribute to the first non-completed item for the guided tour
                        const isFirstSelectable = itemIndex === items.findIndex(i => !completedIds?.has(i.id));
                        
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleItemClick(item)}
                            disabled={isCompleted}
                            data-demo={isFirstSelectable && !isCompleted ? "vehicle-card" : undefined}
                            className={cn(
                              "relative flex items-center justify-center rounded-lg",
                              "transition-all duration-150 touch-manipulation",
                              isMobile ? "p-3 min-h-[56px]" : "p-4 min-h-[64px]",
                              isCompleted
                                ? "bg-muted/50 border-2 border-muted cursor-not-allowed opacity-60"
                                : isSelected
                                  ? "bg-green-500/10 border-2 border-green-500 dark:border-green-400"
                                  : "bg-background border-2 border-border hover:border-primary hover:bg-accent",
                              !isCompleted && "active:scale-95"
                            )}
                          >
                            {isCompleted && (
                              <div className="absolute top-1 right-1 px-1 py-0.5 rounded bg-muted-foreground/20 text-muted-foreground text-[9px] font-medium uppercase">
                                Done
                              </div>
                            )}
                            {isSelected && !isCompleted && (
                              <div className={cn(
                                "absolute top-1 right-1 rounded-full bg-green-500 flex items-center justify-center",
                                isMobile ? "h-4 w-4" : "h-5 w-5"
                              )}>
                                <Check className={isMobile ? "h-2.5 w-2.5 text-white" : "h-3 w-3 text-white"} />
                              </div>
                            )}
                            <span className={cn(
                              "font-mono font-bold",
                              isMobile ? "text-lg" : "text-xl",
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
                            "flex items-center justify-center gap-1 rounded-lg",
                            "border-2 border-dashed border-muted-foreground/30",
                            "hover:border-primary hover:bg-accent text-muted-foreground hover:text-primary",
                            "transition-all duration-150 touch-manipulation active:scale-95",
                            isMobile ? "p-3 min-h-[56px]" : "p-4 min-h-[64px]"
                          )}
                        >
                          <Plus className={isMobile ? "h-4 w-4" : "h-5 w-5"} />
                          <span className={cn("font-medium", isMobile ? "text-xs" : "text-sm")}>Add</span>
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
