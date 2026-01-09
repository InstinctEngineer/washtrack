import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ExportColumn } from './ExportColumnConfigurator';

export interface ReportDataRow {
  client_id: string;
  client_name: string;
  client_email: string | null;
  client_terms: string;
  client_class: string | null;
  client_tax_jurisdiction: string | null;
  client_is_taxable: boolean;
  client_tax_rate?: number | null;
  client_parent_company?: string | null;
  location_id: string;
  location_name: string;
  work_type_id: string;
  work_type_name: string;
  work_type_rate_type?: 'per_unit' | 'hourly' | string;
  frequency: string | null;
  rate: number | null;
  total_quantity: number;
  work_date?: string;
}

interface ReportPreviewTableProps {
  data: ReportDataRow[];
  loading?: boolean;
  columns?: ExportColumn[];
}

const DEFAULT_PREVIEW_COLUMNS: ExportColumn[] = [
  { id: 'p-1', fieldKey: 'client_name', headerName: 'Client', firstRowOnly: false },
  { id: 'p-2', fieldKey: 'location_name', headerName: 'Location', firstRowOnly: false },
  { id: 'p-3', fieldKey: 'work_type_name', headerName: 'Work Type', firstRowOnly: false },
  { id: 'p-4', fieldKey: 'frequency', headerName: 'Frequency', firstRowOnly: false },
  { id: 'p-5', fieldKey: 'quantity', headerName: 'Quantity', firstRowOnly: false },
  { id: 'p-6', fieldKey: 'rate', headerName: 'Rate', firstRowOnly: false },
  { id: 'p-7', fieldKey: 'line_total', headerName: 'Line Total', firstRowOnly: false },
];

// Helper functions for QB Item Name generation (mirrored from FinanceDashboard)
const convertFrequencyToQBFormat = (frequency: string | null, workTypeName: string): string => {
  if (!frequency) return '';
  const freq = frequency.toLowerCase();
  const endsWithLetter = /[a-zA-Z]$/.test(workTypeName);
  
  if (freq === 'weekly' || freq === '1x/week') return '1 X / Wk';
  if (freq === '2x/week') {
    return endsWithLetter ? '2 X /Wk' : '2 X / Wk';
  }
  if (freq === 'monthly' || freq === '1x/month') return '1 X / MO';
  if (freq === '2x/month') {
    return endsWithLetter ? '2 X /MO' : '2 X / MO';
  }
  return frequency;
};

const shouldPluralize = (workTypeName: string): boolean => {
  return /[a-zA-Z]$/.test(workTypeName);
};

const buildQBItemName = (
  parentCompany: string | null | undefined,
  clientName: string,
  workTypeName: string,
  rateType: 'per_unit' | 'hourly' | string,
  frequency: string | null
): string => {
  const prefix = parentCompany || clientName || '';
  
  if (workTypeName === 'EPA Charges') {
    return 'EPA Charges';
  }
  
  if (rateType === 'hourly') {
    if (workTypeName.toLowerCase() === 'janitorial') {
      return `${prefix}-Jani`;
    }
    return `${prefix}-Addi`;
  }
  
  let workType = workTypeName;
  const freqSuffix = convertFrequencyToQBFormat(frequency, workTypeName);
  
  if (frequency?.toLowerCase().includes('2x') && shouldPluralize(workTypeName)) {
    workType = workTypeName + 's';
  }
  
  return `${prefix} ${workType} ${freqSuffix}`.trim();
};

const getFieldValue = (fieldKey: string, row: ReportDataRow): React.ReactNode => {
  switch (fieldKey) {
    case 'client_name':
      return row.client_name || '—';
    case 'location_name':
      return row.location_name || '—';
    case 'qb_item_name':
      return buildQBItemName(
        row.client_parent_company,
        row.client_name,
        row.work_type_name,
        row.work_type_rate_type || 'per_unit',
        row.frequency
      );
    case 'work_type_name':
      return row.work_type_name || '—';
    case 'frequency':
      return row.frequency || '—';
    case 'quantity':
      return String(row.total_quantity || 0);
    case 'rate':
      if (row.rate === null) {
        return <span className="text-warning font-medium">Missing</span>;
      }
      return `$${Number(row.rate).toFixed(2)}`;
    case 'line_total':
      if (row.rate === null) return '—';
      return `$${(Number(row.total_quantity) * Number(row.rate)).toFixed(2)}`;
    case 'tax_rate':
      return row.client_tax_rate != null ? `${row.client_tax_rate.toFixed(2)}%` : '—';
    case 'tax_jurisdiction':
      return row.client_tax_jurisdiction || '—';
    case 'taxable':
      return row.client_is_taxable ? 'Y' : 'N';
    case 'terms':
      return row.client_terms || '—';
    case 'class':
      return row.client_class || '—';
    case 'contact_email':
      return row.client_email || '—';
    case 'item_description':
      return `${row.work_type_name || ''}${row.frequency ? ` - ${row.frequency}` : ''}`;
    case 'invoice_number':
    case 'invoice_date':
    case 'due_date':
      return <span className="text-muted-foreground italic">(at export)</span>;
    default:
      return '—';
  }
};

const RIGHT_ALIGNED_FIELDS = ['quantity', 'rate', 'line_total', 'tax_rate'];

export function ReportPreviewTable({ data, loading, columns }: ReportPreviewTableProps) {
  const displayColumns = columns || DEFAULT_PREVIEW_COLUMNS;
  
  const totalQuantity = data.reduce((sum, row) => sum + Number(row.total_quantity || 0), 0);
  const totalAmount = data.reduce((sum, row) => {
    const qty = Number(row.total_quantity || 0);
    const rate = Number(row.rate || 0);
    return sum + qty * rate;
  }, 0);
  const missingRateCount = data.filter(row => row.rate === null).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        Loading report data...
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        No data found for the selected filters and date range.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {missingRateCount > 0 && (
        <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg text-warning">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm">
            {missingRateCount} row{missingRateCount > 1 ? 's' : ''} with missing rates. 
            Update rates in the Rate Card before exporting.
          </span>
        </div>
      )}

      <div className="border rounded-lg overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {displayColumns.map((col) => (
                <TableHead
                  key={col.id}
                  className={cn(RIGHT_ALIGNED_FIELDS.includes(col.fieldKey) && 'text-right')}
                >
                  {col.headerName}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, index) => (
              <TableRow
                key={`${row.client_id}-${row.location_id}-${row.work_type_id}-${row.frequency}-${index}`}
                className={cn(row.rate === null && 'bg-warning/10')}
              >
                {displayColumns.map((col) => (
                  <TableCell
                    key={col.id}
                    className={cn(
                      RIGHT_ALIGNED_FIELDS.includes(col.fieldKey) && 'text-right',
                      col.fieldKey === 'client_name' && 'font-medium'
                    )}
                  >
                    {getFieldValue(col.fieldKey, row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end">
        <div className="bg-muted/50 rounded-lg p-4 space-y-1">
          <div className="flex justify-between gap-8 text-sm">
            <span className="text-muted-foreground">Total Quantity:</span>
            <span className="font-medium">{totalQuantity}</span>
          </div>
          <div className="flex justify-between gap-8 text-lg font-semibold">
            <span>Total Amount:</span>
            <span className="text-primary">${totalAmount.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
