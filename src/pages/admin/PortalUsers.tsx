import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Link } from 'react-router-dom';

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
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableRow><TableCell colSpan={7}>Loading…</TableCell></TableRow>}
                {!loading && users.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No portal users.</TableCell></TableRow>
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
