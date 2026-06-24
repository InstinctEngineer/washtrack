import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';

interface RequestRow {
  id: string;
  status: string;
  note: string | null;
  created_at: string;
  location_id: string;
  portal_user_id: string;
  location_name?: string;
  user_email?: string;
  user_name?: string;
  user_company?: string | null;
}

export default function PortalRequests() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'approved' | 'denied'>('pending');
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('client_portal_access_requests')
      .select(`
        id, status, note, created_at, location_id, portal_user_id,
        locations(name),
        client_portal_users(email, display_name, company_name)
      `)
      .order('created_at', { ascending: false });
    const rows: RequestRow[] = (data || []).map((r: any) => ({
      id: r.id, status: r.status, note: r.note, created_at: r.created_at,
      location_id: r.location_id, portal_user_id: r.portal_user_id,
      location_name: r.locations?.name,
      user_email: r.client_portal_users?.email,
      user_name: r.client_portal_users?.display_name,
      user_company: r.client_portal_users?.company_name,
    }));
    setRequests(rows);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const decide = async (id: string, decision: 'approved' | 'denied') => {
    try {
      const { error } = await supabase.functions.invoke('approve-portal-request', {
        body: { request_id: id, decision, review_note: reviewNotes[id] || null },
      });
      if (error) throw error;
      toast({ title: `Request ${decision}` });
      load();
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    }
  };

  const filtered = requests.filter((r) => r.status === tab);

  return (
    <Layout>
      <Card>
        <CardHeader>
          <CardTitle>Client Portal Access Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="denied">Denied</TabsTrigger>
            </TabsList>
            <TabsContent value={tab}>
              <div className="overflow-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Requester</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead>Submitted</TableHead>
                      {tab === 'pending' && <TableHead>Action</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && <TableRow><TableCell colSpan={5}>Loading…</TableCell></TableRow>}
                    {!loading && filtered.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No requests.</TableCell></TableRow>
                    )}
                    {filtered.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="font-medium">{r.user_name}</div>
                          <div className="text-xs text-muted-foreground">{r.user_email}</div>
                          {r.user_company && <div className="text-xs text-muted-foreground">{r.user_company}</div>}
                        </TableCell>
                        <TableCell>{r.location_name}</TableCell>
                        <TableCell className="max-w-xs">{r.note}</TableCell>
                        <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                        {tab === 'pending' && (
                          <TableCell>
                            <div className="flex flex-col gap-2 min-w-[220px]">
                              <Input
                                placeholder="Optional review note"
                                value={reviewNotes[r.id] || ''}
                                onChange={(e) => setReviewNotes((p) => ({ ...p, [r.id]: e.target.value }))}
                              />
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => decide(r.id, 'approved')}>Approve</Button>
                                <Button size="sm" variant="destructive" onClick={() => decide(r.id, 'denied')}>Deny</Button>
                              </div>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </Layout>
  );
}
