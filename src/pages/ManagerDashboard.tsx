import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WashEntryTableEditor } from '@/components/WashEntryTableEditor';
import { useAuth } from '@/contexts/AuthContext';

export default function ManagerDashboard() {
  const { user } = useAuth();

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Manager Dashboard</h1>
          <p className="text-muted-foreground mt-2">Oversee operations and manage wash entries</p>
        </div>

        {user && <WashEntryTableEditor userId={user.id} />}

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Pending Approvals</CardTitle>
              <CardDescription>Supply requests awaiting review</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">No pending requests</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Team Performance</CardTitle>
              <CardDescription>Location statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Analytics coming soon</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
