import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Construction } from 'lucide-react';

export default function EmployeeDashboard() {
  const { userProfile, userLocations } = useAuth();

  if (!userLocations || userLocations.length === 0) {
    return (
      <Layout>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Contact admin to assign your location before tracking work
          </AlertDescription>
        </Alert>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Construction className="h-5 w-5" />
              Employee Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              The employee dashboard is being rebuilt with a new simplified workflow.
            </p>
            <p className="mt-4 text-sm">
              <strong>Coming soon:</strong> Select billable items for your assigned location and log work entries.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
