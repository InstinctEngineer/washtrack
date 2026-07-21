import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { PortalShell } from '@/components/PortalShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Star } from 'lucide-react';

interface Row { work_date: string; work_type_name: string; identifier: string | null; quantity: number; notes: string | null; }
interface DealershipRow { work_date: string; vehicle_count: number; }

function weekRange(offset = 0) {
  const now = new Date();
  const day = now.getDay(); // 0 Sun .. 6 Sat
  const diffToMon = (day + 6) % 7;
  const monday = new Date(now); monday.setDate(now.getDate() - diffToMon + offset * 7); monday.setHours(0,0,0,0);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0,10);
  return { start: fmt(monday), end: fmt(sunday) };
}

function monthRange(offset = 0) {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };
  return { start: fmt(first), end: fmt(last) };
}

export default function PortalLocationHistory() {
  const { id } = useParams<{ id: string }>();
  const [start, setStart] = useState(weekRange(0).start);
  const [end, setEnd] = useState(weekRange(0).end);
  const [rows, setRows] = useState<Row[]>([]);
  const [dealershipRows, setDealershipRows] = useState<DealershipRow[]>([]);
  const [locName, setLocName] = useState('');
  const [clientName, setClientName] = useState('');
  const [businessType, setBusinessType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc('get_portal_my_locations');
      const me = (data as any[])?.find((l) => l.location_id === id);
      if (me) {
        setLocName(me.location_name);
        setClientName(me.client_name);
        setBusinessType(me.business_type);
      }
    })();
  }, [id]);

  const load = async () => {
    if (!id) return;
    setLoading(true); setError('');
    try {
      if (businessType === 'dealership') {
        const { data, error } = await supabase.rpc('get_portal_dealership_history', {
          p_location_id: id, p_start: start, p_end: end,
        });
        if (error) throw error;
        setDealershipRows((data as DealershipRow[]) || []);
      } else {
        const { data, error } = await supabase.rpc('get_portal_work_history', {
          p_location_id: id, p_start: start, p_end: end,
        });
        if (error) throw error;
        setRows((data as Row[]) || []);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id && businessType !== null) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, businessType]);

  const filteredRows = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) =>
      (r.identifier || '').toLowerCase().includes(q) ||
      r.work_type_name.toLowerCase().includes(q) ||
      (r.notes || '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  const totalCount = useMemo(() => {
    if (businessType === 'dealership') {
      return dealershipRows.reduce((s, r) => s + Number(r.vehicle_count || 0), 0);
    }
    return filteredRows.reduce((s, r) => s + Number(r.quantity || 0), 0);
  }, [businessType, dealershipRows, filteredRows]);

  const totalLabel = businessType === 'dealership' ? 'Vehicles Washed' : 'Total Washes';

  const exportCsv = () => {
    if (businessType === 'dealership') {
      const header = 'date,vehicle_count\n';
      const body = dealershipRows.map((r) => `${r.work_date},${r.vehicle_count}`).join('\n');
      downloadCsv(header + body);
    } else {
      const header = 'date,work_type,identifier,quantity,notes\n';
      const body = filteredRows.map((r) =>
        `${r.work_date},"${r.work_type_name}","${r.identifier ?? ''}",${r.quantity},"${(r.notes ?? '').replace(/"/g, '""')}"`
      ).join('\n');
      downloadCsv(header + body);
    }
  };

  const downloadCsv = (csv: string) => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `wash-history-${locName}-${start}-${end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const shiftWeek = (offset: number) => {
    const r = weekRange(offset);
    setStart(r.start); setEnd(r.end);
  };
  const shiftMonth = (offset: number) => {
    const r = monthRange(offset);
    setStart(r.start); setEnd(r.end);
  };

  return (
    <PortalShell title={`${locName || 'Location'} — Wash History`}>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{clientName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-1.5 items-center">
            <div className="flex items-center gap-1">
              <Label className="text-xs text-muted-foreground">Start</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-8 w-[140px] text-sm" />
            </div>
            <div className="flex items-center gap-1">
              <Label className="text-xs text-muted-foreground">End</Label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-8 w-[140px] text-sm" />
            </div>
            <Button size="sm" className="h-8 px-3" onClick={load} disabled={loading}>{loading ? '…' : 'Search'}</Button>
            <Button size="sm" variant="outline" className="h-8 px-3" onClick={() => shiftWeek(0)}>This Week</Button>
            <Button size="sm" variant="outline" className="h-8 px-3" onClick={() => shiftWeek(-1)}>Last Week</Button>
            <Button size="sm" variant="outline" className="h-8 px-3" onClick={() => shiftMonth(0)}>This Month</Button>
            <Button size="sm" variant="outline" className="h-8 px-3" onClick={() => shiftMonth(-1)}>Last Month</Button>
            <Button size="sm" variant="outline" className="h-8 px-3" onClick={exportCsv}>Export CSV</Button>
            {businessType !== 'dealership' && (
              <Button asChild size="sm" variant="default" className="h-8 px-3 gap-1.5">
                <Link to={`/portal/locations/${id}/request-wash`}>
                  <Star className="h-3.5 w-3.5" /> Designate Weekly Washes
                </Link>
              </Button>
            )}
          </div>

          {error && <div className="text-destructive text-sm">{error}</div>}

          <div className="rounded-md border bg-muted/40 px-4 py-3 flex items-baseline justify-between">
            <div className="text-sm text-muted-foreground">
              {totalLabel} from <span className="font-medium text-foreground">{start}</span> to{' '}
              <span className="font-medium text-foreground">{end}</span>
            </div>
            <div className="text-2xl font-semibold tabular-nums">
              {totalCount.toLocaleString()}
            </div>
          </div>

          {businessType !== 'dealership' && (
            <Input
              placeholder="Filter by vehicle, work type, or notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}

          <div className="border rounded-md overflow-auto">
            {businessType === 'dealership' ? (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Date</TableHead><TableHead>Vehicles Washed</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {dealershipRows.length === 0 && !loading && (
                    <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-6">No washes recorded for this range.</TableCell></TableRow>
                  )}
                  {dealershipRows.map((r, i) => (
                    <TableRow key={i}><TableCell>{r.work_date}</TableCell><TableCell>{r.vehicle_count}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Work Type</TableHead>
                    <TableHead>Identifier</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.length === 0 && !loading && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No work recorded for this range.</TableCell></TableRow>
                  )}
                  {filteredRows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.work_date}</TableCell>
                      <TableCell>{r.work_type_name}</TableCell>
                      <TableCell>{r.identifier || '-'}</TableCell>
                      <TableCell>{r.quantity}</TableCell>
                      <TableCell className="max-w-xs truncate">{r.notes || ''}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>
    </PortalShell>
  );
}
