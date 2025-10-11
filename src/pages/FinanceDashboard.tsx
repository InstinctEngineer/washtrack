import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WashEntryTableEditor } from '@/components/WashEntryTableEditor';
import { useAuth } from '@/contexts/AuthContext';

export default function FinanceDashboard() {
  const { user } = useAuth();

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Finance Dashboard</h1>
          <p className="text-muted-foreground mt-2">Billing reports and wash entry management</p>
        </div>

        {user && <WashEntryTableEditor userId={user.id} />}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Billing</CardTitle>
              <CardDescription>Generate reports</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Export features coming soon</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Supply Orders</CardTitle>
              <CardDescription>Review and approve</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">No pending orders</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Revenue Summary</CardTitle>
              <CardDescription>Current month</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Data will appear here</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
