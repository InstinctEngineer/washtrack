import { useEffect, useMemo, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { findSimilarMatches } from '@/lib/fuzzyMatch';
import { format } from 'date-fns';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableTableHead } from '@/components/SortableTableHead';

interface Req {
  id: string;
  requested_by: string;
  requester_name?: string;
  proposed_client_name: string;
  proposed_location_name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

export default function DealershipRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [reviewing, setReviewing] = useState<Req | null>(null);
  const [decision, setDecision] = useState<'approve_new' | 'merge' | 'reject'>('approve_new');
  const [mergeClientId, setMergeClientId] = useState<string>('');
  const [reviewNotes, setReviewNotes] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('dealership_location_requests' as any)
      .select('*')
      .order('created_at', { ascending: false });
    const reqs = (data as any[]) || [];
    // Hydrate requester names
    const ids = Array.from(new Set(reqs.map((r) => r.requested_by)));
    let nameMap: Record<string, string> = {};
    if (ids.length > 0) {
      const { data: u } = await supabase.rpc('get_user_display_info', { user_ids: ids });
      (u || []).forEach((row: any) => (nameMap[row.id] = row.name));
    }
    setRequests(reqs.map((r) => ({ ...r, requester_name: nameMap[r.requested_by] || r.requested_by.slice(0, 8) })));

    const { data: c } = await supabase
      .from('clients')
      .select('id, name, business_type')
      .eq('business_type', 'dealership')
      .order('name');
    setClients((c || []).map((x: any) => ({ id: x.id, name: x.name })));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const suggestions = useMemo(() => {
    if (!reviewing) return [];
    return findSimilarMatches(reviewing.proposed_client_name, clients, 0.5, 5);
  }, [reviewing, clients]);

  const handleApprove = async () => {
    if (!reviewing || !user) return;
    try {
      if (decision === 'reject') {
        const { error } = await supabase
          .from('dealership_location_requests' as any)
          .update({
            status: 'rejected',
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
            review_notes: reviewNotes || null,
          })
          .eq('id', reviewing.id);
        if (error) throw error;
      } else {
        let clientId = mergeClientId;
        if (decision === 'approve_new') {
          // Create client
          const { data: c, error: ce } = await supabase
            .from('clients')
            .insert({
              name: reviewing.proposed_client_name,
              business_type: 'dealership',
              is_active: true,
            } as any)
            .select('id')
            .single();
          if (ce) throw ce;
          clientId = c.id;
        }
        // Create location under the chosen client
        const addressFull = [reviewing.address, reviewing.city, reviewing.state].filter(Boolean).join(', ') || null;
        const { data: loc, error: le } = await supabase
          .from('locations')
          .insert({
            client_id: clientId,
            name: reviewing.proposed_location_name,
            address: addressFull,
            is_active: true,
          } as any)
          .select('id')
          .single();
        if (le) throw le;

        // Assign requester to the new location
        await supabase.from('user_locations').insert({
          user_id: reviewing.requested_by,
          location_id: loc.id,
          is_primary: false,
        } as any);

        const { error: ue } = await supabase
          .from('dealership_location_requests' as any)
          .update({
            status: decision === 'merge' ? 'merged' : 'approved',
            matched_client_id: decision === 'merge' ? clientId : null,
            created_client_id: decision === 'approve_new' ? clientId : null,
            created_location_id: loc.id,
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
            review_notes: reviewNotes || null,
          })
          .eq('id', reviewing.id);
        if (ue) throw ue;
      }
      toast.success('Request processed');
      setReviewing(null);
      setMergeClientId('');
      setReviewNotes('');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to process');
    }
  };

  const pending = requests.filter((r) => r.status === 'pending');
  const processed = requests.filter((r) => r.status !== 'pending');

  const pendingSort = useTableSort(pending, {
    getValue: (r, col) => {
      switch (col) {
        case 'created_at': return new Date(r.created_at);
        case 'requester_name': return r.requester_name || '';
        case 'proposed_client_name': return r.proposed_client_name;
        case 'proposed_location_name': return r.proposed_location_name;
        case 'address': return [r.address, r.city, r.state].filter(Boolean).join(', ');
        default: return '';
      }
    },
  });
  const processedSort = useTableSort(processed.slice(0, 30), {
    getValue: (r, col) => {
      switch (col) {
        case 'created_at': return new Date(r.created_at);
        case 'proposed_client_name': return r.proposed_client_name;
        case 'proposed_location_name': return r.proposed_location_name;
        case 'status': return r.status;
        default: return '';
      }
    },
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dealership Location Requests</h1>
          <p className="text-muted-foreground">Review and approve new dealership locations submitted from the field</p>
        </div>

        <Card>
          <CardHeader><CardTitle>Pending ({pending.length})</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-muted-foreground">Loading…</div>
            ) : pending.length === 0 ? (
              <p className="text-muted-foreground">Nothing waiting for review.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead column="created_at" sortColumn={pendingSort.sortColumn} sortDirection={pendingSort.sortDirection} onSort={pendingSort.handleSort}>Requested</SortableTableHead>
                    <SortableTableHead column="requester_name" sortColumn={pendingSort.sortColumn} sortDirection={pendingSort.sortDirection} onSort={pendingSort.handleSort}>By</SortableTableHead>
                    <SortableTableHead column="proposed_client_name" sortColumn={pendingSort.sortColumn} sortDirection={pendingSort.sortDirection} onSort={pendingSort.handleSort}>Dealership</SortableTableHead>
                    <SortableTableHead column="proposed_location_name" sortColumn={pendingSort.sortColumn} sortDirection={pendingSort.sortDirection} onSort={pendingSort.handleSort}>Lot</SortableTableHead>
                    <SortableTableHead column="address" sortColumn={pendingSort.sortColumn} sortDirection={pendingSort.sortDirection} onSort={pendingSort.handleSort}>Address</SortableTableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingSort.sortedData.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{format(new Date(r.created_at), 'MMM d')}</TableCell>
                      <TableCell>{r.requester_name}</TableCell>
                      <TableCell className="font-medium">{r.proposed_client_name}</TableCell>
                      <TableCell>{r.proposed_location_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {[r.address, r.city, r.state].filter(Boolean).join(', ') || '—'}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" onClick={() => { setReviewing(r); setDecision('approve_new'); }}>
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {processed.length > 0 && (
          <Card>
            <CardHeader><CardTitle>History</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead column="created_at" sortColumn={processedSort.sortColumn} sortDirection={processedSort.sortDirection} onSort={processedSort.handleSort}>Date</SortableTableHead>
                    <SortableTableHead column="proposed_client_name" sortColumn={processedSort.sortColumn} sortDirection={processedSort.sortDirection} onSort={processedSort.handleSort}>Dealership</SortableTableHead>
                    <SortableTableHead column="proposed_location_name" sortColumn={processedSort.sortColumn} sortDirection={processedSort.sortDirection} onSort={processedSort.handleSort}>Lot</SortableTableHead>
                    <SortableTableHead column="status" sortColumn={processedSort.sortColumn} sortDirection={processedSort.sortDirection} onSort={processedSort.handleSort}>Status</SortableTableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedSort.sortedData.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{format(new Date(r.created_at), 'MMM d')}</TableCell>
                      <TableCell>{r.proposed_client_name}</TableCell>
                      <TableCell>{r.proposed_location_name}</TableCell>
                      <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Review request</DialogTitle></DialogHeader>
            {reviewing && (
              <div className="space-y-4 py-2">
                <div className="rounded-md border p-3 bg-muted/30 text-sm">
                  <div><span className="text-muted-foreground">Dealership: </span><b>{reviewing.proposed_client_name}</b></div>
                  <div><span className="text-muted-foreground">Lot: </span><b>{reviewing.proposed_location_name}</b></div>
                  <div><span className="text-muted-foreground">Address: </span>{[reviewing.address, reviewing.city, reviewing.state].filter(Boolean).join(', ') || '—'}</div>
                  {reviewing.notes && <div className="mt-1"><span className="text-muted-foreground">Notes: </span>{reviewing.notes}</div>}
                </div>

                {suggestions.length > 0 && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                    <div className="font-medium mb-1">Possible existing matches:</div>
                    <ul className="list-disc pl-4">
                      {suggestions.map((s) => (
                        <li key={s.item.id}>{s.item.name} <span className="text-muted-foreground">({Math.round(s.score * 100)}%)</span></li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Decision</Label>
                  <Select value={decision} onValueChange={(v: any) => setDecision(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="approve_new">Approve as new dealership</SelectItem>
                      <SelectItem value="merge">Merge into existing dealership</SelectItem>
                      <SelectItem value="reject">Reject</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {decision === 'merge' && (
                  <div className="space-y-2">
                    <Label>Existing dealership</Label>
                    <Select value={mergeClientId} onValueChange={setMergeClientId}>
                      <SelectTrigger><SelectValue placeholder="Pick existing dealership" /></SelectTrigger>
                      <SelectContent>
                        {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Review notes (optional)</Label>
                  <Textarea rows={2} value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewing(null)}>Cancel</Button>
              <Button onClick={handleApprove} disabled={decision === 'merge' && !mergeClientId}>
                {decision === 'reject' ? 'Reject' : decision === 'merge' ? 'Merge & approve' : 'Approve'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}