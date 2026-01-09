import { useState, useEffect } from 'react';
import { format, startOfWeek, endOfWeek, addDays } from 'date-fns';
import { parseLocalDate } from '@/lib/cutoff';
import { Download, Eye, Settings2, FileSpreadsheet } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

import { ReportDateRangePicker } from '@/components/reports/ReportDateRangePicker';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ReportPreviewTable, ReportDataRow } from '@/components/reports/ReportPreviewTable';
import { ExportColumnConfigurator, ExportColumn, AVAILABLE_FIELDS } from '@/components/reports/ExportColumnConfigurator';
import { TemplateManager, ReportTemplateConfig } from '@/components/reports/TemplateManager';
import { CSVPreviewModal } from '@/components/reports/CSVPreviewModal';

// Default QuickBooks columns
const DEFAULT_COLUMNS: ExportColumn[] = [
  { id: 'qb-1', fieldKey: 'invoice_number', headerName: '*InvoiceNo', firstRowOnly: true },
  { id: 'qb-2', fieldKey: 'client_name', headerName: '*Customer', firstRowOnly: true },
  { id: 'qb-3', fieldKey: 'invoice_date', headerName: '*InvoiceDate', firstRowOnly: true },
  { id: 'qb-4', fieldKey: 'due_date', headerName: '*DueDate', firstRowOnly: true },
  { id: 'qb-5', fieldKey: 'terms', headerName: 'Terms', firstRowOnly: true },
  { id: 'qb-6', fieldKey: 'qb_item_name', headerName: 'Item(Product/Service)', firstRowOnly: false },
  { id: 'qb-7', fieldKey: 'item_description', headerName: 'ItemDescription', firstRowOnly: false },
  { id: 'qb-8', fieldKey: 'quantity', headerName: 'ItemQuantity', firstRowOnly: false },
  { id: 'qb-9', fieldKey: 'rate', headerName: 'ItemRate', firstRowOnly: false },
  { id: 'qb-10', fieldKey: 'line_total', headerName: '*ItemAmount', firstRowOnly: false },
  { id: 'qb-11', fieldKey: 'class', headerName: 'Class', firstRowOnly: true },
  { id: 'qb-12', fieldKey: 'contact_email', headerName: 'Email', firstRowOnly: true },
  { id: 'qb-13', fieldKey: 'taxable', headerName: 'Taxable', firstRowOnly: false },
  { id: 'qb-14', fieldKey: 'tax_jurisdiction', headerName: 'TaxRate', firstRowOnly: false },
];

// Helper: Convert frequency to QuickBooks format with exact spacing
const convertFrequencyToQBFormat = (frequency: string | null, workTypeName: string): string => {
  if (!frequency) return '';
  const freq = frequency.toLowerCase();
  const endsWithLetter = /[a-zA-Z]$/.test(workTypeName);
  
  // 1x weekly: "1 X / Wk" (space before /)
  if (freq === 'weekly' || freq === '1x/week') return '1 X / Wk';
  
  // 2x weekly: spacing depends on work type ending
  if (freq === '2x/week') {
    // Alphabetic work types (PUD): "2 X /Wk" (NO space before /)
    // Numeric work types (W900): "2 X / Wk" (WITH space before /)
    return endsWithLetter ? '2 X /Wk' : '2 X / Wk';
  }
  
  // Monthly: "1 X / MO" (space before /)
  if (freq === 'monthly' || freq === '1x/month') return '1 X / MO';
  if (freq === '2x/month') {
    return endsWithLetter ? '2 X /MO' : '2 X / MO';
  }
  
  return frequency; // Fallback to original
};

// Helper: Check if work type name should be pluralized (ends with letter)
const shouldPluralize = (workTypeName: string): boolean => {
  // Only pluralize if name ends with a letter (not a number)
  // "PUD" → "PUDs" but "W900" stays "W900"
  return /[a-zA-Z]$/.test(workTypeName);
};

// Helper: Build QuickBooks Item name with correct syntax
const buildQBItemName = (
  parentCompany: string | null | undefined,
  clientName: string,
  workTypeName: string,
  rateType: 'per_unit' | 'hourly' | string,
  frequency: string | null
): string => {
  // Fallback: use client_name if parent_company is null
  const prefix = parentCompany || clientName || '';
  
  // Special case: EPA Charges stands alone (no prefix)
  if (workTypeName === 'EPA Charges') {
    return 'EPA Charges';
  }
  
  // Hourly work types get special suffixes
  if (rateType === 'hourly') {
    if (workTypeName.toLowerCase() === 'janitorial') {
      return `${prefix}-Jani`;
    }
    // All other hourly types (Skid Loader, etc.)
    return `${prefix}-Addi`;
  }
  
  // Per-unit work types: "Parent WorkType Frequency"
  let workType = workTypeName;
  const freqSuffix = convertFrequencyToQBFormat(frequency, workTypeName);
  
  // Add 's' for 2x frequencies, but only for alphabetic names
  if (frequency?.toLowerCase().includes('2x') && shouldPluralize(workTypeName)) {
    workType = workTypeName + 's';
  }
  
  return `${prefix} ${workType} ${freqSuffix}`.trim();
};

/**
 * Get the Friday of the week containing the given date.
 * Week runs Monday-Sunday, so Friday is always within the same week.
 */
const getFridayOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
  
  // For Monday-Sunday week:
  // Sunday (0): -2 days (back to Friday of same week)
  // Monday (1): +4 days
  // Tuesday (2): +3 days
  // Wednesday (3): +2 days
  // Thursday (4): +1 day
  // Friday (5): 0 days
  // Saturday (6): -1 day
  const adjustment = day === 0 ? -2 : (5 - day);
  d.setDate(d.getDate() + adjustment);
  return d;
};

export default function FinanceDashboard() {
  // Date range state
  const today = new Date();
  const [startDate, setStartDate] = useState<Date | undefined>(startOfWeek(today, { weekStartsOn: 1 }));
  const [endDate, setEndDate] = useState<Date | undefined>(endOfWeek(today, { weekStartsOn: 1 }));

  // Filter state
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedWorkTypes, setSelectedWorkTypes] = useState<string[]>([]);

  // Data state
  const [reportData, setReportData] = useState<ReportDataRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Export configuration state
  const [columns, setColumns] = useState<ExportColumn[]>(DEFAULT_COLUMNS);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [invoiceStartNumber, setInvoiceStartNumber] = useState<number>(1001);

  // Fetch report data when filters change
  useEffect(() => {
    if (startDate && endDate) {
      fetchReportData();
    }
  }, [startDate, endDate, selectedClients, selectedLocations, selectedWorkTypes]);

  const fetchReportData = async () => {
    if (!startDate || !endDate) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_report_data', {
        p_start_date: format(startDate, 'yyyy-MM-dd'),
        p_end_date: format(endDate, 'yyyy-MM-dd'),
        p_client_ids: selectedClients.length > 0 ? selectedClients : null,
        p_location_ids: selectedLocations.length > 0 ? selectedLocations : null,
        p_work_type_ids: selectedWorkTypes.length > 0 ? selectedWorkTypes : null,
      });

      if (error) throw error;
      setReportData(data || []);
    } catch (error: any) {
      console.error('Error fetching report data:', error);
      toast.error('Failed to fetch report data');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadTemplate = (config: ReportTemplateConfig) => {
    if (config.columns) {
      setColumns(config.columns);
    }
    if (config.invoiceStartNumber) {
      setInvoiceStartNumber(config.invoiceStartNumber);
    }
  };

  const calculateDueDate = (invoiceDate: Date, terms: string): string => {
    const daysMatch = terms.match(/Net\s*(\d+)/i);
    const days = daysMatch ? parseInt(daysMatch[1], 10) : 30;
    return format(addDays(invoiceDate, days), 'MM/dd/yyyy');
  };

  const getFieldValue = (
    fieldKey: string,
    row: ReportDataRow,
    invoiceNumber: string,
    invoiceDate: Date,
    isFirstRow: boolean
  ): string => {
    switch (fieldKey) {
      case 'invoice_number':
        return invoiceNumber;
      case 'client_name':
        return row.client_name || '';
      case 'location_name':
        return row.location_name || '';
      case 'invoice_date':
        return format(invoiceDate, 'MM/dd/yyyy');
      case 'due_date':
        return calculateDueDate(invoiceDate, row.client_terms || 'Net 30');
      case 'terms':
        return row.client_terms || 'Net 30';
      case 'qb_item_name':
        return buildQBItemName(
          row.client_parent_company,
          row.client_name,
          row.work_type_name,
          row.work_type_rate_type || 'per_unit',
          row.frequency
        );
      case 'work_type_name':
        return row.work_type_name || '';
      case 'item_description':
        return `${row.work_type_name || ''}${row.frequency ? ` - ${row.frequency}` : ''}`;
      case 'quantity':
        return String(row.total_quantity || 0);
      case 'rate':
        return row.rate !== null ? String(row.rate) : '';
      case 'line_total':
        return row.rate !== null ? String((Number(row.total_quantity) * Number(row.rate)).toFixed(2)) : '';
      case 'class':
        return row.client_class || '';
      case 'contact_email':
        return row.client_email || '';
      case 'taxable':
        return row.client_is_taxable ? 'Y' : 'N';
      case 'tax_jurisdiction':
        return row.client_tax_jurisdiction || '';
      case 'tax_rate':
        return row.client_tax_rate != null ? row.client_tax_rate.toFixed(2) : '';
      case 'frequency':
        return row.frequency || '';
      default:
        return '';
    }
  };

  const generateCSVData = () => {
    if (reportData.length === 0 || columns.length === 0) {
      toast.error('No data or columns configured');
      return { headers: [], rows: [] };
    }

    const headers = columns.map((col) => col.headerName);
    const rows: string[][] = [];

    // Group data by client + location + week (Friday of that week)
    // Each unique combination = one invoice
    const grouped = new Map<string, ReportDataRow[]>();
    for (const row of reportData) {
      // Parse the work date and get the Friday of that week
      const workDate = row.work_date ? parseLocalDate(row.work_date) : (endDate || new Date());
      const friday = getFridayOfWeek(workDate);
      const fridayKey = format(friday, 'yyyy-MM-dd');
      
      const key = `${row.client_id}|${row.location_id}|${fridayKey}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(row);
    }
    
    // Generate rows for each invoice group with auto-incrementing invoice numbers
    let currentInvoiceNumber = invoiceStartNumber;

    for (const [key, groupRows] of grouped) {
      // Extract the Friday from the key for this invoice's date
      const fridayStr = key.split('|')[2];
      const invoiceDate = parseLocalDate(fridayStr);
      const invoiceNumber = String(currentInvoiceNumber);
      currentInvoiceNumber++;

      groupRows.forEach((row, rowIndex) => {
        const isFirstRow = rowIndex === 0;
        const csvRow = columns.map((col) => {
          // If field is marked "first row only" and this isn't the first row, return empty
          if (col.firstRowOnly && !isFirstRow) {
            return '';
          }
          return getFieldValue(col.fieldKey, row, invoiceNumber, invoiceDate, isFirstRow);
        });
        rows.push(csvRow);
      });
    }

    return { headers, rows };
  };

  const handlePreviewCSV = () => {
    console.log('handlePreviewCSV - current columns:', columns.map(c => ({ key: c.fieldKey, header: c.headerName })));
    const { headers, rows } = generateCSVData();
    console.log('handlePreviewCSV - generated headers:', headers);
    if (rows.length === 0) return;
    setCsvHeaders(headers);
    setCsvRows(rows);
    setPreviewModalOpen(true);
  };

  const handleExportCSV = () => {
    const { headers, rows } = generateCSVData();
    if (rows.length === 0) return;

    // Build CSV content
    const escapeCSV = (value: string) => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map((row) => row.map(escapeCSV).join(',')),
    ].join('\n');

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const dateStr = format(endDate || new Date(), 'yyyy-MM-dd');
    link.download = `invoice-export-${dateStr}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    toast.success(`Exported ${rows.length} rows to CSV`);
    setPreviewModalOpen(false);
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileSpreadsheet className="h-8 w-8" />
              Data Export & Reports
            </h1>
            <p className="text-muted-foreground mt-1">
              Build custom reports and export QuickBooks-compatible CSV files
            </p>
          </div>
          <TemplateManager
            currentConfig={{ columns, invoiceStartNumber }}
            onLoadTemplate={handleLoadTemplate}
          />
        </div>

        <Separator />

        {/* Step 1: Date Range */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Step 1: Select Date Range</CardTitle>
            <CardDescription>Choose the period for your report</CardDescription>
          </CardHeader>
          <CardContent>
            <ReportDateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
            />
          </CardContent>
        </Card>

        {/* Step 2: Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Step 2: Filter Data</CardTitle>
            <CardDescription>Narrow down by client, location, or work type (optional)</CardDescription>
          </CardHeader>
          <CardContent>
            <ReportFilters
              selectedClients={selectedClients}
              selectedLocations={selectedLocations}
              selectedWorkTypes={selectedWorkTypes}
              onClientsChange={setSelectedClients}
              onLocationsChange={setSelectedLocations}
              onWorkTypesChange={setSelectedWorkTypes}
            />
          </CardContent>
        </Card>

        {/* Step 3: Preview */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Step 3: Preview Data</CardTitle>
              <CardDescription>
                {reportData.length} line items found
                {startDate && endDate && (
                  <> for {format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}</>
                )}
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => setConfigModalOpen(true)}>
              <Settings2 className="h-4 w-4 mr-2" />
              Configure Export
            </Button>
          </CardHeader>
          <CardContent>
            <ReportPreviewTable data={reportData} loading={loading} columns={columns} />
          </CardContent>
        </Card>

        {/* Step 4: Export */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Step 4: Export</CardTitle>
            <CardDescription>
              {columns.length} columns configured for export
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Invoice Number Start Setting */}
            <div className="flex items-center gap-4">
              <Label htmlFor="invoiceStart" className="whitespace-nowrap">
                Invoice Number Start:
              </Label>
              <Input
                id="invoiceStart"
                type="number"
                value={invoiceStartNumber}
                onChange={(e) => setInvoiceStartNumber(parseInt(e.target.value) || 1001)}
                className="w-32"
                min={1}
              />
              <span className="text-sm text-muted-foreground">
                Invoices will be numbered {invoiceStartNumber}, {invoiceStartNumber + 1}, {invoiceStartNumber + 2}...
              </span>
            </div>
            
            <div className="flex gap-4">
              <Button variant="outline" onClick={handlePreviewCSV} disabled={reportData.length === 0}>
                <Eye className="h-4 w-4 mr-2" />
                Preview CSV
              </Button>
              <Button onClick={handleExportCSV} disabled={reportData.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <ExportColumnConfigurator
        open={configModalOpen}
        onOpenChange={setConfigModalOpen}
        columns={columns}
        onColumnsChange={setColumns}
      />

      <CSVPreviewModal
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
        headers={csvHeaders}
        rows={csvRows}
        onExport={handleExportCSV}
      />
    </Layout>
  );
}
