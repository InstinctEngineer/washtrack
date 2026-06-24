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
  last_login_at: string | null;
  created_at: string;
  locations: string[];
}

export default function PortalUsers() {
  const { userRole } = useAuth();
  const [users, setUsers] = useState<PortalUserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('client_portal_users')
      .select(`
        id, email, display_name, first_name, last_name, work_location,
        approval_status, onboarding_completed,
        is_active, disabled_reason, last_login_at, created_at,
        client_portal_location_access(location_id, locations(name))
      `)
      .order('created_at', { ascending: false });
    const rows: PortalUserRow[] = (data || []).map((u: any) => ({
      id: u.id, email: u.email, display_name: u.display_name,
      first_name: u.first_name, last_name: u.last_name, work_location: u.work_location,
      approval_status: u.approval_status, onboarding_completed: !!u.onboarding_completed,
      is_active: u.is_active, disabled_reason: u.disabled_reason, last_login_at: u.last_login_at,
      created_at: u.created_at,
      locations: (u.client_portal_location_access || []).map((a: any) => a.locations?.name).filter(Boolean),
    }));
    setUsers(rows);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

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

  const setApproval = async (id: string, action: 'approve' | 'deny') => {
    const { error } = await supabase.functions.invoke('set-portal-approval', {
      body: { portal_user_id: id, action },
    });
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else { toast({ title: action === 'approve' ? 'Account approved' : 'Account denied' }); load(); }
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

  const pending = users.filter((u) => u.approval_status === 'pending' && u.onboarding_completed);

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
                      </TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell className="text-sm">{u.work_location || '-'}</TableCell>
                      <TableCell className="text-xs">{new Date(u.created_at).toLocaleString()}</TableCell>
                      <TableCell>
                        {canManage && (
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => setApproval(u.id, 'approve')}>Approve</Button>
                            <Button size="sm" variant="destructive" onClick={() => setApproval(u.id, 'deny')}>Deny</Button>
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
                      {u.approval_status === 'denied' && <Badge variant="destructive">Denied</Badge>}
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
                          {u.approval_status === 'pending' && u.onboarding_completed && (
                            <>
                              <Button size="sm" onClick={() => setApproval(u.id, 'approve')}>Approve</Button>
                              <Button size="sm" variant="destructive" onClick={() => setApproval(u.id, 'deny')}>Deny</Button>
                            </>
                          )}
                          {u.approval_status === 'denied' && (
                            <Button size="sm" onClick={() => setApproval(u.id, 'approve')}>Approve</Button>
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
    </Layout>
  );
}
