import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Pencil, Power, Trash2 } from 'lucide-react';

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

export default function PortalUsers() {
  const [users, setUsers] = useState<PortalUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PortalUserRow | null>(null);
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', work_location: '' });
  const [confirmDelete, setConfirmDelete] = useState<PortalUserRow | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<PortalUserRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  useEffect(() => { load(); }, []);

  const openEdit = (u: PortalUserRow) => {
    setEditing(u);
    setEditForm({
      first_name: u.first_name ?? '',
      last_name: u.last_name ?? '',
      work_location: u.work_location ?? '',
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusyId(editing.id);
    const { error } = await supabase
      .from('client_portal_users')
      .update({
        first_name: editForm.first_name.trim() || null,
        last_name: editForm.last_name.trim() || null,
        work_location: editForm.work_location.trim() || null,
      })
      .eq('id', editing.id);
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    toast.success('Portal user updated');
    setEditing(null);
    load();
  };

  const toggleActive = async (u: PortalUserRow) => {
    setBusyId(u.id);
    const { error } = await supabase
      .from('client_portal_users')
      .update({
        is_active: !u.is_active,
        disabled_reason: !u.is_active ? null : 'manual',
      })
      .eq('id', u.id);
    setBusyId(null);
    setConfirmToggle(null);
    if (error) { toast.error(error.message); return; }
    toast.success(u.is_active ? 'Account deactivated' : 'Account reactivated');
    load();
  };

  const deleteUser = async (u: PortalUserRow) => {
    setBusyId(u.id);
    const { error } = await supabase.functions.invoke('delete-portal-user', {
      body: { portal_user_id: u.id },
    });
    setBusyId(null);
    setConfirmDelete(null);
    if (error) { toast.error(error.message); return; }
    toast.success('Portal user deleted');
    load();
  };

  return (
    <Layout>
      <Card>
        <CardHeader>
          <CardTitle>Client Portal Users</CardTitle>
          <p className="text-sm text-muted-foreground">
            Roster of portal accounts. Approve, deny, or delete signups from{' '}
            <Link to="/admin/portal-requests" className="underline">Portal Requests</Link>.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Work Location</TableHead>
                  <TableHead>Approved Locations</TableHead>
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
                      {u.approval_status === 'denied' && <Badge variant="destructive">Denied</Badge>}
                    </TableCell>
                    <TableCell>
                      {u.is_active
                        ? <Badge variant="default">Active</Badge>
                        : <Badge variant="destructive">
                            Disabled{u.disabled_reason === 'inactivity_90d' ? ' (90d)' : ''}
                          </Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(u)}
                          disabled={busyId === u.id}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1" />Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setConfirmToggle(u)}
                          disabled={busyId === u.id}
                        >
                          <Power className="h-3.5 w-3.5 mr-1" />
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setConfirmDelete(u)}
                          disabled={busyId === u.id}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Portal User</DialogTitle>
            <DialogDescription>{editing?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="first_name">First name</Label>
              <Input id="first_name" value={editForm.first_name}
                onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="last_name">Last name</Label>
              <Input id="last_name" value={editForm.last_name}
                onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="work_location">Work location</Label>
              <Input id="work_location" value={editForm.work_location}
                onChange={(e) => setEditForm({ ...editForm, work_location: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={busyId === editing?.id}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmToggle} onOpenChange={(o) => !o && setConfirmToggle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmToggle?.is_active ? 'Deactivate' : 'Reactivate'} {confirmToggle?.email}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmToggle?.is_active
                ? 'The user will lose portal access immediately. You can reactivate them later.'
                : 'The user will regain portal access using their existing approved locations.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmToggle && toggleActive(confirmToggle)}>
              {confirmToggle?.is_active ? 'Deactivate' : 'Reactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmDelete?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the portal account, location access, and sign-in. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDelete && deleteUser(confirmDelete)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
