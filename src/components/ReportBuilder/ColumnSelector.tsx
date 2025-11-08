import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { GripVertical, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UNIFIED_COLUMNS } from '@/lib/reportBuilder';

interface ColumnSelectorProps {
  selectedColumns: string[];
  onColumnsChange: (columns: string[]) => void;
}

interface SortableItemProps {
  id: string;
  label: string;
  onRemove: (id: string) => void;
}

function SortableItem({ id, label, onRemove }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 bg-muted rounded-md border"
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <span className="flex-1 text-sm">{label}</span>
      <Checkbox
        checked={true}
        onCheckedChange={() => onRemove(id)}
        className="ml-auto"
      />
    </div>
  );
}

export function ColumnSelector({ selectedColumns, onColumnsChange }: ColumnSelectorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Group columns by category
  const categorizedColumns = UNIFIED_COLUMNS.reduce((acc, col) => {
    if (!acc[col.category]) {
      acc[col.category] = [];
    }
    acc[col.category].push(col);
    return acc;
  }, {} as Record<string, typeof UNIFIED_COLUMNS>);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = selectedColumns.indexOf(active.id as string);
      const newIndex = selectedColumns.indexOf(over.id as string);
      onColumnsChange(arrayMove(selectedColumns, oldIndex, newIndex));
    }
  };

  const toggleColumn = (columnId: string) => {
    if (selectedColumns.includes(columnId)) {
      onColumnsChange(selectedColumns.filter(id => id !== columnId));
    } else {
      onColumnsChange([...selectedColumns, columnId]);
    }
  };

  // Detect report type
  const hasAggregateFields = selectedColumns.some(col =>
    UNIFIED_COLUMNS.find(c => c.id === col)?.isAggregate
  );
  const hasDetailFields = selectedColumns.some(col =>
    !UNIFIED_COLUMNS.find(c => c.id === col)?.isAggregate
  );
  const isMixedMode = hasAggregateFields && hasDetailFields;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-2">Column Selection</h3>
        
        {isMixedMode && (
          <Alert className="mb-3">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              This report will include both detail rows and aggregate summaries in separate sections.
            </AlertDescription>
          </Alert>
        )}

        {selectedColumns.length > 0 && (
          <div className="mb-4">
            <Label className="text-xs text-muted-foreground mb-2 block">
              Selected Fields (drag to reorder)
            </Label>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={selectedColumns}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1">
                  {selectedColumns.map(colId => {
                    const col = UNIFIED_COLUMNS.find(c => c.id === colId);
                    return col ? (
                      <SortableItem
                        key={colId}
                        id={colId}
                        label={col.label}
                        onRemove={toggleColumn}
                      />
                    ) : null;
                  })}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}
      </div>

      <div>
        <Label className="text-xs text-muted-foreground mb-2 block">
          Available Fields
        </Label>
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
          {Object.entries(categorizedColumns).map(([category, columns]) => (
            <div key={category}>
              <div className="text-xs font-semibold text-muted-foreground mb-1.5">
                {category}
              </div>
              <div className="space-y-1.5">
                {columns.map(col => (
                  <div key={col.id} className="flex items-center gap-2">
                    <Checkbox
                      id={col.id}
                      checked={selectedColumns.includes(col.id)}
                      onCheckedChange={() => toggleColumn(col.id)}
                    />
                    <Label
                      htmlFor={col.id}
                      className="text-sm cursor-pointer flex-1"
                    >
                      {col.label}
                      {col.isAggregate && (
                        <span className="ml-1 text-xs text-muted-foreground">(aggregate)</span>
                      )}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
