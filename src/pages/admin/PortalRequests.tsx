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
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { hasRoleOrHigher } from '@/lib/roleUtils';

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

interface AccountRow {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  work_location: string | null;
  approval_status: 'pending' | 'approved' | 'denied';
  onboarding_completed: boolean;
  is_active: boolean;
  disabled_reason: string | null;
  denial_note: string | null;
  created_at: string;
  last_login_at: string | null;
  locations: string[];
}

interface LocationOption { id: string; name: string; client_name: string }

export default function PortalRequests() {
  const { userRole } = useAuth();
  const canManage = userRole && hasRoleOrHigher(userRole, 'finance');

  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'approved' | 'denied'>('pending');
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountTab, setAccountTab] = useState<'pending' | 'approved' | 'denied'>('pending');
  const [locations, setLocations] = useState<LocationOption[]>([]);

  const [approveOpen, setApproveOpen] = useState(false);
  const [approveUser, setApproveUser] = useState<AccountRow | null>(null);
  const [selectedLocs, setSelectedLocs] = useState<Set<string>>(new Set());

  const [denyOpen, setDenyOpen] = useState(false);
  const [denyUser, setDenyUser] = useState<AccountRow | null>(null);
  const [denyNote, setDenyNote] = useState('');

  const [submitting, setSubmitting] = useState(false);

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

  const loadAccounts = async () => {
    setAccountsLoading(true);
    const { data } = await supabase
      .from('client_portal_users')
      .select(`
        id, email, display_name, first_name, last_name, work_location,
        approval_status, onboarding_completed, denial_note,
        is_active, disabled_reason, last_login_at, created_at,
        client_portal_location_access(location_id, locations(name))
      `)
      .order('created_at', { ascending: false });
    const rows: AccountRow[] = (data || []).map((u: any) => ({
      id: u.id, email: u.email, display_name: u.display_name,
      first_name: u.first_name, last_name: u.last_name, work_location: u.work_location,
      approval_status: u.approval_status, onboarding_completed: !!u.onboarding_completed,
      is_active: u.is_active, disabled_reason: u.disabled_reason,
      denial_note: u.denial_note ?? null,
      last_login_at: u.last_login_at, created_at: u.created_at,
      locations: (u.client_portal_location_access || []).map((a: any) => a.locations?.name).filter(Boolean),
    }));
    setAccounts(rows);
    setAccountsLoading(false);
  };

  const loadLocations = async () => {
    const { data } = await supabase
      .from('locations')
      .select('id, name, clients(name)')
      .order('name');
    setLocations((data || []).map((l: any) => ({
      id: l.id, name: l.name, client_name: l.clients?.name || '',
    })));
  };

  useEffect(() => { load(); loadAccounts(); loadLocations(); }, []);

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

  const openApprove = (u: AccountRow) => {
    setApproveUser(u);
    setSelectedLocs(new Set());
    setApproveOpen(true);
  };

  const openDeny = (u: AccountRow) => {
    setDenyUser(u);
    setDenyNote('');
    setDenyOpen(true);
  };

  const confirmApprove = async () => {
    if (!approveUser) return;
    if (selectedLocs.size === 0) {
      toast({ title: 'Pick at least one location', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const rows = Array.from(selectedLocs).map((location_id) => ({
      portal_user_id: approveUser.id,
      location_id,
    }));
    const { error: accessErr } = await supabase
      .from('client_portal_location_access')
      .upsert(rows, { onConflict: 'portal_user_id,location_id', ignoreDuplicates: true });
    if (accessErr) {
      setSubmitting(false);
      toast({ title: 'Failed to assign locations', description: accessErr.message, variant: 'destructive' });
      return;
    }
    const { error } = await supabase.functions.invoke('set-portal-approval', {
      body: { portal_user_id: approveUser.id, action: 'approve' },
    });
    setSubmitting(false);
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Account approved' }); setApproveOpen(false); loadAccounts(); }
  };

  const confirmDeny = async () => {
    if (!denyUser) return;
    setSubmitting(true);
    const { error } = await supabase.functions.invoke('set-portal-approval', {
      body: { portal_user_id: denyUser.id, action: 'deny', note: denyNote.trim() || null },
    });
    setSubmitting(false);
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Account denied' }); setDenyOpen(false); loadAccounts(); }
  };

  const reEnable = async (id: string) => {
    const { error } = await supabase
      .from('client_portal_users')
      .update({ is_active: true, disabled_reason: null, last_login_at: new Date().toISOString() })
      .eq('id', id);
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Account re-enabled' }); loadAccounts(); }
  };

  const disable = async (id: string) => {
    const { error } = await supabase
      .from('client_portal_users')
      .update({ is_active: false, disabled_reason: 'manual' })
      .eq('id', id);
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Account disabled' }); loadAccounts(); }
  };

  const deleteAccount = async (id: string) => {
    const { error } = await supabase.functions.invoke('delete-portal-user', {
      body: { portal_user_id: id },
    });
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Account deleted' }); loadAccounts(); }
  };

  const filtered = requests.filter((r) => r.status === tab);
  const filteredAccounts = accounts.filter((a) => a.approval_status === accountTab);

  return (
    <Layout>
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Account Approvals</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={accountTab} onValueChange={(v) => setAccountTab(v as any)}>
            <TabsList>
              <TabsTrigger value="pending">
                Pending{accounts.filter((a) => a.approval_status === 'pending').length > 0 &&
                  ` (${accounts.filter((a) => a.approval_status === 'pending').length})`}
              </TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="denied">Denied</TabsTrigger>
            </TabsList>
            <TabsContent value={accountTab}>
              <div className="overflow-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Work Location</TableHead>
                      {accountTab === 'approved' && <TableHead>Locations</TableHead>}
                      {accountTab === 'denied' && <TableHead>Reason</TableHead>}
                      <TableHead>{accountTab === 'pending' ? 'Signed Up' : accountTab === 'approved' ? 'Last Login' : 'Denied On'}</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accountsLoading && <TableRow><TableCell colSpan={6}>Loading…</TableCell></TableRow>}
                    {!accountsLoading && filteredAccounts.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No accounts.</TableCell></TableRow>
                    )}
                    {filteredAccounts.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">
                          {[u.first_name, u.last_name].filter(Boolean).join(' ') || u.display_name || '-'}
                          {!u.onboarding_completed && u.approval_status === 'pending' && (
                            <Badge variant="outline" className="ml-2 text-xs">onboarding incomplete</Badge>
                          )}
                        </TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell className="text-sm">{u.work_location || <span className="text-muted-foreground">—</span>}</TableCell>
                        {accountTab === 'approved' && (
                          <TableCell className="text-xs">
                            {u.locations.length === 0 ? <span className="text-muted-foreground">None</span> : u.locations.join(', ')}
                          </TableCell>
                        )}
                        {accountTab === 'denied' && (
                          <TableCell className="text-xs italic text-muted-foreground max-w-xs">
                            {u.denial_note || '—'}
                          </TableCell>
                        )}
                        <TableCell className="text-xs">
                          {accountTab === 'approved'
                            ? (u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never')
                            : new Date(u.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {canManage && (
                            <div className="flex flex-wrap gap-2">
                              {u.approval_status === 'pending' && (
                                <>
                                  <Button size="sm" onClick={() => openApprove(u)}>Approve</Button>
                                  <Button size="sm" variant="destructive" onClick={() => openDeny(u)}>Deny</Button>
                                </>
                              )}
                              {u.approval_status === 'denied' && (
                                <Button size="sm" onClick={() => openApprove(u)}>Approve</Button>
                              )}
                              {u.approval_status === 'approved' && (
                                u.is_active
                                  ? <Button size="sm" variant="outline" onClick={() => disable(u.id)}>Disable</Button>
                                  : <Button size="sm" onClick={() => reEnable(u.id)}>Re-enable</Button>
                              )}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="destructive">Delete</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete portal account?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Permanently deletes <strong>{u.email}</strong>, their login, location access,
                                      and access requests. They can sign up again from scratch.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteAccount(u.id)}>Delete</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Location Access Requests</CardTitle>
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

      {/* Approve dialog */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Approve {approveUser?.email}</DialogTitle>
            <DialogDescription>
              Select the locations this portal user should be able to view work history for.
              {approveUser?.work_location && (
                <> They listed their work location as <strong>{approveUser.work_location}</strong>.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 border rounded-md p-3 max-h-[50vh] overflow-y-auto">
            {locations.length === 0 && <p className="text-sm text-muted-foreground">No locations available.</p>}
            {locations.map((l) => {
              const checked = selectedLocs.has(l.id);
              return (
                <label key={l.id} className="flex items-start gap-2 cursor-pointer">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => {
                      const next = new Set(selectedLocs);
                      if (v) next.add(l.id); else next.delete(l.id);
                      setSelectedLocs(next);
                    }}
                  />
                  <span className="text-sm">
                    <span className="font-medium">{l.name}</span>
                    {l.client_name && <span className="text-muted-foreground"> — {l.client_name}</span>}
                  </span>
                </label>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={confirmApprove} disabled={submitting || selectedLocs.size === 0}>
              Approve & grant access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deny dialog */}
      <Dialog open={denyOpen} onOpenChange={setDenyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deny {denyUser?.email}?</DialogTitle>
            <DialogDescription>
              The account will be disabled, any location access revoked, and the session signed out.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="denyNote">Reason (optional)</Label>
            <Textarea
              id="denyNote"
              value={denyNote}
              onChange={(e) => setDenyNote(e.target.value)}
              placeholder="Internal note for why this account was denied"
              maxLength={500}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDenyOpen(false)} disabled={submitting}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeny} disabled={submitting}>Deny account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
