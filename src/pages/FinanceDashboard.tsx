import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Construction } from 'lucide-react';

export default function FinanceDashboard() {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Data Export & Reports</h1>
          <p className="text-muted-foreground mt-2">Build custom reports and extract data from your work tracking system</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Construction className="h-5 w-5" />
              Reports Coming Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              The reporting system is being rebuilt to work with the new simplified data model.
            </p>
            <p className="mt-4 text-sm">
              <strong>New features:</strong> Filter work logs by date range, join with billable items for rates, calculate totals by client, and export to QuickBooks-compatible CSV.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
