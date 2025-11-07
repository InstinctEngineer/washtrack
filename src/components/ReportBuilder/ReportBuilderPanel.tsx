import { useState, useEffect } from 'react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Save, CalendarIcon } from 'lucide-react';
import { ColumnSelector } from './ColumnSelector';
import { FilterPanel } from './FilterPanel';
import { LiveReportPreview } from './LiveReportPreview';
import { ReportConfig, UNIFIED_COLUMNS } from '@/lib/reportBuilder';
import { exportToExcel } from '@/lib/excelExporter';
import { executeReport } from '@/lib/reportBuilder';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ReportBuilderPanelProps {
  open: boolean;
  onClose: () => void;
  onSave?: () => void;
}

export function ReportBuilderPanel({ open, onClose, onSave }: ReportBuilderPanelProps) {
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Calculate current week dates
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 0 }); // Sunday
  const weekEnd = endOfWeek(today, { weekStartsOn: 0 }); // Saturday
  
  const [dateFrom, setDateFrom] = useState(format(weekStart, 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(weekEnd, 'yyyy-MM-dd'));

  // Reset dates to current week when dialog opens
  useEffect(() => {
    if (open) {
      const today = new Date();
      const weekStart = startOfWeek(today, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 0 });
      setDateFrom(format(weekStart, 'yyyy-MM-dd'));
      setDateTo(format(weekEnd, 'yyyy-MM-dd'));
    }
  }, [open]);

  const buildReportConfig = (): ReportConfig => {
    const filters: ReportConfig['filters'] = [];

    if (dateFrom || dateTo) {
      filters.push({
        field: 'wash_date',
        operator: 'between',
        value: [dateFrom || '1900-01-01', dateTo || '2099-12-31'],
      });
    }

    if (selectedClients.length > 0) {
      filters.push({
        field: 'client_id',
        operator: 'in',
        value: selectedClients,
      });
    }

    if (selectedLocations.length > 0) {
      filters.push({
        field: 'location_id',
        operator: 'in',
        value: selectedLocations,
      });
    }

    if (selectedEmployees.length > 0) {
      filters.push({
        field: 'employee_id',
        operator: 'in',
        value: selectedEmployees,
      });
    }

    return {
      reportType: 'unified',
      columns: selectedColumns,
      filters,
      sorting: [{ field: 'wash_date', direction: 'desc' }],
    };
  };

  const handleExport = async () => {
    if (selectedColumns.length === 0) {
      toast.error('Please select at least one column');
      return;
    }

    setIsExporting(true);
    try {
      const config = buildReportConfig();
      const data = await executeReport(config);

      if (data.length === 0) {
        toast.warning('No data matches the selected filters');
        setIsExporting(false);
        return;
      }

      // Determine sum columns
      const sumColumns: string[] = [];
      if (selectedColumns.includes('total_revenue')) {
        sumColumns.push('Total Revenue ($)');
      }
      if (selectedColumns.includes('total_washes')) {
        sumColumns.push('Total Washes');
      }
      if (selectedColumns.includes('avg_wash_value')) {
        sumColumns.push('Avg Wash Value ($)');
      }

      const filename = templateName || 'custom-report';
      exportToExcel(data, filename, 'Report Data', {
        addSumRow: sumColumns.length > 0,
        sumColumns,
        columnDefinitions: UNIFIED_COLUMNS
      });
      toast.success(`Report exported successfully (${data.length} rows)`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export report');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    if (selectedColumns.length === 0) {
      toast.error('Please select at least one column');
      return;
    }

    setIsSaving(true);
    try {
      const config = buildReportConfig();
      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase.from('report_templates').insert({
        template_name: templateName,
        description: templateDescription || null,
        report_type: 'unified',
        config: config as any,
        created_by: userData?.user?.id,
        is_system_template: false,
      });

      if (error) throw error;

      toast.success('Report template saved successfully');
      onSave?.();
      onClose();
    } catch (error) {
      console.error('Save template error:', error);
      toast.error('Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearAllFilters = () => {
    setSelectedClients([]);
    setSelectedLocations([]);
    setSelectedEmployees([]);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>Create Custom Report</DialogTitle>
          <DialogDescription>
            Select columns, apply filters, and preview your data before exporting
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel - Configuration */}
          <div className="w-[40%] border-r overflow-y-auto">
            <div className="p-6 space-y-6">
              {/* Date Range - Always at the top */}
              <div className="space-y-2 pb-4 border-b">
                <Label className="text-sm font-semibold">Date Range</Label>
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
                        onSelect={(date) => setDateFrom(date ? format(date, 'yyyy-MM-dd') : '')}
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
                        onSelect={(date) => setDateTo(date ? format(date, 'yyyy-MM-dd') : '')}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <ColumnSelector
                selectedColumns={selectedColumns}
                onColumnsChange={setSelectedColumns}
              />

              <Separator />

              <FilterPanel
                selectedClients={selectedClients}
                selectedLocations={selectedLocations}
                selectedEmployees={selectedEmployees}
                onClientsChange={setSelectedClients}
                onLocationsChange={setSelectedLocations}
                onEmployeesChange={setSelectedEmployees}
                onClearAll={handleClearAllFilters}
              />

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Save as Template (Optional)</h3>
                <div>
                  <Label htmlFor="template-name" className="text-xs">Template Name</Label>
                  <Input
                    id="template-name"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="e.g., Weekly Vehicle Wash Report"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="template-description" className="text-xs">Description</Label>
                  <Textarea
                    id="template-description"
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    placeholder="Optional description..."
                    className="mt-1.5 resize-none"
                    rows={2}
                  />
                </div>
                <Button
                  onClick={handleSaveTemplate}
                  disabled={isSaving || !templateName.trim() || selectedColumns.length === 0}
                  variant="outline"
                  className="w-full"
                  size="sm"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save Template'}
                </Button>
              </div>
            </div>
          </div>

          {/* Right Panel - Live Preview */}
          <div className="w-[60%] flex flex-col">
            <LiveReportPreview
              config={buildReportConfig()}
              onExport={handleExport}
              isExporting={isExporting}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
