import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, format, startOfWeek, subWeeks } from 'date-fns';
import { Download, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { buildPayrollWorkbook, downloadPayrollWorkbook, PayrollExportLine } from '@/lib/payrollExport';
import { usePayCodes } from '@/hooks/usePayCodes';

type ProductionRow = {
  employee_id: string;
  employee_name: string;
  provider_employee_number: string | null;
  location_id: string;
  location_name: string;
  client_name: string;
  work_type_id: string;
  work_type_name: string;
  work_type_rate_type: string;
  total_quantity: number;
};

type RateInfo = { rate: number; code: string; department: string } | null;

const asDateInput = (date: Date) => format(date, 'yyyy-MM-dd');
const mondayOf = (date: Date) => startOfWeek(date, { weekStartsOn: 1 });

const lastFirst = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name.trim();
  const last = parts.pop() as string;
  return `${last}, ${parts.join(' ')}`;
};

const money = (value: number) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

type Props = { periodStart: string };

const PayrollProductionReport = ({ periodStart }: Props) => {
  const [weekStart, setWeekStart] = useState(periodStart);
  const [rows, setRows] = useState<ProductionRow[]>([]);
  const [rates, setRates] = useState<Record<string, RateInfo>>({});
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { payCodeById } = usePayCodes();

  useEffect(() => { setWeekStart(periodStart); }, [periodStart]);

  const weekEnd = useMemo(() => asDateInput(addDays(new Date(`${weekStart}T00:00:00`), 6)), [weekStart]);

  const load = useCallback(async () => {
    setLoading(true);
    const [production, maps, payLines] = await Promise.all([
      supabase.rpc('get_payroll_production_data', { p_start_date: weekStart, p_end_date: weekEnd }),
      supabase.from('payroll_work_type_map').select('work_type_id, pay_code_id').is('location_id', null),
      supabase
        .from('payroll_employee_lines')
        .select('employee_id, pay_code_id, rate, effective_date, end_date, is_active')
        .eq('is_active', true),
    ]);

    if (production.error || maps.error || payLines.error) {
      toast.error('Could not load the production report');
      setLoading(false);
      return;
    }

    const codeByWorkType = Object.fromEntries(
      ((maps.data || []) as Array<{ work_type_id: string; pay_code_id: string }>).map(item => [item.work_type_id, item.pay_code_id])
    );

    const activeLines = ((payLines.data || []) as Array<{
      employee_id: string | null;
      pay_code_id: string;
      rate: number;
      effective_date: string;
      end_date: string | null;
      pay_code?: { code: string; department: string } | null;
    }>).filter(line => line.employee_id && line.effective_date <= weekEnd && (!line.end_date || line.end_date >= weekStart));

    const lookup: Record<string, RateInfo> = {};
    ((production.data || []) as ProductionRow[]).forEach(row => {
      const payCodeId = codeByWorkType[row.work_type_id];
      const match = payCodeId
        ? activeLines.find(line => line.employee_id === row.employee_id && line.pay_code_id === payCodeId)
        : undefined;
      lookup[`${row.employee_id}:${row.work_type_id}`] = match
        ? { rate: Number(match.rate) || 0, code: match.pay_code?.code?.trim() || '', department: match.pay_code?.department || '' }
        : null;
    });

    setRows(((production.data || []) as ProductionRow[]).map(row => ({ ...row, total_quantity: Number(row.total_quantity) || 0 })));
    setRates(lookup);
    setLoading(false);
  }, [weekStart, weekEnd]);

  useEffect(() => { void load(); }, [load]);

  const visibleRows = useMemo(() => {
    const employee = employeeFilter.trim().toLowerCase();
    const location = locationFilter.trim().toLowerCase();
    return rows
      .filter(row => (!employee || row.employee_name.toLowerCase().includes(employee)) && (!location || row.location_name.toLowerCase().includes(location)))
      .sort((a, b) =>
        lastFirst(a.employee_name).localeCompare(lastFirst(b.employee_name)) ||
        (rates[`${a.employee_id}:${a.work_type_id}`]?.code || '').localeCompare(rates[`${b.employee_id}:${b.work_type_id}`]?.code || '') ||
        a.location_name.localeCompare(b.location_name)
      );
  }, [rows, employeeFilter, locationFilter, rates]);

  const payFor = (row: ProductionRow) => {
    const info = rates[`${row.employee_id}:${row.work_type_id}`];
    return info ? info.rate * row.total_quantity : null;
  };

  const grandTotal = useMemo(() => visibleRows.reduce((sum, row) => sum + (payFor(row) || 0), 0), [visibleRows, rates]);
  const missingRates = useMemo(
    () => Array.from(new Set(visibleRows.filter(row => !rates[`${row.employee_id}:${row.work_type_id}`]).map(row => `${row.employee_name} — ${row.work_type_name}`))),
    [visibleRows, rates]
  );

  const subtotals = useMemo(() => {
    const totals: Record<string, number> = {};
    visibleRows.forEach(row => { totals[row.employee_id] = (totals[row.employee_id] || 0) + (payFor(row) || 0); });
    return totals;
  }, [visibleRows, rates]);

  const exportWorkbook = async () => {
    if (visibleRows.length === 0) { toast.error('Nothing to export for this week'); return; }
    setExporting(true);
    const lines: PayrollExportLine[] = visibleRows.map(row => {
      const info = rates[`${row.employee_id}:${row.work_type_id}`];
      return {
        notes: null,
        code: info?.code || '',
        department: info?.department || '',
        task_label: `${row.location_name} ${row.work_type_name}`,
        display_name: lastFirst(row.employee_name),
        provider_employee_number: row.provider_employee_number,
        rate: info?.rate || 0,
        quantity: row.total_quantity,
        ot_hours: 0,
        pay_type: 'Unit',
      };
    });
    const checkDate = asDateInput(addDays(new Date(`${weekEnd}T00:00:00`), 5));
    const blob = await buildPayrollWorkbook(lines, weekStart, weekEnd, checkDate);
    downloadPayrollWorkbook(blob, weekEnd);
    setExporting(false);
  };

  let currentEmployee = '';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Washer production</CardTitle>
        <CardDescription>
          Counts come from the same wash records used for invoicing, so the totals always match the invoice reports.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="productionWeek">Week starting</Label>
            <Input id="productionWeek" type="date" value={weekStart} onChange={event => setWeekStart(asDateInput(mondayOf(new Date(`${event.target.value}T00:00:00`))))} />
          </div>
          <div className="space-y-2"><Label>Week ending</Label><Input value={weekEnd} readOnly /></div>
          <div className="space-y-2"><Label htmlFor="productionEmployee">Washer</Label><Input id="productionEmployee" placeholder="All washers" value={employeeFilter} onChange={event => setEmployeeFilter(event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="productionLocation">Location</Label><Input id="productionLocation" placeholder="All locations" value={locationFilter} onChange={event => setLocationFilter(event.target.value)} /></div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setWeekStart(asDateInput(mondayOf(new Date())))}>This Week</Button>
          <Button variant="outline" onClick={() => setWeekStart(asDateInput(mondayOf(subWeeks(new Date(), 1))))}>Last Week</Button>
          <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
          <Button onClick={() => void exportWorkbook()} disabled={exporting || visibleRows.length === 0}>
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Download Payroll Worksheet
          </Button>
        </div>

        {missingRates.length > 0 && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <p className="font-medium">No pay rate saved for:</p>
            <ul className="mt-1 list-disc pl-5">{missingRates.map(item => <li key={item}>{item}</li>)}</ul>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading week…</div>
        ) : visibleRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No washes recorded for this week.</p>
        ) : (
          <div className="overflow-auto">
            <Table className="min-w-max">
              <TableHeader>
                <TableRow>
                  <TableHead>Washer</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Vehicle / Work Type</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Pay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((row, index) => {
                  const info = rates[`${row.employee_id}:${row.work_type_id}`];
                  const pay = payFor(row);
                  const nextRow = visibleRows[index + 1];
                  const isLastOfEmployee = !nextRow || nextRow.employee_id !== row.employee_id;
                  const showName = currentEmployee !== row.employee_id;
                  currentEmployee = row.employee_id;
                  return (
                    <Fragment key={`${row.employee_id}-${row.location_id}-${row.work_type_id}`}>
                      <TableRow key={`${row.employee_id}-${row.location_id}-${row.work_type_id}`}>
                        <TableCell className="font-medium">{showName ? lastFirst(row.employee_name) : ''}</TableCell>
                        <TableCell>{row.location_name}</TableCell>
                        <TableCell>{row.work_type_name}</TableCell>
                        <TableCell className="text-right">{row.total_quantity}</TableCell>
                        <TableCell className="text-right">{info ? money(info.rate) : <span className="text-destructive">No rate set</span>}</TableCell>
                        <TableCell className="text-right">{pay === null ? '—' : money(pay)}</TableCell>
                      </TableRow>
                      {isLastOfEmployee && (
                        <TableRow key={`${row.employee_id}-subtotal`} className="bg-muted/50">
                          <TableCell colSpan={5} className="text-right font-medium">Washer total</TableCell>
                          <TableCell className="text-right font-medium">{money(subtotals[row.employee_id] || 0)}</TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
                <TableRow>
                  <TableCell colSpan={5} className="text-right font-semibold">Week total</TableCell>
                  <TableCell className="text-right font-semibold">{money(grandTotal)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PayrollProductionReport;
