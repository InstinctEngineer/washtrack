import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, ArrowRight, CalendarIcon, Download, Save } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ReportConfig, WASH_ENTRIES_COLUMNS, executeReport } from '@/lib/reportBuilder';
import { exportToExcel } from '@/lib/excelExporter';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ReportBuilderWizardProps {
  open: boolean;
  onClose: () => void;
  onSave?: () => void;
}

export function ReportBuilderWizard({ open, onClose, onSave }: ReportBuilderWizardProps) {
  const [step, setStep] = useState(1);
  const [reportConfig, setReportConfig] = useState<ReportConfig>({
    reportType: 'wash_entries',
    columns: ['wash_date', 'vehicle_number', 'client_name', 'vehicle_type', 'location_name', 'employee_name'],
    filters: [],
    sorting: [{ field: 'wash_date', direction: 'desc' }],
  });
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');

  const totalSteps = 4;

  const handleNext = async () => {
    if (step === 3) {
      // Generate preview before going to final step
      await generatePreview();
    }
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const toggleColumn = (columnId: string) => {
    const column = WASH_ENTRIES_COLUMNS.find(c => c.id === columnId);
    if (column?.required) return; // Can't uncheck required columns
    
    setReportConfig(prev => ({
      ...prev,
      columns: prev.columns.includes(columnId)
        ? prev.columns.filter(c => c !== columnId)
        : [...prev.columns, columnId]
    }));
  };

  const selectAllColumns = () => {
    setReportConfig(prev => ({
      ...prev,
      columns: WASH_ENTRIES_COLUMNS.map(c => c.id)
    }));
  };

  const selectCommonColumns = () => {
    setReportConfig(prev => ({
      ...prev,
      columns: ['wash_date', 'vehicle_number', 'client_name', 'vehicle_type', 'rate_per_wash', 'location_name', 'employee_name']
    }));
  };

  const applyDateFilter = () => {
    if (dateRange.from && dateRange.to) {
      const newFilters = reportConfig.filters.filter(f => f.field !== 'wash_date');
      newFilters.push({
        field: 'wash_date',
        operator: 'between',
        value: [format(dateRange.from, 'yyyy-MM-dd'), format(dateRange.to, 'yyyy-MM-dd')]
      });
      setReportConfig(prev => ({ ...prev, filters: newFilters }));
      toast.success('Date filter applied');
    }
  };

  const generatePreview = async () => {
    setLoading(true);
    try {
      const data = await executeReport(reportConfig);
      setPreviewData(data.slice(0, 50)); // Show first 50 rows
    } catch (error) {
      console.error('Error generating preview:', error);
      toast.error('Failed to generate preview');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      const data = await executeReport(reportConfig);
      exportToExcel(data, 'wash_entries_report', 'Wash Entries');
      toast.success('Report exported successfully!');
      onClose();
    } catch (error) {
      console.error('Error exporting report:', error);
      toast.error('Failed to export report');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('report_templates').insert({
        template_name: templateName,
        description: templateDescription || null,
        report_type: reportConfig.reportType,
        config: reportConfig as any,
        created_by: user.id,
      } as any);

      if (error) throw error;

      toast.success('Template saved successfully!');
      onSave?.();
      onClose();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Failed to save template');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Custom Report</DialogTitle>
          <DialogDescription>
            Step {step} of {totalSteps}: {
              step === 1 ? 'Select Columns' :
              step === 2 ? 'Apply Filters' :
              step === 3 ? 'Configure Sorting' :
              'Preview & Export'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Step 1: Column Selection */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex gap-2 mb-4">
                <Button onClick={selectAllColumns} variant="outline" size="sm">
                  Select All
                </Button>
                <Button onClick={selectCommonColumns} variant="outline" size="sm">
                  Select Common
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {WASH_ENTRIES_COLUMNS.map((column) => (
                  <div key={column.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={column.id}
                      checked={reportConfig.columns.includes(column.id)}
                      onCheckedChange={() => toggleColumn(column.id)}
                      disabled={column.required}
                    />
                    <Label
                      htmlFor={column.id}
                      className={cn(
                        "cursor-pointer",
                        column.required && "font-semibold"
                      )}
                    >
                      {column.label}
                      {column.required && ' *'}
                    </Label>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                * Required columns cannot be removed
              </p>
            </div>
          )}

          {/* Step 2: Filters */}
          {step === 2 && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Date Range</CardTitle>
                  <CardDescription>Filter wash entries by date</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>From Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateRange.from ? format(dateRange.from, 'PPP') : 'Pick a date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={dateRange.from}
                            onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label>To Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateRange.to ? format(dateRange.to, 'PPP') : 'Pick a date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={dateRange.to}
                            onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <Button onClick={applyDateFilter} variant="outline" size="sm">
                    Apply Date Filter
                  </Button>
                </CardContent>
              </Card>
              
              <p className="text-sm text-muted-foreground">
                Additional filters (client, location, employee) will be available in future updates
              </p>
            </div>
          )}

          {/* Step 3: Sorting */}
          {step === 3 && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Sort Order</CardTitle>
                  <CardDescription>Configure how data should be sorted</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Primary Sort</Label>
                    <Select 
                      value={reportConfig.sorting[0]?.field || 'wash_date'}
                      onValueChange={(value) => {
                        setReportConfig(prev => ({
                          ...prev,
                          sorting: [{ field: value, direction: prev.sorting[0]?.direction || 'desc' }]
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="wash_date">Date</SelectItem>
                        <SelectItem value="client_name">Client Name</SelectItem>
                        <SelectItem value="vehicle_number">Vehicle Number</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Direction</Label>
                    <Select 
                      value={reportConfig.sorting[0]?.direction || 'desc'}
                      onValueChange={(value: 'asc' | 'desc') => {
                        setReportConfig(prev => ({
                          ...prev,
                          sorting: [{ field: prev.sorting[0]?.field || 'wash_date', direction: value }]
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asc">Ascending (A-Z, 0-9)</SelectItem>
                        <SelectItem value="desc">Descending (Z-A, 9-0)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 4: Preview & Export */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
                <div className="space-y-2">
                  <Label htmlFor="templateName">Template Name (Optional)</Label>
                  <Input
                    id="templateName"
                    placeholder="e.g., Weekly Client Summary"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="templateDescription">Description (Optional)</Label>
                  <Input
                    id="templateDescription"
                    placeholder="Brief description of this report"
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                  />
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Preview</CardTitle>
                  <CardDescription>
                    Showing first {Math.min(previewData.length, 50)} rows
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Generating preview...
                    </div>
                  ) : previewData.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            {Object.keys(previewData[0]).map((key) => (
                              <th key={key} className="text-left p-2 font-semibold">
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.slice(0, 10).map((row, idx) => (
                            <tr key={idx} className="border-b">
                              {Object.values(row).map((value: any, i) => (
                                <td key={i} className="p-2">
                                  {String(value)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No data matches your filters
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <DialogFooter>
          <div className="flex justify-between w-full">
            <Button onClick={handleBack} variant="outline" disabled={step === 1}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex gap-2">
              {step === totalSteps ? (
                <>
                  {templateName && (
                    <Button onClick={handleSaveTemplate} variant="outline" disabled={loading}>
                      <Save className="h-4 w-4 mr-2" />
                      Save Template
                    </Button>
                  )}
                  <Button onClick={handleExport} disabled={loading || previewData.length === 0}>
                    <Download className="h-4 w-4 mr-2" />
                    Export to Excel
                  </Button>
                </>
              ) : (
                <Button onClick={handleNext} disabled={loading}>
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
