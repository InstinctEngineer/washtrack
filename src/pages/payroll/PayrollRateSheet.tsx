import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, format, startOfWeek, subDays } from 'date-fns';
import { Loader2, Pencil, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { usePayCodes, type PayCode } from '@/hooks/usePayCodes';

type SheetRow = {
  employee_id: string;
  employee_name: string;
  provider_employee_number: string | null;
  work_type_id: string;
  work_type_name: string;
  total_quantity: number;
  last_worked: string | null;
};


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
};

type Row = {
  key: string;
  employeeId: string | null;
  employeeName: string;
  providerNumber: string | null;
  workTypeName: string;
  payCodeId: string | null;
  payCode: PayCode | null;
  line: PayLine | null;
  history: PayLine[];
  quantity: number | null;
  isManual: boolean;
};

const asDateInput = (date: Date) => format(date, 'yyyy-MM-dd');
const today = () => asDateInput(new Date());
const mondayOf = (date: Date) => startOfWeek(date, { weekStartsOn: 1 });

const lastFirst = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name.trim();
  const last = parts.pop() as string;
  return `${last}, ${parts.join(' ')}`;
};

const money = (value: number) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const PayrollRateSheet = () => {
  const [startDate, setStartDate] = useState(asDateInput(subDays(new Date(), 90)));
  const [endDate, setEndDate] = useState(today());
  const [sheet, setSheet] = useState<SheetRow[]>([]);
  const { payCodeById } = usePayCodes();
  const [maps, setMaps] = useState<Record<string, string>>({});
  const [payLines, setPayLines] = useState<PayLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState('');
  const [drafts, setDrafts] = useState<Record<string, { rate: string; effective: string }>>({});
  const [editing, setEditing] = useState<Row | null>(null);
  const [editForm, setEditForm] = useState({ department: '', task_label: '', provider_employee_number: '', pay_type: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const [sheetResult, mapResult, linesResult] = await Promise.all([
      supabase.rpc('get_payroll_rate_sheet', { p_start_date: startDate, p_end_date: endDate }),
      supabase.from('payroll_work_type_map').select('work_type_id, pay_code_id').is('location_id', null),
      supabase.from('payroll_employee_lines').select('*').order('effective_date', { ascending: false }),
    ]);

    if (sheetResult.error || mapResult.error || linesResult.error) {
      toast.error('Could not load pay rates');
      setLoading(false);
      return;
    }

    setSheet(((sheetResult.data || []) as SheetRow[]).map(row => ({ ...row, total_quantity: Number(row.total_quantity) || 0 })));
    setMaps(Object.fromEntries(((mapResult.data || []) as Array<{ work_type_id: string; pay_code_id: string }>).map(item => [item.work_type_id, item.pay_code_id])));
    setPayLines(((linesResult.data || []) as PayLine[]).map(line => ({ ...line, rate: Number(line.rate) || 0 })));
    setLoading(false);
  }, [startDate, endDate]);

  useEffect(() => { void load(); }, [load]);

  const rows = useMemo<Row[]>(() => {
    const now = today();
    const codeById = payCodeById;
    const linesFor = (employeeId: string | null, payCodeId: string | null) =>
      payLines.filter(line => line.employee_id === employeeId && line.pay_code_id === payCodeId);

    const derived: Row[] = sheet.map(item => {
      const payCodeId = maps[item.work_type_id] || null;
      const history = payCodeId ? linesFor(item.employee_id, payCodeId) : [];
      const current = history.find(line => line.is_active && line.effective_date <= now && (!line.end_date || line.end_date >= now)) || null;
      return {
        key: `${item.employee_id}:${item.work_type_id}`,
        employeeId: item.employee_id,
        employeeName: item.employee_name,
        providerNumber: item.provider_employee_number,
        workTypeName: item.work_type_name,
        payCodeId,
        payCode: payCodeId ? codeById[payCodeId] || null : null,
        line: current,
        history,
        quantity: item.total_quantity,
        isManual: false,
      };
    });

    const covered = new Set(derived.filter(row => row.line).map(row => row.line?.id));
    const manual: Row[] = payLines
      .filter(line => !covered.has(line.id) && !derived.some(row => row.employeeId === line.employee_id && row.payCodeId === line.pay_code_id))
      .map(line => ({
        key: `manual:${line.id}`,
        employeeId: line.employee_id,
        employeeName: line.display_name,
        providerNumber: line.provider_employee_number,
        workTypeName: line.task_label,
        payCodeId: line.pay_code_id,
        payCode: codeById[line.pay_code_id] || null,
        line,
        history: linesFor(line.employee_id, line.pay_code_id),
        quantity: null,
        isManual: true,
      }));

    const term = search.trim().toLowerCase();
    return [...derived, ...manual]
      .filter(row => showInactive || !row.line || row.line.is_active)
      .filter(row => !term || row.employeeName.toLowerCase().includes(term) || row.workTypeName.toLowerCase().includes(term))
      .sort((a, b) => lastFirst(a.employeeName).localeCompare(lastFirst(b.employeeName)) || a.workTypeName.localeCompare(b.workTypeName));
  }, [sheet, payLines, maps, payCodeById, showInactive, search]);

  const missingCount = rows.filter(row => !row.line && row.payCodeId).length;
  const unmappedCount = rows.filter(row => !row.payCodeId).length;

  const draftFor = (row: Row) => drafts[row.key] || { rate: row.line ? String(row.line.rate) : '', effective: asDateInput(mondayOf(new Date())) };

  const saveRate = async (row: Row) => {
    const draft = draftFor(row);
    const rate = Number(draft.rate);
    if (!row.payCodeId || !row.payCode) { toast.error('This work type needs a Future Systems code first'); return; }
    if (!draft.rate || Number.isNaN(rate) || rate < 0) { toast.error('Enter a valid rate'); return; }
    if (row.line && rate === row.line.rate) { toast.info('That is already the rate'); return; }

    setSaving(row.key);
    const effective = draft.effective;
    const existing = row.line;

    if (existing && effective <= existing.effective_date) {
      const { error } = await supabase.from('payroll_employee_lines').update({ rate, effective_date: effective }).eq('id', existing.id);
      if (error) { toast.error('Could not save the rate'); setSaving(null); return; }
    } else {
      if (existing) {
        const { error } = await supabase
          .from('payroll_employee_lines')
          .update({ end_date: asDateInput(subDays(new Date(`${effective}T00:00:00`), 1)) })
          .eq('id', existing.id);
        if (error) { toast.error('Could not close the previous rate'); setSaving(null); return; }
      }
      const { error } = await supabase.from('payroll_employee_lines').insert({
        employee_id: row.employeeId,
        display_name: existing?.display_name || lastFirst(row.employeeName),
        provider_employee_number: existing?.provider_employee_number || row.providerNumber,
        pay_code_id: row.payCodeId,
        department: existing?.department || row.payCode.department,
        task_label: existing?.task_label || row.workTypeName,
        rate,
        pay_type: existing?.pay_type || row.payCode.default_pay_type,
        effective_date: effective,
        sort_order: existing?.sort_order ?? 0,
        is_active: true,
      });
      if (error) { toast.error('Could not save the rate'); setSaving(null); return; }
    }

    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      await supabase.from('activity_logs').insert({
        user_id: userData.user.id,
        action: 'payroll_rate_change',
        page: 'payroll',
        target: `${row.employeeName} · ${row.workTypeName}`,
        metadata: { old_rate: existing?.rate ?? null, new_rate: rate, effective_date: effective, pay_code: row.payCode.code },
      });
    }

    setDrafts(current => { const next = { ...current }; delete next[row.key]; return next; });
    setSaving(null);
    toast.success('Rate saved');
    void load();
  };

  const toggleActive = async (row: Row) => {
    if (!row.line) return;
    setSaving(row.key);
    const makeActive = !row.line.is_active;
    const update = makeActive
      ? { is_active: true, end_date: null }
      : { is_active: false, end_date: row.line.end_date || asDateInput(addDays(mondayOf(new Date()), 6)) };
    const { error } = await supabase.from('payroll_employee_lines').update(update).eq('id', row.line.id);
    setSaving(null);
    if (error) { toast.error('Could not update the line'); return; }
    toast.success(makeActive ? 'Line reactivated' : 'Line deactivated');
    void load();
  };

  const openEdit = (row: Row) => {
    if (!row.line) return;
    setEditing(row);
    setEditForm({
      department: row.line.department,
      task_label: row.line.task_label,
      provider_employee_number: row.line.provider_employee_number || '',
      pay_type: row.line.pay_type,
    });
  };

  const saveEdit = async () => {
    if (!editing?.line) return;
    setSaving(editing.key);
    const { error } = await supabase.from('payroll_employee_lines').update({
      department: editForm.department,
      task_label: editForm.task_label,
      provider_employee_number: editForm.provider_employee_number || null,
      pay_type: editForm.pay_type,
    }).eq('id', editing.line.id);
    setSaving(null);
    if (error) { toast.error('Could not save the changes'); return; }
    setEditing(null);
    toast.success('Pay line updated');
    void load();
  };

  let currentEmployee = '';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Pay Rates</CardTitle>
        <CardDescription>
          Every washer and the work they have actually recorded, filled in automatically. Set or change a rate on any row.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="space-y-2"><Label htmlFor="rateFrom">Work from</Label><Input id="rateFrom" type="date" value={startDate} onChange={event => setStartDate(event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="rateTo">Work to</Label><Input id="rateTo" type="date" value={endDate} onChange={event => setEndDate(event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="rateSearch">Search</Label><Input id="rateSearch" placeholder="Washer or work type" value={search} onChange={event => setSearch(event.target.value)} /></div>
          <div className="flex items-end gap-2">
            <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => { setStartDate(asDateInput(subDays(new Date(), 90))); setEndDate(today()); }}>Last 90 Days</Button>
          <Button variant="outline" size="sm" onClick={() => { setStartDate(`${new Date().getFullYear()}-01-01`); setEndDate(today()); }}>This Year</Button>
          <Button variant="outline" size="sm" onClick={() => { setStartDate('2000-01-01'); setEndDate(today()); }}>All Time</Button>
          <Button variant={showInactive ? 'default' : 'outline'} size="sm" onClick={() => setShowInactive(value => !value)}>{showInactive ? 'Hiding nothing' : 'Show inactive'}</Button>
        </div>

        {(missingCount > 0 || unmappedCount > 0) && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            {missingCount > 0 && <p>{missingCount} pay {missingCount === 1 ? 'rate still needs' : 'rates still need'} setting.</p>}
            {unmappedCount > 0 && <p>{unmappedCount} work {unmappedCount === 1 ? 'type has' : 'types have'} no Future Systems code yet — set them on the Work Type Codes tab.</p>}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading pay rates…</div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recorded work in this date range.</p>
        ) : (
          <div className="overflow-auto">
            <Table className="min-w-max">
              <TableHeader>
                <TableRow>
                  <TableHead>Washer</TableHead>
                  <TableHead>Employee #</TableHead>
                  <TableHead>Work Type</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead>Current Rate</TableHead>
                  <TableHead>New Rate</TableHead>
                  <TableHead>Starts</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(row => {
                  const draft = draftFor(row);
                  const showName = currentEmployee !== row.employeeName;
                  currentEmployee = row.employeeName;
                  const priorRates = row.history.filter(line => row.line ? line.id !== row.line.id : true);
                  return (
                    <TableRow key={row.key} className={row.line?.is_active === false ? 'opacity-60' : undefined}>
                      <TableCell className="font-medium">{showName ? lastFirst(row.employeeName) : ''}</TableCell>
                      <TableCell>{row.providerNumber || '—'}</TableCell>
                      <TableCell>
                        {row.workTypeName}
                        {row.isManual && <Badge variant="secondary" className="ml-2">Manual</Badge>}
                        {row.line?.is_active === false && <Badge variant="outline" className="ml-2">Inactive</Badge>}
                      </TableCell>
                      <TableCell>{row.payCode ? <span>{row.payCode.code}{!row.payCode.is_active && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">Retired</span>}</span> : <span className="text-destructive">No code</span>}</TableCell>
                      <TableCell className="text-right">{row.quantity ?? '—'}</TableCell>
                      <TableCell>
                        {row.line ? (
                          <div>
                            <div>{money(row.line.rate)}</div>
                            <div className="text-xs text-muted-foreground">since {row.line.effective_date}</div>
                            {priorRates.slice(0, 2).map(line => (
                              <div key={line.id} className="text-xs text-muted-foreground">was {money(line.rate)} {line.effective_date}–{line.end_date || 'open'}</div>
                            ))}
                          </div>
                        ) : <span className="text-destructive">Not set</span>}
                      </TableCell>
                      <TableCell>
                        <Input
                          className="w-24"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={draft.rate}
                          disabled={!row.payCodeId}
                          onChange={event => setDrafts(current => ({ ...current, [row.key]: { ...draft, rate: event.target.value } }))}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="w-36"
                          type="date"
                          value={draft.effective}
                          disabled={!row.payCodeId}
                          onChange={event => setDrafts(current => ({ ...current, [row.key]: { ...draft, effective: event.target.value } }))}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" onClick={() => void saveRate(row)} disabled={saving === row.key || !row.payCodeId || !draft.rate}>
                            {saving === row.key ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                          </Button>
                          {row.line && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
                              <Button size="sm" variant="outline" onClick={() => void toggleActive(row)} disabled={saving === row.key}>
                                {row.line.is_active ? 'Deactivate' : 'Reactivate'}
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!editing} onOpenChange={open => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit pay line</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Department</Label><Input value={editForm.department} onChange={event => setEditForm({ ...editForm, department: event.target.value })} /></div>
            <div className="space-y-1"><Label>Task / location label</Label><Input value={editForm.task_label} onChange={event => setEditForm({ ...editForm, task_label: event.target.value })} /></div>
            <div className="space-y-1"><Label>Future Systems employee #</Label><Input value={editForm.provider_employee_number} onChange={event => setEditForm({ ...editForm, provider_employee_number: event.target.value })} /></div>
            <div className="space-y-1"><Label>Type</Label><Input value={editForm.pay_type} onChange={event => setEditForm({ ...editForm, pay_type: event.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => void saveEdit()} disabled={!!saving}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default PayrollRateSheet;
