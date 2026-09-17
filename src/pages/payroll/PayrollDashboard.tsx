import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, format, startOfWeek } from 'date-fns';
import { CalendarRange, Download, Loader2, Plus, RefreshCw, Upload, Wallet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { buildPayrollWorkbook, downloadPayrollWorkbook, PayrollExportLine } from '@/lib/payrollExport';
import PayrollProductionReport from './PayrollProductionReport';
import PayrollRateSheet from './PayrollRateSheet';
import PayrollPayCodes from './PayrollPayCodes';
import { usePayCodes, payCodeLabel } from '@/hooks/usePayCodes';

type Employee = { id: string; name: string; employee_id: string | null };
type PayLine = {
  id: string;
  employee_id: string | null;
  display_name: string;
  provider_employee_number: string | null;
  pay_code_id: string;
  department: string;
  task_label: string;
  rate: number;
  pay_type: string;
  effective_date: string;
  end_date: string | null;
  is_active: boolean;
  sort_order: number;
  pay_code?: { id: string; code: string; department: string; default_pay_type: string } | null;
};
type Period = { id: string; period_start: string; period_end: string; check_date: string | null; status: string };
type WorkType = { id: string; name: string };
type RunLine = PayrollExportLine & { id: string; period_id: string };

const payTypeOptions = ['Unit', 'Hourly', 'Salary'];
const asDateInput = (date: Date) => format(date, 'yyyy-MM-dd');
const mondayOf = (date: Date) => startOfWeek(date, { weekStartsOn: 1 });
const emptyLine = { employee_id: '', pay_code_id: '', department: '', task_label: '', provider_employee_number: '', rate: '0', pay_type: 'Unit', effective_date: asDateInput(new Date()) };


const parseHoursFile = async (file: File) => {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' });
  const value = (row: Record<string, unknown>, names: string[]) => {
    const key = Object.keys(row).find(candidate => names.includes(candidate.trim().toLowerCase()));
    return key ? String(row[key] ?? '').trim() : '';
  };
  return rows.map(row => ({
    raw_name: value(row, ['name', 'employee', 'employee name', 'employee_name']),
    provider_employee_number: value(row, ['employee number', 'employee #', 'employee id', 'employee number/id', 'id']),
    department: value(row, ['department', 'dept']),
    task_label: value(row, ['task', 'task label', 'job', 'location']),
    hours: Number(value(row, ['hours', 'regular hours', 'hrs', 'regular hrs'])) || 0,
    ot_hours: Number(value(row, ['ot hours', 'overtime hours', 'ot', 'e02 ot hours'])) || 0,
  })).filter(row => row.raw_name || row.provider_employee_number);
};

const PayrollDashboard = () => {
  const [activeTab, setActiveTab] = useState<'run' | 'production' | 'lines' | 'codes' | 'ecodes' | 'hours'>('run');
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [workTypeCodes, setWorkTypeCodes] = useState<Record<string, string>>({});
  const [periodStart, setPeriodStart] = useState(asDateInput(mondayOf(new Date())));
  const [period, setPeriod] = useState<Period | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [runLines, setRunLines] = useState<RunLine[]>([]);
  const [payLines, setPayLines] = useState<PayLine[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [showPayLineForm, setShowPayLineForm] = useState(false);
  const [newLine, setNewLine] = useState(emptyLine);
  const [hoursFile, setHoursFile] = useState<File | null>(null);
  const { payCodes, activePayCodes, payCodeById } = usePayCodes();

  const periodEnd = useMemo(() => asDateInput(addDays(new Date(`${periodStart}T00:00:00`), 6)), [periodStart]);
  const totalGross = useMemo(() => runLines.reduce((sum, line) => sum + line.rate * line.quantity + line.ot_hours * line.rate * 1.5, 0), [runLines]);

  const loadSetup = useCallback(async () => {
    setLoading(true);
    const [employeesResult, linesResult, periodsResult, workTypesResult, mapsResult] = await Promise.all([
      supabase.from('users_safe_view').select('id, name, employee_id').eq('is_active', true).order('name'),
      supabase.from('payroll_employee_lines').select('*, pay_code:payroll_pay_codes(id, code, department, default_pay_type)').eq('is_active', true).order('display_name').order('sort_order'),
      supabase.from('payroll_periods').select('id, period_start, period_end, check_date, status').order('period_start', { ascending: false }).limit(20),
      supabase.from('work_types').select('id, name').eq('is_active', true).order('name'),
      supabase.from('payroll_work_type_map').select('work_type_id, pay_code_id').is('location_id', null),
    ]);
    const firstError = [employeesResult.error, linesResult.error, periodsResult.error, workTypesResult.error, mapsResult.error].find(Boolean);
    if (firstError) toast.error('Could not load payroll setup');
    setEmployees((employeesResult.data || []) as Employee[]);
    setPayLines((linesResult.data || []) as PayLine[]);
    setPeriods((periodsResult.data || []) as Period[]);
    setWorkTypes((workTypesResult.data || []) as WorkType[]);
    setWorkTypeCodes(Object.fromEntries(((mapsResult.data || []) as Array<{ work_type_id: string; pay_code_id: string }>).map(item => [item.work_type_id, item.pay_code_id])));
    setLoading(false);
  }, []);

  const loadRun = useCallback(async (selectedPeriod: Period | null) => {
    if (!selectedPeriod) {
      setRunLines([]);
      return;
    }
    const { data, error } = await supabase.from('payroll_run_lines').select('*').eq('period_id', selectedPeriod.id).order('sort_order').order('display_name');
    if (error) toast.error('Could not load payroll run');
    setRunLines((data || []) as RunLine[]);
  }, []);

  useEffect(() => { void loadSetup(); }, [loadSetup]);
  useEffect(() => { void loadRun(period); }, [period, loadRun]);

  const defaultCheckDate = (endDate: string) => asDateInput(addDays(new Date(`${endDate}T00:00:00`), 5));

  const selectPeriod = async (selected: Period) => {
    setPeriod(selected);
    setPeriodStart(selected.period_start);
    if (!selected.check_date) {
      const value = defaultCheckDate(selected.period_end);
      const { error } = await supabase.from('payroll_periods').update({ check_date: value }).eq('id', selected.id);
      if (!error) {
        setPeriod({ ...selected, check_date: value });
        setPeriods(current => current.map(item => (item.id === selected.id ? { ...item, check_date: value } : item)));
      }
    }
  };

  const createPeriod = async () => {
    setWorking(true);
    const existing = periods.find(item => item.period_start === periodStart);
    const checkDate = existing?.check_date || defaultCheckDate(periodEnd);
    const { data, error } = await supabase.from('payroll_periods').upsert({ period_start: periodStart, period_end: periodEnd, check_date: checkDate }, { onConflict: 'period_start' }).select().single();
    setWorking(false);
    if (error) { toast.error('Could not create pay period'); return; }
    setPeriod(data as Period);
    await loadSetup();
    toast.success('Pay period ready');
  };

  const generateRun = async () => {
    if (!period) { toast.error('Create or select a pay period first'); return; }
    setWorking(true);
    const activeLines = payLines.filter(line => line.is_active && line.effective_date <= period.period_end && (!line.end_date || line.end_date >= period.period_start));
    const [workLogsResult, mapsResult, hoursResult] = await Promise.all([
      supabase.from('work_logs').select('employee_id, quantity, work_item:work_items(rate_config:rate_configs(work_type_id))').gte('work_date', period.period_start).lte('work_date', period.period_end),
      supabase.from('payroll_work_type_map').select('work_type_id, pay_code_id').is('location_id', null),
      supabase.from('payroll_hours_imports').select('employee_id, employee_line_id, provider_employee_number, raw_name, hours, ot_hours').eq('period_id', period.id),
    ]);
    if (workLogsResult.error || mapsResult.error || hoursResult.error) { setWorking(false); toast.error('Could not read payroll source data'); return; }

    const codeByWorkType = new Map(((mapsResult.data || []) as Array<{ work_type_id: string; pay_code_id: string }>).map(item => [item.work_type_id, item.pay_code_id]));
    const unitTotals = new Map<string, number>();
    (workLogsResult.data || []).forEach((log: any) => {
      const payCodeId = codeByWorkType.get(log.work_item?.rate_config?.work_type_id);
      if (payCodeId) unitTotals.set(`${log.employee_id}|${payCodeId}`, (unitTotals.get(`${log.employee_id}|${payCodeId}`) || 0) + Number(log.quantity || 0));
    });
    const importedHours = (hoursResult.data || []) as Array<{ employee_id: string | null; employee_line_id: string | null; provider_employee_number: string | null; raw_name: string; hours: number; ot_hours: number }>;
    const rows = activeLines.map(line => {
      const hours = importedHours.filter(item => item.employee_line_id === line.id || (item.employee_id && item.employee_id === line.employee_id) || (item.provider_employee_number && item.provider_employee_number === line.provider_employee_number) || item.raw_name.trim().toLowerCase() === line.display_name.trim().toLowerCase());
      const isHourly = line.pay_type.trim().toLowerCase() === 'hourly';
      const isSalary = line.pay_type.trim().toLowerCase() === 'salary';
      return {
        period_id: period.id, employee_line_id: line.id, employee_id: line.employee_id, notes: null,
        code: line.pay_code?.code || '', department: line.department, task_label: line.task_label,
        display_name: line.display_name, provider_employee_number: line.provider_employee_number, rate: line.rate,
        quantity: isHourly ? hours.reduce((sum, item) => sum + Number(item.hours || 0), 0) : isSalary ? 1 : unitTotals.get(`${line.employee_id}|${line.pay_code_id}`) || 0,
        ot_hours: isHourly ? hours.reduce((sum, item) => sum + Number(item.ot_hours || 0), 0) : 0,
        pay_type: line.pay_type, sort_order: line.sort_order || 0,
      };
    });
    const { error: deleteError } = await supabase.from('payroll_run_lines').delete().eq('period_id', period.id);
    if (deleteError) { setWorking(false); toast.error('Could not refresh payroll run'); return; }
    const { error } = rows.length ? await supabase.from('payroll_run_lines').insert(rows) : { error: null };
    setWorking(false);
    if (error) { toast.error('Could not generate payroll run'); return; }
    await loadRun(period);
    toast.success(`Generated ${rows.length} payroll lines`);
  };

  const updateRunLine = async (line: RunLine, field: 'quantity' | 'ot_hours' | 'notes', value: string) => {
    if (period?.status !== 'draft') return;
    const numeric = field === 'notes' ? undefined : Math.max(0, Number(value) || 0);
    const update = field === 'notes' ? { notes: value } : { [field]: numeric };
    const { error } = await supabase.from('payroll_run_lines').update(update).eq('id', line.id);
    if (error) toast.error('Could not save payroll line');
    else setRunLines(current => current.map(item => item.id === line.id ? { ...item, ...update } : item));
  };


  const addPayLine = async () => {
    if (!newLine.employee_id || !newLine.pay_code_id || !newLine.department || !newLine.task_label) { toast.error('Complete the employee, code, department, and task'); return; }
    const employee = employees.find(item => item.id === newLine.employee_id);
    const code = payCodes.find(item => item.id === newLine.pay_code_id);
    if (!employee || !code) return;
    const { error } = await supabase.from('payroll_employee_lines').insert({
      employee_id: employee.id, display_name: employee.name, provider_employee_number: newLine.provider_employee_number || null,
      pay_code_id: code.id, department: newLine.department, task_label: newLine.task_label, rate: Number(newLine.rate) || 0,
      pay_type: newLine.pay_type, effective_date: newLine.effective_date,
    });
    if (error) { toast.error('Could not save pay line'); return; }
    setNewLine(emptyLine); setShowPayLineForm(false); await loadSetup(); toast.success('Pay line added');
  };

  const importHours = async () => {
    if (!hoursFile || !period) { toast.error('Choose a file and pay period first'); return; }
    setWorking(true);
    try {
      const parsedRows = await parseHoursFile(hoursFile);
      if (parsedRows.length === 0) { toast.error('No employee rows were found in that file'); return; }
      const { error } = await supabase.from('payroll_hours_imports').delete().eq('period_id', period.id);
      if (error) throw error;
      const { error: insertError } = await supabase.from('payroll_hours_imports').insert(parsedRows.map(row => ({ ...row, period_id: period.id, source_filename: hoursFile.name })));
      if (insertError) throw insertError;
      toast.success(`Imported ${parsedRows.length} hour rows`);
      await generateRun();
    } catch (error) {
      console.error('Hours import failed:', error);
      toast.error('Could not import hours file');
    } finally {
      setWorking(false);
    }
  };


  const setWorkTypeCode = async (workTypeId: string, payCodeId: string) => {
    const previous = workTypeCodes[workTypeId] || '';
    setWorkTypeCodes(current => ({ ...current, [workTypeId]: payCodeId }));
    const { error: deleteError } = await supabase.from('payroll_work_type_map').delete().eq('work_type_id', workTypeId).is('location_id', null);
    if (deleteError) { setWorkTypeCodes(current => ({ ...current, [workTypeId]: previous })); toast.error('Could not save the code'); return; }
    if (!payCodeId) return;
    const { error } = await supabase.from('payroll_work_type_map').insert({ work_type_id: workTypeId, location_id: null, pay_code_id: payCodeId });
    if (error) { setWorkTypeCodes(current => ({ ...current, [workTypeId]: previous })); toast.error('Could not save the code'); }
  };

  const unmappedCount = useMemo(() => workTypes.filter(type => !workTypeCodes[type.id]).length, [workTypes, workTypeCodes]);

  const exportWorkbook = async () => {
    if (!period || runLines.length === 0) { toast.error('Generate a payroll run before exporting'); return; }
    setWorking(true);
    const blob = await buildPayrollWorkbook(runLines, period.period_start, period.period_end, period.check_date);
    downloadPayrollWorkbook(blob, period.period_end);
    setWorking(false);
  };

  if (loading) return <Layout><div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin" /></div></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight"><Wallet className="h-8 w-8" /> Payroll Worksheet</h1>
            <p className="mt-1 text-muted-foreground">Build the weekly Future Systems payroll file from unit work and imported hours.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void loadSetup()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
            <Button onClick={() => void exportWorkbook()} disabled={working || !period || runLines.length === 0}><Download className="mr-2 h-4 w-4" />Export XLSX</Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b pb-2">
          {([['run', 'Weekly Run'], ['production', 'Washer Production'], ['lines', 'Pay Rates'], ['codes', 'Work Type Codes'], ['ecodes', 'E Codes'], ['hours', 'Import Hours']] as const).map(([value, label]) => (
            <Button key={value} variant={activeTab === value ? 'default' : 'ghost'} size="sm" onClick={() => setActiveTab(value)}>{label}</Button>
          ))}
        </div>

        {activeTab === 'run' && <>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><CalendarRange className="h-5 w-5" />Pay period</CardTitle><CardDescription>Weeks run Monday through Sunday. Create a week, generate its lines, then review it.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2"><Label htmlFor="periodStart">Week starting</Label><Input id="periodStart" type="date" value={periodStart} onChange={event => setPeriodStart(asDateInput(mondayOf(new Date(`${event.target.value}T00:00:00`))))} /></div>
                <div className="space-y-2"><Label>Week ending</Label><Input value={periodEnd} readOnly /></div>
                <div className="space-y-2"><Label htmlFor="checkDate">Check date</Label><Input id="checkDate" type="date" value={period?.check_date || ''} onChange={async event => { if (!period) return; const value = event.target.value || null; await supabase.from('payroll_periods').update({ check_date: value }).eq('id', period.id); setPeriod({ ...period, check_date: value }); }} /></div>
              </div>
              <div className="flex flex-wrap gap-2"><Button onClick={() => void createPeriod()} disabled={working}><Plus className="mr-2 h-4 w-4" />Create / Select Week</Button><Button variant="outline" onClick={() => void generateRun()} disabled={working || !period}><RefreshCw className="mr-2 h-4 w-4" />Generate Run</Button></div>
              {periods.length > 0 && <div className="overflow-auto"><Table><TableHeader><TableRow><TableHead>Week</TableHead><TableHead>Check Date</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader><TableBody>{periods.map(item => <TableRow key={item.id}><TableCell>{item.period_start} – {item.period_end}</TableCell><TableCell>{item.check_date || '—'}</TableCell><TableCell className="capitalize">{item.status}</TableCell><TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => selectPeriod(item)}>Open</Button></TableCell></TableRow>)}</TableBody></Table></div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-lg">Payroll lines {period && <span className="text-muted-foreground">· {runLines.length}</span>}</CardTitle><CardDescription>Every employee may have multiple rows — one for each code, task, or department.</CardDescription></CardHeader>
            <CardContent>
              {runLines.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Create a week and generate a run to see payroll lines.</p> : <div className="overflow-auto"><Table className="min-w-[1050px]"><TableHeader><TableRow><TableHead>Notes</TableHead><TableHead>Code</TableHead><TableHead>Department</TableHead><TableHead>Task</TableHead><TableHead>Name</TableHead><TableHead>Employee #</TableHead><TableHead>Rate</TableHead><TableHead>Hrs / Units</TableHead><TableHead>OT Hours</TableHead><TableHead>Type</TableHead><TableHead>Gross</TableHead></TableRow></TableHeader><TableBody>{runLines.map(line => <TableRow key={line.id}><TableCell><Input className="w-28" value={line.notes || ''} onChange={event => void updateRunLine(line, 'notes', event.target.value)} disabled={period?.status !== 'draft'} /></TableCell><TableCell>{line.code}</TableCell><TableCell>{line.department}</TableCell><TableCell>{line.task_label}</TableCell><TableCell>{line.display_name}</TableCell><TableCell>{line.provider_employee_number || '—'}</TableCell><TableCell>${line.rate.toFixed(2)}</TableCell><TableCell><Input className="w-24" type="number" min="0" step="0.01" value={line.quantity} onChange={event => void updateRunLine(line, 'quantity', event.target.value)} disabled={period?.status !== 'draft'} /></TableCell><TableCell><Input className="w-24" type="number" min="0" step="0.01" value={line.ot_hours} onChange={event => void updateRunLine(line, 'ot_hours', event.target.value)} disabled={period?.status !== 'draft' || line.pay_type.trim().toLowerCase() !== 'hourly'} /></TableCell><TableCell>{line.pay_type}</TableCell><TableCell>${(line.rate * line.quantity + line.ot_hours * line.rate * 1.5).toFixed(2)}</TableCell></TableRow>)}</TableBody></Table><Separator className="my-4" /><div className="flex justify-end text-lg font-semibold">Total Gross: ${totalGross.toFixed(2)}</div></div>}
            </CardContent>
          </Card>
        </>}

        {activeTab === 'production' && <PayrollProductionReport periodStart={periodStart} />}

        {activeTab === 'lines' && <Card>
          <CardHeader><CardTitle className="flex items-center justify-between text-lg">Recurring Pay Lines <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setShowPayCodeForm(value => !value)}><Plus className="mr-2 h-4 w-4" />Pay Code</Button><Button size="sm" onClick={() => setShowPayLineForm(value => !value)}><Plus className="mr-2 h-4 w-4" />Add Pay Line</Button></div></CardTitle><CardDescription>Set up the rows that should appear for each employee in the Future Systems worksheet.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {showPayCodeForm && <div className="grid gap-3 rounded-md border p-4 md:grid-cols-4"><div className="space-y-1"><Label>Code</Label><Input value={newPayCode.code} onChange={event => setNewPayCode({ ...newPayCode, code: event.target.value })} /></div><div className="space-y-1"><Label>Department</Label><Input value={newPayCode.department} onChange={event => setNewPayCode({ ...newPayCode, department: event.target.value })} /></div><div className="space-y-1"><Label>Default type</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={newPayCode.default_pay_type} onChange={event => setNewPayCode({ ...newPayCode, default_pay_type: event.target.value })}>{payTypeOptions.map(option => <option key={option}>{option}</option>)}</select></div><div className="flex items-end gap-2"><Button onClick={() => void addPayCode()}>Save Code</Button><Button variant="outline" onClick={() => setShowPayCodeForm(false)}>Cancel</Button></div></div>}
            {showPayLineForm && <div className="grid gap-3 rounded-md border p-4 md:grid-cols-4"><div className="space-y-1"><Label>Employee</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={newLine.employee_id} onChange={event => setNewLine({ ...newLine, employee_id: event.target.value })}><option value="">Choose employee</option>{employees.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div className="space-y-1"><Label>Pay code</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={newLine.pay_code_id} onChange={event => { const code = payCodes.find(item => item.id === event.target.value); setNewLine({ ...newLine, pay_code_id: event.target.value, department: code?.department || newLine.department, pay_type: code?.default_pay_type || newLine.pay_type }); }}><option value="">Choose code</option>{payCodes.map(code => <option key={code.id} value={code.id}>{code.code} · {code.department}</option>)}</select></div><div className="space-y-1"><Label>Department</Label><Input value={newLine.department} onChange={event => setNewLine({ ...newLine, department: event.target.value })} /></div><div className="space-y-1"><Label>Task / location label</Label><Input value={newLine.task_label} onChange={event => setNewLine({ ...newLine, task_label: event.target.value })} /></div><div className="space-y-1"><Label>Future Systems employee #</Label><Input value={newLine.provider_employee_number} onChange={event => setNewLine({ ...newLine, provider_employee_number: event.target.value })} /></div><div className="space-y-1"><Label>Rate</Label><Input type="number" min="0" step="0.01" value={newLine.rate} onChange={event => setNewLine({ ...newLine, rate: event.target.value })} /></div><div className="space-y-1"><Label>Type</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={newLine.pay_type} onChange={event => setNewLine({ ...newLine, pay_type: event.target.value })}>{payTypeOptions.map(option => <option key={option}>{option}</option>)}</select></div><div className="space-y-1"><Label>Effective date</Label><Input type="date" value={newLine.effective_date} onChange={event => setNewLine({ ...newLine, effective_date: event.target.value })} /></div><div className="flex items-end gap-2 md:col-span-4"><Button onClick={() => void addPayLine()}>Save Pay Line</Button><Button variant="outline" onClick={() => setShowPayLineForm(false)}>Cancel</Button></div></div>}
            <p className="text-sm text-muted-foreground">Rates for recorded work fill in automatically in the table below. Use "Add Pay Line" only for pay that has no wash records behind it, such as salary or travel.</p>
          </CardContent>
        </Card>}

        {activeTab === 'lines' && <PayrollRateSheet key={payLines.length} />}

        {activeTab === 'codes' && <Card>
          <CardHeader>
            <CardTitle className="text-lg">Work Type Codes</CardTitle>
            <CardDescription>Each work type gets one Future Systems E code, everywhere it is used. {unmappedCount > 0 ? `${unmappedCount} work types still need a code.` : 'Every work type has a code.'}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <Table className="min-w-[640px]">
                <TableHeader><TableRow><TableHead>Work Type</TableHead><TableHead>E Code</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {workTypes.map(type => (
                    <TableRow key={type.id}>
                      <TableCell>{type.name}</TableCell>
                      <TableCell>
                        <select className="h-10 w-56 rounded-md border bg-background px-3 text-sm" value={workTypeCodes[type.id] || ''} onChange={event => void setWorkTypeCode(type.id, event.target.value)}>
                          <option value="">Not assigned</option>
                          {payCodes.map(code => <option key={code.id} value={code.id}>{code.code} · {code.description || code.department}</option>)}
                        </select>
                      </TableCell>
                      <TableCell>{workTypeCodes[type.id] ? <span className="text-sm text-muted-foreground">Mapped</span> : <span className="rounded-full bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">Needs a code</span>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>}

        {activeTab === 'ecodes' && <PayrollPayCodes />}

        {activeTab === 'hours' && <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Upload className="h-5 w-5" />Import Hours</CardTitle><CardDescription>Upload the weekly CSV or Excel file from the outside timekeeping system. The final step will map its columns into hours and overtime.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="rounded-md border border-dashed p-8 text-center"><Input type="file" accept=".csv,.xlsx,.xls" onChange={event => setHoursFile(event.target.files?.[0] || null)} /><p className="mt-2 text-sm text-muted-foreground">{hoursFile ? hoursFile.name : 'Choose a CSV or Excel file'}</p></div><Button onClick={() => void importHours()} disabled={!hoursFile || !period}><Upload className="mr-2 h-4 w-4" />Upload Hours for {period ? `${period.period_start} – ${period.period_end}` : 'selected week'}</Button><p className="text-sm text-muted-foreground">Required mapping: employee name or employee number, regular hours, and optional E02 overtime hours.</p></CardContent></Card>}
      </div>
    </Layout>
  );
};

export default PayrollDashboard;
