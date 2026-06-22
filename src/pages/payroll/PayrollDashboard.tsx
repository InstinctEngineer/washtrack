import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, CalendarRange, Users, FileDown } from 'lucide-react';

const PayrollDashboard = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Wallet className="h-8 w-8 text-primary" />
            Payroll Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            ES&amp;D Payroll — separate from invoicing. Manage pay periods, employee pay rules, and exports.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarRange className="h-5 w-5 text-primary" />
                Pay Periods
              </CardTitle>
              <CardDescription>Coming next — create, lock, and mark periods paid.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Weekly Monday–Sunday cadence with a configurable check date.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5 text-primary" />
                Employee Pay Rules
              </CardTitle>
              <CardDescription>Coming next — per-employee hourly, unit, and salary lines.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Mirrors your existing payroll worksheet, one line per pay code × department × task.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileDown className="h-5 w-5 text-primary" />
                Export
              </CardTitle>
              <CardDescription>Coming next — CSV export matching your current spreadsheet format.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Provider-specific templates (Gusto, ADP, QuickBooks) can be added later.
            </CardContent>
          </Card>
        </div>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">Step 1 of the payroll buildout</CardTitle>
            <CardDescription>
              This is a placeholder dashboard so you can confirm the mode switch and green theme.
              The data layer (pay codes, departments, pay rules, periods, computation, and CSV export) lands next.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </Layout>
  );
};

export default PayrollDashboard;