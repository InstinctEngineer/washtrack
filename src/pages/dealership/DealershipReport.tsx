import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { exportToExcel } from '@/lib/excelExporter';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableTableHead } from '@/components/SortableTableHead';

interface ReportRow {
  client_id: string;
  client_name: string;
  location_id: string;
  location_name: string;
  work_date: string;
  vehicle_count: number;
  rate_applied: number;
  total_amount: number;
}

export default function DealershipReport() {
  const today = new Date();
  const [startDate, setStartDate] = useState(format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_dealership_report_data' as any, {
      p_start_date: startDate,
      p_end_date: endDate,
      p_client_ids: null,
      p_location_ids: null,
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    setRows(((data as any[]) || []).map((r) => ({
      ...r,
      vehicle_count: Number(r.vehicle_count),
      rate_applied: Number(r.rate_applied),
      total_amount: Number(r.total_amount),
    })));
    setLoading(false);
  };

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grandTotal = rows.reduce((s, r) => s + r.total_amount, 0);
  const grandVehicles = rows.reduce((s, r) => s + r.vehicle_count, 0);

  const { sortedData: sortedRows, sortColumn, sortDirection, handleSort } = useTableSort(rows, {
    getValue: (r, col) => {
      switch (col) {
        case 'client_name': return r.client_name;
        case 'location_name': return r.location_name;
        case 'work_date': return r.work_date;
        case 'vehicle_count': return r.vehicle_count;
        case 'rate_applied': return r.rate_applied;
        case 'total_amount': return r.total_amount;
        default: return '';
      }
    },
  });

  const handleExport = () => {
    if (rows.length === 0) return toast.error('Nothing to export');
    const data = rows.map((r) => ({
      client: r.client_name,
      location: r.location_name,
      work_date: r.work_date,
      vehicles: r.vehicle_count,
      rate: r.rate_applied.toFixed(2),
      total: r.total_amount.toFixed(2),
    }));
    exportToExcel(data, `dealership-${startDate}_to_${endDate}.xlsx`, 'Dealership', {
      addSumRow: true,
      sumColumns: ['Vehicles', 'Total'],
      columnDefinitions: [
        { id: 'client', label: 'Client' },
        { id: 'location', label: 'Location' },
        { id: 'work_date', label: 'Work Date' },
        { id: 'vehicles', label: 'Vehicles' },
        { id: 'rate', label: 'Rate' },
        { id: 'total', label: 'Total' },
      ],
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dealership Report</h1>
          <p className="text-muted-foreground">Vehicle wash totals by client / location / day</p>
        </div>

        <Card>
          <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>Start</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>End</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <Button onClick={run} disabled={loading}>{loading ? 'Loading…' : 'Run report'}</Button>
            <Button variant="outline" onClick={handleExport} disabled={rows.length === 0}>
              <Download className="h-4 w-4 mr-1" /> Export Excel
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Results</span>
              <span className="text-base font-normal text-muted-foreground">
                {grandVehicles} vehicles · ${grandTotal.toFixed(2)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="text-muted-foreground">No entries in this date range.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead column="client_name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Client</SortableTableHead>
                    <SortableTableHead column="location_name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Location</SortableTableHead>
                    <SortableTableHead column="work_date" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Date</SortableTableHead>
                    <SortableTableHead column="vehicle_count" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} align="right">Vehicles</SortableTableHead>
                    <SortableTableHead column="rate_applied" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} align="right">Rate</SortableTableHead>
                    <SortableTableHead column="total_amount" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} align="right">Total</SortableTableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.client_name}</TableCell>
                      <TableCell>{r.location_name}</TableCell>
                      <TableCell>{format(new Date(r.work_date + 'T00:00:00'), 'MMM d, yyyy')}</TableCell>
                      <TableCell className="text-right">{r.vehicle_count}</TableCell>
                      <TableCell className="text-right font-mono">${r.rate_applied.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">${r.total_amount.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}