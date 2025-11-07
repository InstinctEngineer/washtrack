import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, ArrowRight, CalendarIcon, Download, Save, FileSpreadsheet, DollarSign, Users } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ReportConfig, ReportType, executeReport, getColumnsByReportType } from '@/lib/reportBuilder';
import { exportToExcel } from '@/lib/excelExporter';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ReportBuilderWizardProps {
  open: boolean;
  onClose: () => void;
  onSave?: () => void;
}

interface SelectOption {
  value: string;
  label: string;
}

export function ReportBuilderWizard({ open, onClose, onSave }: ReportBuilderWizardProps) {
  const [step, setStep] = useState(1);
  const [reportConfig, setReportConfig] = useState<ReportConfig>({
    reportType: 'unified',
    columns: [],
    filters: [],
    sorting: [{ field: 'wash_date', direction: 'desc' }],
  });
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [clients, setClients] = useState<SelectOption[]>([]);
  const [locations, setLocations] = useState<SelectOption[]>([]);
  const [employees, setEmployees] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');

  const totalSteps = 4;
  const currentColumns = getColumnsByReportType(reportConfig.reportType);
  
  // Group columns by category
  const columnsByCategory = currentColumns.reduce((acc, col) => {
    const category = col.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(col);
    return acc;
  }, {} as Record<string, typeof currentColumns>);

  useEffect(() => {
    if (open) {
      fetchFilterOptions();
    }
  }, [open]);

  const fetchFilterOptions = async () => {
    try {
      const [clientsRes, locationsRes, employeesRes] = await Promise.all([
        supabase.from('clients').select('id, client_name').eq('is_active', true).order('client_name'),
        supabase.from('locations').select('id, name').eq('is_active', true).order('name'),
        supabase.from('users').select('id, name, employee_id').eq('is_active', true).order('name'),
      ]);

      if (clientsRes.data) {
        setClients(clientsRes.data.map(c => ({ value: c.id, label: c.client_name })));
      }
      if (locationsRes.data) {
        setLocations(locationsRes.data.map(l => ({ value: l.id, label: l.name })));
      }
      if (employeesRes.data) {
        setEmployees(employeesRes.data.map(e => ({ value: e.id, label: `${e.name} (${e.employee_id})` })));
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  const handleNext = async () => {
    if (step === 3) {
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
      columns: currentColumns.map(c => c.id)
    }));
  };
  
  const clearAllColumns = () => {
    setReportConfig(prev => ({ ...prev, columns: [] }));
  };

  const applyFilters = () => {
    const newFilters = [];

    // Date filter
    if (dateRange.from && dateRange.to) {
      newFilters.push({
        field: 'wash_date',
        operator: 'between' as const,
        value: [format(dateRange.from, 'yyyy-MM-dd'), format(dateRange.to, 'yyyy-MM-dd')]
      });
    }

    // Client filter
    if (selectedClients.length > 0) {
      newFilters.push({
        field: 'client_id',
        operator: 'in' as const,
        value: selectedClients
      });
    }

    // Location filter
    if (selectedLocations.length > 0) {
      newFilters.push({
        field: 'location_id',
        operator: 'in' as const,
        value: selectedLocations
      });
    }

    // Employee filter
    if (selectedEmployees.length > 0) {
      newFilters.push({
        field: 'employee_id',
        operator: 'in' as const,
        value: selectedEmployees
      });
    }

    setReportConfig(prev => ({ ...prev, filters: newFilters }));
    toast.success('Filters applied');
  };

  const generatePreview = async () => {
    setLoading(true);
    try {
      const data = await executeReport(reportConfig);
      setPreviewData(data.slice(0, 50));
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
      
      // Determine which columns should have sum rows based on selected columns
      const sumColumns: string[] = [];
      if (reportConfig.columns.includes('final_amount')) {
        sumColumns.push('Final Amount ($)');
      }
      if (reportConfig.columns.includes('total_revenue')) {
        sumColumns.push('Total Revenue ($)');
      }
      if (reportConfig.columns.includes('total_washes')) {
        sumColumns.push('Total Washes');
      }

      exportToExcel(
        data, 
        templateName || 'custom-report',
        'Report',
        { addSumRow: sumColumns.length > 0, sumColumns }
      );
      
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
            {step === 1 ? `Step 1 of ${totalSteps}: Select Data Fields` :
             step === 2 ? `Step 2 of ${totalSteps}: Apply Filters` :
             step === 3 ? `Step 3 of ${totalSteps}: Preview & Export` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Step 1: Column Selection */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex gap-2 mb-4">
                <Button onClick={selectAllColumns} variant="outline" size="sm">
                  Select All Fields
                </Button>
                <Button onClick={clearAllColumns} variant="outline" size="sm">
                  Clear All
                </Button>
              </div>
              
              <div className="space-y-6">
                {Object.entries(columnsByCategory).map(([category, columns]) => (
                  <div key={category} className="space-y-3">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                      {category}
                    </h3>
                    <div className="grid grid-cols-2 gap-3 pl-2">
                      {columns.map((column) => (
                        <div key={column.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={column.id}
                            checked={reportConfig.columns.includes(column.id)}
                            onCheckedChange={() => toggleColumn(column.id)}
                          />
                          <Label
                            htmlFor={column.id}
                            className="cursor-pointer flex items-center gap-1"
                          >
                            {column.label}
                            {column.isAggregate && (
                              <span className="text-xs text-muted-foreground">(calculated)</span>
                            )}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              
              <p className="text-sm text-muted-foreground mt-4">
                Select any combination of fields. Calculated fields will aggregate data automatically.
              </p>
            </div>
          )}

          {/* Step 2: Filters */}
          {step === 2 && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Date Range</CardTitle>
                  <CardDescription>Filter by date range</CardDescription>
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Filter by Client</CardTitle>
                  <CardDescription>Select one or more clients (optional)</CardDescription>
                </CardHeader>
                    <CardContent>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {clients.map((client) => (
                          <div key={client.value} className="flex items-center space-x-2">
                            <Checkbox
                              id={`client-${client.value}`}
                              checked={selectedClients.includes(client.value)}
                              onCheckedChange={(checked) => {
                                setSelectedClients(prev => 
                                  checked 
                                    ? [...prev, client.value]
                                    : prev.filter(id => id !== client.value)
                                );
                              }}
                            />
                            <Label htmlFor={`client-${client.value}`} className="cursor-pointer">
                              {client.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Filter by Location</CardTitle>
                      <CardDescription>Select one or more locations (optional)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {locations.map((location) => (
                          <div key={location.value} className="flex items-center space-x-2">
                            <Checkbox
                              id={`location-${location.value}`}
                              checked={selectedLocations.includes(location.value)}
                              onCheckedChange={(checked) => {
                                setSelectedLocations(prev => 
                                  checked 
                                    ? [...prev, location.value]
                                    : prev.filter(id => id !== location.value)
                                );
                              }}
                            />
                            <Label htmlFor={`location-${location.value}`} className="cursor-pointer">
                              {location.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Filter by Employee</CardTitle>
                      <CardDescription>Select one or more employees (optional)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {employees.map((employee) => (
                          <div key={employee.value} className="flex items-center space-x-2">
                            <Checkbox
                              id={`employee-${employee.value}`}
                              checked={selectedEmployees.includes(employee.value)}
                              onCheckedChange={(checked) => {
                                setSelectedEmployees(prev => 
                                  checked 
                                    ? [...prev, employee.value]
                                    : prev.filter(id => id !== employee.value)
                                );
                              }}
                            />
                            <Label htmlFor={`employee-${employee.value}`} className="cursor-pointer">
                              {employee.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

              <Button onClick={applyFilters} className="w-full">
                Apply All Filters
              </Button>
            </div>
          )}

          {/* Step 3: Preview & Export */}
          {step === 3 && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Sort Order</CardTitle>
                  <CardDescription>Configure how data should be sorted</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Primary Sort Field</Label>
                    <Select 
                      value={reportConfig.sorting[0]?.field || 'wash_date'}
                      onValueChange={(value) => {
                        setReportConfig(prev => ({
                          ...prev,
                          sorting: [
                            { field: value, direction: prev.sorting[0]?.direction || 'desc' },
                            ...(prev.sorting[1] ? [prev.sorting[1]] : [])
                          ]
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currentColumns.slice(0, 5).map(col => (
                          <SelectItem key={col.id} value={col.id}>{col.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Primary Direction</Label>
                    <Select 
                      value={reportConfig.sorting[0]?.direction || 'desc'}
                      onValueChange={(value: 'asc' | 'desc') => {
                        setReportConfig(prev => ({
                          ...prev,
                          sorting: [
                            { field: prev.sorting[0]?.field || 'wash_date', direction: value },
                            ...(prev.sorting[1] ? [prev.sorting[1]] : [])
                          ]
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asc">Ascending (A-Z, 0-9, Old-New)</SelectItem>
                        <SelectItem value="desc">Descending (Z-A, 9-0, New-Old)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {reportConfig.sorting.length < 2 && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        const availableFields = currentColumns.filter(
                          c => c.id !== reportConfig.sorting[0]?.field
                        );
                        if (availableFields.length > 0) {
                          setReportConfig(prev => ({
                            ...prev,
                            sorting: [
                              ...prev.sorting,
                              { field: availableFields[0].id, direction: 'asc' }
                            ]
                          }));
                        }
                      }}
                    >
                      + Add Secondary Sort
                    </Button>
                  )}

                  {reportConfig.sorting.length > 1 && (
                    <>
                      <div className="border-t pt-4 space-y-2">
                        <Label>Secondary Sort Field</Label>
                        <Select 
                          value={reportConfig.sorting[1]?.field}
                          onValueChange={(value) => {
                            setReportConfig(prev => ({
                              ...prev,
                              sorting: [
                                prev.sorting[0],
                                { field: value, direction: prev.sorting[1]?.direction || 'asc' }
                              ]
                            }));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {currentColumns.filter(c => c.id !== reportConfig.sorting[0]?.field).map(col => (
                              <SelectItem key={col.id} value={col.id}>{col.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Secondary Direction</Label>
                        <Select 
                          value={reportConfig.sorting[1]?.direction || 'asc'}
                          onValueChange={(value: 'asc' | 'desc') => {
                            setReportConfig(prev => ({
                              ...prev,
                              sorting: [
                                prev.sorting[0],
                                { field: prev.sorting[1]?.field, direction: value }
                              ]
                            }));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="asc">Ascending</SelectItem>
                            <SelectItem value="desc">Descending</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setReportConfig(prev => ({
                            ...prev,
                            sorting: [prev.sorting[0]]
                          }));
                        }}
                      >
                        Remove Secondary Sort
                      </Button>
                    </>
                  )}
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
                    {loading ? 'Generating preview...' : `Showing first ${Math.min(previewData.length, 50)} rows`}
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
                          <tr className="border-b bg-muted/50">
                            {Object.keys(previewData[0]).map((key) => (
                              <th key={key} className="text-left p-2 font-semibold">
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.slice(0, 10).map((row, idx) => (
                            <tr key={idx} className="border-b hover:bg-muted/30">
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
            <Button onClick={handleBack} variant="outline" disabled={step === 0}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex gap-2">
              {step === 4 ? (
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
              ) : step > 0 ? (
                <Button onClick={handleNext} disabled={loading}>
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : null}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
