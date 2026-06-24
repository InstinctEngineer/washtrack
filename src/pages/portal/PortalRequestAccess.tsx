import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { PortalShell } from '@/components/PortalShell';

interface LocationRow {
  id: string;
  name: string;
  client_name: string;
}

export default function PortalRequestAccess() {
  const { user } = useAuth();
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data: locs } = await supabase
        .from('locations')
        .select('id, name, clients(name)')
        .eq('is_active', true)
        .order('name');
      const mapped: LocationRow[] = (locs || []).map((l: any) => ({
        id: l.id, name: l.name, client_name: l.clients?.name ?? '',
      }));
      setLocations(mapped);

      // Get portal user id
      const { data: pu } = await supabase
        .from('client_portal_users').select('id').eq('auth_user_id', user!.id).single();
      if (pu) {
        const { data: reqs } = await supabase
          .from('client_portal_access_requests')
          .select('location_id, status')
          .eq('portal_user_id', pu.id);
        const p = new Set<string>(); const a = new Set<string>();
        (reqs || []).forEach((r: any) => {
          if (r.status === 'pending') p.add(r.location_id);
          if (r.status === 'approved') a.add(r.location_id);
        });
        setPendingIds(p);
        setApprovedIds(a);
      }
    })();
  }, [user]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return locations.filter((l) =>
      l.name.toLowerCase().includes(q) || l.client_name.toLowerCase().includes(q)
    );
  }, [locations, search]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const submit = async () => {
    if (selected.size === 0) return;
    setSubmitting(true);
    try {
      const { data: pu } = await supabase
        .from('client_portal_users').select('id').eq('auth_user_id', user!.id).single();
      if (!pu) throw new Error('Portal account not found');
      const rows = Array.from(selected).map((location_id) => ({
        portal_user_id: pu.id, location_id, note: note || null,
      }));
      const { error } = await supabase.from('client_portal_access_requests').insert(rows);
      if (error) throw error;
      toast({ title: 'Requests submitted', description: 'You will receive access once approved.' });
      navigate('/portal/dashboard');
    } catch (e: any) {
      toast({ title: 'Submission failed', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PortalShell title="Request Location Access">
      <Card>
        <CardHeader>
          <CardTitle>Choose locations</CardTitle>
          <CardDescription>
            Select the locations you need access to. A finance team member will review your request.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Search by location or client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-96 overflow-auto border rounded-md divide-y">
            {filtered.map((l) => {
              const isApproved = approvedIds.has(l.id);
              const isPending = pendingIds.has(l.id);
              const disabled = isApproved || isPending;
              return (
                <label key={l.id}
                  className={`flex items-center gap-3 p-3 ${disabled ? 'opacity-60' : 'cursor-pointer hover:bg-accent'}`}>
                  <Checkbox
                    checked={selected.has(l.id)}
                    onCheckedChange={() => !disabled && toggle(l.id)}
                    disabled={disabled}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{l.name}</div>
                    <div className="text-xs text-muted-foreground">{l.client_name}</div>
                  </div>
                  {isApproved && <span className="text-xs text-green-600 font-medium">Approved</span>}
                  {isPending && <span className="text-xs text-amber-600 font-medium">Pending</span>}
                </label>
              );
            })}
            {filtered.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">No locations match</div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Note (optional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g., I'm the facilities manager at..." />
          </div>
          {selected.size > 0 && (
            <Alert>
              <AlertDescription>{selected.size} location(s) selected</AlertDescription>
            </Alert>
          )}
          <Button onClick={submit} disabled={submitting || selected.size === 0} className="w-full">
            {submitting ? 'Submitting...' : 'Submit Access Request'}
          </Button>
        </CardContent>
      </Card>
    </PortalShell>
  );
}
