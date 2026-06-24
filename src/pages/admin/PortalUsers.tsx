import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { hasRoleOrHigher } from '@/lib/roleUtils';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface PortalUserRow {
  id: string;
  email: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  work_location: string | null;
  approval_status: 'pending' | 'approved' | 'denied';
  onboarding_completed: boolean;
  is_active: boolean;
  disabled_reason: string | null;
  denial_note: string | null;
  last_login_at: string | null;
  created_at: string;
  locations: string[];
}

interface LocationOption { id: string; name: string; client_name: string }

export default function PortalUsers() {
  const { userRole } = useAuth();
  const [users, setUsers] = useState<PortalUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<LocationOption[]>([]);

  // Approve dialog
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveUser, setApproveUser] = useState<PortalUserRow | null>(null);
  const [selectedLocs, setSelectedLocs] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  // Deny dialog
  const [denyOpen, setDenyOpen] = useState(false);
  const [denyUser, setDenyUser] = useState<PortalUserRow | null>(null);
  const [denyNote, setDenyNote] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('client_portal_users')
      .select(`
        id, email, display_name, first_name, last_name, work_location,
        approval_status, onboarding_completed, denial_note,
        is_active, disabled_reason, last_login_at, created_at,
        client_portal_location_access(location_id, locations(name))
      `)
      .order('created_at', { ascending: false });
    const rows: PortalUserRow[] = (data || []).map((u: any) => ({
      id: u.id, email: u.email, display_name: u.display_name,
      first_name: u.first_name, last_name: u.last_name, work_location: u.work_location,
      approval_status: u.approval_status, onboarding_completed: !!u.onboarding_completed,
      is_active: u.is_active, disabled_reason: u.disabled_reason, last_login_at: u.last_login_at,
      denial_note: u.denial_note ?? null,
      created_at: u.created_at,
      locations: (u.client_portal_location_access || []).map((a: any) => a.locations?.name).filter(Boolean),
    }));
    setUsers(rows);
    setLoading(false);
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

  useEffect(() => { load(); loadLocations(); }, []);

  const reEnable = async (id: string) => {
    const { error } = await supabase
      .from('client_portal_users')
      .update({ is_active: true, disabled_reason: null, last_login_at: new Date().toISOString() })
      .eq('id', id);
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Account re-enabled' }); load(); }
  };

  const disable = async (id: string) => {
    const { error } = await supabase
      .from('client_portal_users')
      .update({ is_active: false, disabled_reason: 'manual' })
      .eq('id', id);
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Account disabled' }); load(); }
  };

  const canManage = userRole && hasRoleOrHigher(userRole, 'finance');

  const openApprove = (u: PortalUserRow) => {
    setApproveUser(u);
    setSelectedLocs(new Set());
    setApproveOpen(true);
  };

  const openDeny = (u: PortalUserRow) => {
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
    // Grant locations first
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
    else {
      toast({ title: 'Account approved' });
      setApproveOpen(false);
      load();
    }
  };

  const confirmDeny = async () => {
    if (!denyUser) return;
    setSubmitting(true);
    const { error } = await supabase.functions.invoke('set-portal-approval', {
      body: { portal_user_id: denyUser.id, action: 'deny', note: denyNote.trim() || null },
    });
    setSubmitting(false);
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Account denied' });
      setDenyOpen(false);
      load();
    }
  };

  const deleteUser = async (id: string) => {
    const { error } = await supabase.functions.invoke('delete-portal-user', {
      body: { portal_user_id: id },
    });
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Account deleted' }); load(); }
  };

  const DeleteButton = ({ user }: { user: PortalUserRow }) => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="destructive">Delete</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete portal account?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes <strong>{user.email}</strong>, their login, location access,
            and access requests. They can sign up again from scratch. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => deleteUser(user.id)}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const pending = users.filter((u) => u.approval_status === 'pending');

  return (
    <Layout>
      {pending.length > 0 && (
        <Card className="mb-4 border-amber-500/50">
          <CardHeader>
            <CardTitle>Pending Approvals ({pending.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Work Location</TableHead>
                    <TableHead>Signed Up</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        {[u.first_name, u.last_name].filter(Boolean).join(' ') || u.display_name || '-'}
                        {!u.onboarding_completed && (
                          <Badge variant="outline" className="ml-2 text-xs">onboarding incomplete</Badge>
                        )}
                      </TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell className="text-sm">{u.work_location || '-'}</TableCell>
                      <TableCell className="text-xs">{new Date(u.created_at).toLocaleString()}</TableCell>
                      <TableCell>
                        {canManage && (
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => openApprove(u)}>Approve</Button>
                            <Button size="sm" variant="destructive" onClick={() => openDeny(u)}>Deny</Button>
                            <DeleteButton user={u} />
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Client Portal Users</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Work Location</TableHead>
                  <TableHead>Locations</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableRow><TableCell colSpan={8}>Loading…</TableCell></TableRow>}
                {!loading && users.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">No portal users.</TableCell></TableRow>
                )}
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {[u.first_name, u.last_name].filter(Boolean).join(' ') || u.display_name || '-'}
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell className="text-xs">{u.work_location || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-xs">
                      {u.locations.length === 0 ? <span className="text-muted-foreground">None</span> : u.locations.join(', ')}
                    </TableCell>
                    <TableCell className="text-xs">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'}
                    </TableCell>
                    <TableCell>
                      {u.approval_status === 'approved' && <Badge variant="default">Approved</Badge>}
                      {u.approval_status === 'pending' && <Badge variant="secondary">{u.onboarding_completed ? 'Pending' : 'Onboarding'}</Badge>}
                      {u.approval_status === 'denied' && (
                        <div className="flex flex-col gap-1">
                          <Badge variant="destructive" className="w-fit">Denied</Badge>
                          {u.denial_note && <span className="text-xs text-muted-foreground italic">"{u.denial_note}"</span>}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.is_active
                        ? <Badge variant="default">Active</Badge>
                        : <Badge variant="destructive">
                            Disabled{u.disabled_reason === 'inactivity_90d' ? ' (90d)' : ''}
                          </Badge>}
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
                          <DeleteButton user={u} />
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
