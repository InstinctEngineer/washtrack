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

interface PortalUserRow {
  id: string;
  email: string;
  display_name: string | null;
  company_name: string | null;
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
        id, email, display_name, company_name, is_active, disabled_reason,
        last_login_at, created_at,
        client_portal_location_access(location_id, locations(name))
      `)
      .order('created_at', { ascending: false });
    const rows: PortalUserRow[] = (data || []).map((u: any) => ({
      id: u.id, email: u.email, display_name: u.display_name, company_name: u.company_name,
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

  return (
    <Layout>
      <Card>
        <CardHeader><CardTitle>Client Portal Users</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email / Company</TableHead>
                  <TableHead>Locations</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableRow><TableCell colSpan={6}>Loading…</TableCell></TableRow>}
                {!loading && users.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No portal users.</TableCell></TableRow>
                )}
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.display_name || '-'}</TableCell>
                    <TableCell>
                      <div>{u.email}</div>
                      {u.company_name && <div className="text-xs text-muted-foreground">{u.company_name}</div>}
                    </TableCell>
                    <TableCell className="text-xs">
                      {u.locations.length === 0 ? <span className="text-muted-foreground">None</span> : u.locations.join(', ')}
                    </TableCell>
                    <TableCell className="text-xs">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'}
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
                        u.is_active
                          ? <Button size="sm" variant="outline" onClick={() => disable(u.id)}>Disable</Button>
                          : <Button size="sm" onClick={() => reEnable(u.id)}>Re-enable</Button>
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
