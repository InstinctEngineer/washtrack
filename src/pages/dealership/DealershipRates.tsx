import { useEffect, useMemo, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, DollarSign } from 'lucide-react';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableTableHead } from '@/components/SortableTableHead';

interface RateRow {
  id: string;
  client_id: string;
  location_id: string | null;
  rate_per_vehicle: number;
  is_active: boolean;
  effective_date: string;
  client_name?: string;
  location_name?: string | null;
}

export default function DealershipRates() {
  const [rates, setRates] = useState<RateRow[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string; client_id: string }[]>([]);
  const [defaultRate, setDefaultRate] = useState<string>('5.25');
  const [loading, setLoading] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ client_id: '', location_id: '__all__', rate: '5.25' });

  const { sortedData: sortedRates, sortColumn, sortDirection, handleSort } = useTableSort(rates, {
    getValue: (r, col) => {
      switch (col) {
        case 'client': return r.client_name || '';
        case 'location': return r.location_name || '';
        case 'rate': return Number(r.rate_per_vehicle);
        case 'status': return r.is_active;
        default: return '';
      }
    },
  });

  const load = async () => {
    setLoading(true);
    const [{ data: rdata }, { data: cdata }, { data: ldata }, { data: sdata }] = await Promise.all([
      supabase.from('dealership_rates' as any).select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, name, business_type').eq('business_type', 'dealership'),
      supabase.from('locations').select('id, name, client_id, client:clients!inner(business_type)').eq('client.business_type', 'dealership'),
      supabase.from('system_settings').select('setting_value').eq('setting_key', 'dealership_default_rate').maybeSingle(),
    ]);
    const cArr = (cdata || []).map((c: any) => ({ id: c.id, name: c.name }));
    const lArr = (ldata || []).map((l: any) => ({ id: l.id, name: l.name, client_id: l.client_id }));
    setClients(cArr);
    setLocations(lArr);
    setRates(
      ((rdata as any[]) || []).map((r) => ({
        ...r,
        client_name: cArr.find((c) => c.id === r.client_id)?.name,
        location_name: r.location_id ? lArr.find((l) => l.id === r.location_id)?.name : null,
      }))
    );
    if (sdata?.setting_value) setDefaultRate(sdata.setting_value);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filteredLocations = useMemo(
    () => locations.filter((l) => l.client_id === form.client_id),
    [locations, form.client_id]
  );

  const handleSaveDefault = async () => {
    const v = parseFloat(defaultRate);
    if (!Number.isFinite(v) || v <= 0) {
      toast.error('Enter a valid rate');
      return;
    }
    const { error } = await supabase
      .from('system_settings')
      .update({ setting_value: String(v) })
      .eq('setting_key', 'dealership_default_rate');
    if (error) toast.error(error.message);
    else toast.success('Global default updated');
  };

  const handleAdd = async () => {
    if (!form.client_id) return toast.error('Pick a client');
    const r = parseFloat(form.rate);
    if (!Number.isFinite(r) || r <= 0) return toast.error('Enter a valid rate');
    const { error } = await supabase.from('dealership_rates' as any).insert({
      client_id: form.client_id,
      location_id: form.location_id === '__all__' ? null : form.location_id,
      rate_per_vehicle: r,
      is_active: true,
    });
    if (error) return toast.error(error.message);
    toast.success('Rate added');
    setShowAdd(false);
    setForm({ client_id: '', location_id: '__all__', rate: '5.25' });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this rate?')) return;
    const { error } = await supabase.from('dealership_rates' as any).delete().eq('id', id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dealership Rates</h1>
          <p className="text-muted-foreground">Per-vehicle pricing for dealership wash work</p>
        </div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" />Global default</CardTitle></CardHeader>
          <CardContent className="flex items-end gap-3">
            <div className="space-y-1">
              <Label>Default rate per vehicle</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={defaultRate}
                onChange={(e) => setDefaultRate(e.target.value)}
                className="w-32"
              />
            </div>
            <Button onClick={handleSaveDefault}>Save default</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Client / location overrides</CardTitle>
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add rate
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-muted-foreground">Loading…</div>
            ) : rates.length === 0 ? (
              <p className="text-muted-foreground">No overrides. The global default applies to everyone.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead column="client" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Client</SortableTableHead>
                    <SortableTableHead column="location" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Location</SortableTableHead>
                    <SortableTableHead column="rate" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} align="right">Rate</SortableTableHead>
                    <SortableTableHead column="status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Status</SortableTableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRates.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.client_name || r.client_id}</TableCell>
                      <TableCell>{r.location_name || <span className="text-muted-foreground">All locations</span>}</TableCell>
                      <TableCell className="text-right font-mono">${Number(r.rate_per_vehicle).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={r.is_active ? 'default' : 'secondary'}>{r.is_active ? 'Active' : 'Inactive'}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add dealership rate</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Client</Label>
                <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v, location_id: '__all__' })}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Location (optional)</Label>
                <Select value={form.location_id} onValueChange={(v) => setForm({ ...form, location_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All locations (client-wide)</SelectItem>
                    {filteredLocations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Rate per vehicle</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.rate}
                  onChange={(e) => setForm({ ...form, rate: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={handleAdd}>Add</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}