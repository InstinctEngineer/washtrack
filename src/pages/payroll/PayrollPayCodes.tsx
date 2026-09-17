import { useMemo, useState } from 'react';
import { Loader2, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { usePayCodes } from '@/hooks/usePayCodes';

type PayCode = {
  id: string;
  code: string;
  department: string;
  default_pay_type: string;
  description: string | null;
  is_active: boolean;
};

const payTypeOptions = ['Unit', 'Hourly', 'Salary'];
const emptyDraft = { code: '', department: '', default_pay_type: 'Unit', description: '' };

const PayrollPayCodes = () => {
  const { payCodes: codes, loading, refreshPayCodes } = usePayCodes();
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState(emptyDraft);

  const load = refreshPayCodes;

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return codes
      .filter(item => (showInactive ? true : item.is_active))
      .filter(item => !term || `${item.code} ${item.department} ${item.description || ''}`.toLowerCase().includes(term));
  }, [codes, search, showInactive]);

  const addCode = async () => {
    if (!draft.code.trim() || !draft.department.trim()) { toast.error('Enter a code and a department'); return; }
    setSaving(true);
    const { error } = await supabase.from('payroll_pay_codes').insert({
      code: draft.code.trim().toUpperCase(),
      department: draft.department.trim(),
      default_pay_type: draft.default_pay_type,
      description: draft.description.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error(error.code === '23505' ? 'That code already exists' : 'Could not save the code'); return; }
    setDraft(emptyDraft);
    setShowForm(false);
    await load();
    toast.success('E code added');
  };

  const startEdit = (item: PayCode) => {
    setEditingId(item.id);
    setEditDraft({ code: item.code, department: item.department, default_pay_type: item.default_pay_type, description: item.description || '' });
  };

  const saveEdit = async (id: string) => {
    if (!editDraft.code.trim() || !editDraft.department.trim()) { toast.error('Enter a code and a department'); return; }
    setSaving(true);
    const { error } = await supabase.from('payroll_pay_codes').update({
      code: editDraft.code.trim().toUpperCase(),
      department: editDraft.department.trim(),
      default_pay_type: editDraft.default_pay_type,
      description: editDraft.description.trim() || null,
    }).eq('id', id);
    setSaving(false);
    if (error) { toast.error(error.code === '23505' ? 'That code already exists' : 'Could not save changes'); return; }
    setEditingId(null);
    await load();
    toast.success('E code updated');
  };

  const toggleActive = async (item: PayCode) => {
    const { error } = await supabase.from('payroll_pay_codes').update({ is_active: !item.is_active }).eq('id', item.id);
    if (error) { toast.error('Could not change the code'); return; }
    await refreshPayCodes();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-lg">
          E Codes
          <Button size="sm" onClick={() => setShowForm(value => !value)}><Plus className="mr-2 h-4 w-4" />New E Code</Button>
        </CardTitle>
        <CardDescription>The Future Systems codes used on the payroll worksheet. Each code has a department, a description, and a default pay type.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="grid gap-3 rounded-md border p-4 md:grid-cols-4">
            <div className="space-y-1"><Label>Code</Label><Input placeholder="E25" value={draft.code} onChange={event => setDraft({ ...draft, code: event.target.value })} /></div>
            <div className="space-y-1"><Label>Department</Label><Input placeholder="FedEx" value={draft.department} onChange={event => setDraft({ ...draft, department: event.target.value })} /></div>
            <div className="space-y-1"><Label>Description</Label><Input placeholder="PUD" value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} /></div>
            <div className="space-y-1"><Label>Default type</Label>
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.default_pay_type} onChange={event => setDraft({ ...draft, default_pay_type: event.target.value })}>
                {payTypeOptions.map(option => <option key={option}>{option}</option>)}
              </select>
            </div>
            <div className="flex items-end gap-2 md:col-span-4">
              <Button onClick={() => void addCode()} disabled={saving}>Save Code</Button>
              <Button variant="outline" onClick={() => { setShowForm(false); setDraft(emptyDraft); }}>Cancel</Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search code, department, description" value={search} onChange={event => setSearch(event.target.value)} />
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowInactive(value => !value)}>{showInactive ? 'Hide retired' : 'Show retired'}</Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No E codes match.</p>
        ) : (
          <div className="overflow-auto">
            <Table className="min-w-[820px]">
              <TableHeader>
                <TableRow><TableHead>Code</TableHead><TableHead>Department</TableHead><TableHead>Description</TableHead><TableHead>Default Type</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {visible.map(item => (
                  <TableRow key={item.id} className={item.is_active ? '' : 'opacity-60'}>
                    {editingId === item.id ? (
                      <>
                        <TableCell><Input className="w-24" value={editDraft.code} onChange={event => setEditDraft({ ...editDraft, code: event.target.value })} /></TableCell>
                        <TableCell><Input className="w-36" value={editDraft.department} onChange={event => setEditDraft({ ...editDraft, department: event.target.value })} /></TableCell>
                        <TableCell><Input className="w-56" value={editDraft.description} onChange={event => setEditDraft({ ...editDraft, description: event.target.value })} /></TableCell>
                        <TableCell>
                          <select className="h-10 w-28 rounded-md border bg-background px-2 text-sm" value={editDraft.default_pay_type} onChange={event => setEditDraft({ ...editDraft, default_pay_type: event.target.value })}>
                            {payTypeOptions.map(option => <option key={option}>{option}</option>)}
                          </select>
                        </TableCell>
                        <TableCell>{item.is_active ? 'Active' : 'Retired'}</TableCell>
                        <TableCell className="space-x-2 text-right">
                          <Button size="sm" onClick={() => void saveEdit(item.id)} disabled={saving}>Save</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="font-medium">{item.code}</TableCell>
                        <TableCell>{item.department}</TableCell>
                        <TableCell>{item.description || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell>{item.default_pay_type}</TableCell>
                        <TableCell>{item.is_active ? <span className="text-sm text-muted-foreground">Active</span> : <span className="rounded-full bg-muted px-2 py-1 text-xs">Retired</span>}</TableCell>
                        <TableCell className="space-x-2 text-right">
                          <Button size="sm" variant="outline" onClick={() => startEdit(item)}>Edit</Button>
                          <Button size="sm" variant="ghost" onClick={() => void toggleActive(item)}>{item.is_active ? 'Retire' : 'Restore'}</Button>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PayrollPayCodes;
