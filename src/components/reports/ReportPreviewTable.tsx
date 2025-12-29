import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ReportDataRow {
  client_id: string;
  client_name: string;
  client_email: string | null;
  client_terms: string;
  client_class: string | null;
  client_tax_jurisdiction: string | null;
  client_is_taxable: boolean;
  location_id: string;
  location_name: string;
  work_type_id: string;
  work_type_name: string;
  frequency: string | null;
  rate: number | null;
  total_quantity: number;
}

interface ReportPreviewTableProps {
  data: ReportDataRow[];
  loading?: boolean;
}

export function ReportPreviewTable({ data, loading }: ReportPreviewTableProps) {
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

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Client</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Work Type</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Line Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, index) => {
              const lineTotal = Number(row.total_quantity || 0) * Number(row.rate || 0);
              const isMissingRate = row.rate === null;

              return (
                <TableRow
                  key={`${row.client_id}-${row.location_id}-${row.work_type_id}-${row.frequency}-${index}`}
                  className={cn(isMissingRate && 'bg-warning/10')}
                >
                  <TableCell className="font-medium">{row.client_name || '—'}</TableCell>
                  <TableCell>{row.location_name || '—'}</TableCell>
                  <TableCell>{row.work_type_name || '—'}</TableCell>
                  <TableCell>{row.frequency || '—'}</TableCell>
                  <TableCell className="text-right">{row.total_quantity}</TableCell>
                  <TableCell className="text-right">
                    {isMissingRate ? (
                      <span className="text-warning font-medium">Missing</span>
                    ) : (
                      `$${Number(row.rate).toFixed(2)}`
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {isMissingRate ? '—' : `$${lineTotal.toFixed(2)}`}
                  </TableCell>
                </TableRow>
              );
            })}
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
