import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WashEntryTableEditor } from '@/components/WashEntryTableEditor';
import { ReportTemplateList } from '@/components/ReportBuilder/ReportTemplateList';
import { ReportBuilderWizard } from '@/components/ReportBuilder/ReportBuilderWizard';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ReportTemplate, executeReport } from '@/lib/reportBuilder';
import { exportToExcel } from '@/lib/excelExporter';
import { toast } from 'sonner';

export default function FinanceDashboard() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [showWizard, setShowWizard] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('report_templates')
        .select('*')
        .order('is_system_template', { ascending: false })
        .order('use_count', { ascending: false });

      if (error) throw error;
      setTemplates(data as any || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to load report templates');
    }
  };

  const handleRunTemplate = async (template: ReportTemplate) => {
    setLoading(true);
    try {
      // Update use count and last used timestamp
      await supabase
        .from('report_templates')
        .update({
          use_count: template.use_count + 1,
          last_used_at: new Date().toISOString(),
        } as any)
        .eq('id', template.id);

      // Execute report
      const data = await executeReport(template.config);
      
      // Export to Excel
      exportToExcel(data, template.template_name.toLowerCase().replace(/\s+/g, '_'), 'Report');
      
      toast.success('Report exported successfully!');
      fetchTemplates(); // Refresh to show updated use count
    } catch (error) {
      console.error('Error running report:', error);
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (template: ReportTemplate) => {
    if (!confirm(`Are you sure you want to delete "${template.template_name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('report_templates')
        .delete()
        .eq('id', template.id);

      if (error) throw error;

      toast.success('Template deleted successfully');
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Finance Dashboard</h1>
          <p className="text-muted-foreground mt-2">Billing reports and wash entry management</p>
        </div>

        <Tabs defaultValue="reports" className="w-full">
          <TabsList>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="entries">Wash Entries</TabsTrigger>
            <TabsTrigger value="overview">Overview</TabsTrigger>
          </TabsList>

          <TabsContent value="reports" className="space-y-4">
            <ReportTemplateList
              templates={templates}
              onRunTemplate={handleRunTemplate}
              onCreateNew={() => setShowWizard(true)}
              onDelete={handleDelete}
            />
          </TabsContent>

          <TabsContent value="entries" className="space-y-4">
            {user && <WashEntryTableEditor userId={user.id} />}
          </TabsContent>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Billing</CardTitle>
                  <CardDescription>Generate reports</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Use Reports tab to generate billing reports</p>
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
          </TabsContent>
        </Tabs>

        <ReportBuilderWizard
          open={showWizard}
          onClose={() => setShowWizard(false)}
          onSave={() => {
            fetchTemplates();
            setShowWizard(false);
          }}
        />
      </div>
    </Layout>
  );
}
