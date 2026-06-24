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
import { Edit, Power, Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

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
  location_ids: string[];
}

interface LocationOption {
  id: string;
  name: string;
  client_name: string;
}

export default function PortalUsers() {
  const [users, setUsers] = useState<PortalUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PortalUserRow | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: '', last_name: '', work_location: '',
    location_ids: [] as string[],
  });
  const [allLocations, setAllLocations] = useState<LocationOption[]>([]);
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
      location_ids: (u.client_portal_location_access || []).map((a: any) => a.location_id).filter(Boolean),
    }));
    setUsers(rows);
    setLoading(false);
  };

  const loadLocations = async () => {
    const { data } = await supabase
      .from('locations')
      .select('id, name, clients(name)')
      .order('name');
    setAllLocations(
      (data || []).map((l: any) => ({
        id: l.id, name: l.name, client_name: l.clients?.name ?? '',
      })),
    );
  };

  useEffect(() => { load(); loadLocations(); }, []);

  const openEdit = (u: PortalUserRow) => {
    setEditing(u);
    setEditForm({
      first_name: u.first_name ?? '',
      last_name: u.last_name ?? '',
      work_location: u.work_location ?? '',
      location_ids: [...u.location_ids],
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
    if (error) { setBusyId(null); toast.error(error.message); return; }

    const current = new Set(editing.location_ids);
    const next = new Set(editForm.location_ids);
    const toAdd = [...next].filter((id) => !current.has(id));
    const toRemove = [...current].filter((id) => !next.has(id));

    if (toRemove.length > 0) {
      const { error: rmErr } = await supabase
        .from('client_portal_location_access')
        .delete()
        .eq('portal_user_id', editing.id)
        .in('location_id', toRemove);
      if (rmErr) { setBusyId(null); toast.error(rmErr.message); return; }
    }
    if (toAdd.length > 0) {
      const { data: auth } = await supabase.auth.getUser();
      const { error: addErr } = await supabase
        .from('client_portal_location_access')
        .insert(toAdd.map((location_id) => ({
          portal_user_id: editing.id,
          location_id,
          granted_by: auth.user?.id ?? null,
        })));
      if (addErr) { setBusyId(null); toast.error(addErr.message); return; }
    }

    setBusyId(null);
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
                      <Badge variant={u.is_active ? 'default' : 'secondary'}>
                        {u.is_active
                          ? 'Active'
                          : `Inactive${u.disabled_reason === 'inactivity_90d' ? ' (90d)' : ''}`}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(u)}
                          disabled={busyId === u.id}
                          title="Edit portal user"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmToggle(u)}
                          disabled={busyId === u.id}
                          title={u.is_active ? 'Deactivate account' : 'Activate account'}
                        >
                          <Power className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDelete(u)}
                          disabled={busyId === u.id}
                          title="Permanently delete portal user"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
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
            <div>
              <Label>Approved locations</Label>
              <div className="mt-1 max-h-64 overflow-y-auto rounded-md border p-2 space-y-1">
                {allLocations.length === 0 && (
                  <p className="text-xs text-muted-foreground p-2">No locations available.</p>
                )}
                {allLocations.map((loc) => {
                  const checked = editForm.location_ids.includes(loc.id);
                  return (
                    <label
                      key={loc.id}
                      className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          setEditForm((f) => ({
                            ...f,
                            location_ids: v
                              ? [...f.location_ids, loc.id]
                              : f.location_ids.filter((id) => id !== loc.id),
                          }));
                        }}
                      />
                      <span className="text-sm">
                        {loc.name}
                        {loc.client_name && (
                          <span className="text-muted-foreground"> — {loc.client_name}</span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {editForm.location_ids.length} selected
              </p>
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
