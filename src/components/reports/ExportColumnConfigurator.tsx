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
import { GripVertical, Plus, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface ExportColumn {
  id: string;
  fieldKey: string;
  headerName: string;
  firstRowOnly: boolean;
}

export interface AvailableField {
  key: string;
  label: string;
  description: string;
  defaultHeader: string;
  suggestFirstRowOnly?: boolean;
}

export const AVAILABLE_FIELDS: AvailableField[] = [
  { key: 'invoice_number', label: 'Invoice Number', description: 'Auto-generated invoice ID', defaultHeader: '*InvoiceNo', suggestFirstRowOnly: true },
  { key: 'client_name', label: 'Client Name', description: 'Customer/Client name', defaultHeader: '*Customer', suggestFirstRowOnly: true },
  { key: 'location_name', label: 'Location Name', description: 'Work location', defaultHeader: 'Location' },
  { key: 'invoice_date', label: 'Invoice Date', description: 'Date of invoice', defaultHeader: '*InvoiceDate', suggestFirstRowOnly: true },
  { key: 'due_date', label: 'Due Date', description: 'Payment due date', defaultHeader: '*DueDate', suggestFirstRowOnly: true },
  { key: 'terms', label: 'Terms', description: 'Payment terms (e.g., Net 30)', defaultHeader: 'Terms', suggestFirstRowOnly: true },
  { key: 'work_type_name', label: 'Work Type', description: 'Type of service performed', defaultHeader: 'Item(Product/Service)' },
  { key: 'item_description', label: 'Item Description', description: 'Description of line item', defaultHeader: 'ItemDescription' },
  { key: 'quantity', label: 'Quantity', description: 'Total quantity for line', defaultHeader: 'ItemQuantity' },
  { key: 'rate', label: 'Rate', description: 'Price per unit', defaultHeader: 'ItemRate' },
  { key: 'line_total', label: 'Line Total', description: 'Quantity × Rate', defaultHeader: '*ItemAmount' },
  { key: 'class', label: 'Class', description: 'Accounting class/category', defaultHeader: 'Class', suggestFirstRowOnly: true },
  { key: 'contact_email', label: 'Contact Email', description: 'Client email address', defaultHeader: 'Email', suggestFirstRowOnly: true },
  { key: 'taxable', label: 'Taxable', description: 'Y/N for tax status', defaultHeader: 'Taxable' },
  { key: 'tax_jurisdiction', label: 'Tax Rate/Jurisdiction', description: 'Tax jurisdiction code', defaultHeader: 'TaxRate' },
  { key: 'frequency', label: 'Frequency', description: 'Service frequency', defaultHeader: 'Frequency' },
];

interface SortableColumnProps {
  column: ExportColumn;
  onRemove: (id: string) => void;
  onHeaderChange: (id: string, header: string) => void;
  onFirstRowOnlyChange: (id: string, value: boolean) => void;
}

function SortableColumn({ column, onRemove, onHeaderChange, onFirstRowOnlyChange }: SortableColumnProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const field = AVAILABLE_FIELDS.find((f) => f.key === column.fieldKey);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 p-3 bg-card border rounded-lg',
        isDragging && 'opacity-50 shadow-lg'
      )}
    >
      <button {...attributes} {...listeners} className="cursor-grab touch-none">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Input
            value={column.headerName}
            onChange={(e) => onHeaderChange(column.id, e.target.value)}
            className="h-8 text-sm"
            placeholder="Column header"
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onRemove(column.id)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{field?.label}</span>
          <div className="flex items-center gap-2">
            <Checkbox
              id={`first-row-${column.id}`}
              checked={column.firstRowOnly}
              onCheckedChange={(checked) => onFirstRowOnlyChange(column.id, checked === true)}
            />
            <label htmlFor={`first-row-${column.id}`} className="cursor-pointer">
              First row only
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ExportColumnConfiguratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: ExportColumn[];
  onColumnsChange: (columns: ExportColumn[]) => void;
}

export function ExportColumnConfigurator({
  open,
  onOpenChange,
  columns,
  onColumnsChange,
}: ExportColumnConfiguratorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const usedFieldKeys = columns.map((c) => c.fieldKey);
  const availableFields = AVAILABLE_FIELDS.filter((f) => !usedFieldKeys.includes(f.key));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = columns.findIndex((c) => c.id === active.id);
      const newIndex = columns.findIndex((c) => c.id === over.id);
      onColumnsChange(arrayMove(columns, oldIndex, newIndex));
    }
  };

  const addColumn = (field: AvailableField) => {
    const newColumn: ExportColumn = {
      id: `${field.key}-${Date.now()}`,
      fieldKey: field.key,
      headerName: field.defaultHeader,
      firstRowOnly: field.suggestFirstRowOnly || false,
    };
    onColumnsChange([...columns, newColumn]);
  };

  const removeColumn = (id: string) => {
    onColumnsChange(columns.filter((c) => c.id !== id));
  };

  const updateHeader = (id: string, header: string) => {
    onColumnsChange(
      columns.map((c) => (c.id === id ? { ...c, headerName: header } : c))
    );
  };

  const updateFirstRowOnly = (id: string, value: boolean) => {
    onColumnsChange(
      columns.map((c) => (c.id === id ? { ...c, firstRowOnly: value } : c))
    );
  };

  const applyQuickBooksTemplate = () => {
    const qbColumns: ExportColumn[] = [
      { id: 'qb-1', fieldKey: 'invoice_number', headerName: '*InvoiceNo', firstRowOnly: true },
      { id: 'qb-2', fieldKey: 'client_name', headerName: '*Customer', firstRowOnly: true },
      { id: 'qb-3', fieldKey: 'invoice_date', headerName: '*InvoiceDate', firstRowOnly: true },
      { id: 'qb-4', fieldKey: 'due_date', headerName: '*DueDate', firstRowOnly: true },
      { id: 'qb-5', fieldKey: 'terms', headerName: 'Terms', firstRowOnly: true },
      { id: 'qb-6', fieldKey: 'work_type_name', headerName: 'Item(Product/Service)', firstRowOnly: false },
      { id: 'qb-7', fieldKey: 'item_description', headerName: 'ItemDescription', firstRowOnly: false },
      { id: 'qb-8', fieldKey: 'quantity', headerName: 'ItemQuantity', firstRowOnly: false },
      { id: 'qb-9', fieldKey: 'rate', headerName: 'ItemRate', firstRowOnly: false },
      { id: 'qb-10', fieldKey: 'line_total', headerName: '*ItemAmount', firstRowOnly: false },
      { id: 'qb-11', fieldKey: 'class', headerName: 'Class', firstRowOnly: true },
      { id: 'qb-12', fieldKey: 'contact_email', headerName: 'Email', firstRowOnly: true },
      { id: 'qb-13', fieldKey: 'taxable', headerName: 'Taxable', firstRowOnly: false },
      { id: 'qb-14', fieldKey: 'tax_jurisdiction', headerName: 'TaxRate', firstRowOnly: false },
    ];
    onColumnsChange(qbColumns);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Configure Export Columns</DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 h-[60vh]">
          {/* Available Fields */}
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Available Fields</h3>
              <Button variant="outline" size="sm" onClick={applyQuickBooksTemplate}>
                QuickBooks Template
              </Button>
            </div>
            <ScrollArea className="flex-1 border rounded-lg p-2">
              <div className="space-y-2">
                {availableFields.map((field) => (
                  <button
                    key={field.key}
                    onClick={() => addColumn(field)}
                    className="w-full flex items-center gap-2 p-2 text-left hover:bg-accent rounded-md transition-colors"
                  >
                    <Plus className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{field.label}</div>
                      <div className="text-xs text-muted-foreground">{field.description}</div>
                    </div>
                  </button>
                ))}
                {availableFields.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    All fields have been added
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Export Columns */}
          <div className="flex-1 flex flex-col">
            <h3 className="text-sm font-medium mb-2">
              Export Columns ({columns.length})
            </h3>
            <ScrollArea className="flex-1 border rounded-lg p-2">
              {columns.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Add fields from the left panel
                </p>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={columns.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {columns.map((column) => (
                        <SortableColumn
                          key={column.id}
                          column={column}
                          onRemove={removeColumn}
                          onHeaderChange={updateHeader}
                          onFirstRowOnlyChange={updateFirstRowOnly}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onOpenChange(false)}>
            <Check className="h-4 w-4 mr-2" />
            Apply Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
