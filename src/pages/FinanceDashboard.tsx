import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WashEntryTableEditor } from '@/components/WashEntryTableEditor';
import { ReportTemplateList } from '@/components/ReportBuilder/ReportTemplateList';
import { ReportBuilderPanel } from '@/components/ReportBuilder/ReportBuilderPanel';
import { RunReportDialog } from '@/components/ReportBuilder/RunReportDialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ReportTemplate, ReportConfig, executeReport } from '@/lib/reportBuilder';
import { exportToExcel } from '@/lib/excelExporter';
import { toast } from 'sonner';

export default function FinanceDashboard() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [showWizard, setShowWizard] = useState(false);
  const [showRunDialog, setShowRunDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('report_templates')
        .select('*')
        .eq('is_system_template', false) // Only show user-created templates
        .order('use_count', { ascending: false });

      if (error) throw error;
      setTemplates(data as any || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to load saved reports');
    }
  };

  const handleRunTemplate = (template: ReportTemplate) => {
    setSelectedTemplate(template);
    setShowRunDialog(true);
  };

  const executeTemplateReport = async (config: ReportConfig) => {
    if (!selectedTemplate) return;
    
    setLoading(true);
    try {
      // Update use count and last used timestamp
      await supabase
        .from('report_templates')
        .update({
          use_count: selectedTemplate.use_count + 1,
          last_used_at: new Date().toISOString(),
        } as any)
        .eq('id', selectedTemplate.id);

      // Execute report with config (ensure reportType is present)
      const data = await executeReport({
        ...config,
        reportType: 'unified'
      });
      
      // Determine sum columns based on selected columns
      const sumColumns: string[] = [];
      if (config.columns.includes('final_amount')) {
        sumColumns.push('Final Amount ($)');
      }
      if (config.columns.includes('total_revenue')) {
        sumColumns.push('Total Revenue ($)');
      }
      if (config.columns.includes('total_washes')) {
        sumColumns.push('Total Washes');
      }
      
      // Export to Excel with sum rows
      exportToExcel(
        data, 
        selectedTemplate.template_name.toLowerCase().replace(/\s+/g, '_'), 
        'Report',
        { addSumRow: sumColumns.length > 0, sumColumns }
      );
      
      toast.success('Report exported successfully!');
      fetchTemplates();
    } catch (error) {
      console.error('Error running report:', error);
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async (template: ReportTemplate) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('report_templates').insert({
        template_name: `${template.template_name} (Copy)`,
        description: template.description,
        report_type: template.report_type,
        config: template.config as any,
        created_by: user.id,
        is_shared: true,
      } as any);

      if (error) throw error;

      toast.success('Template duplicated successfully');
      fetchTemplates();
    } catch (error) {
      console.error('Error duplicating template:', error);
      toast.error('Failed to duplicate template');
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
          <h1 className="text-3xl font-bold">Data Export & Reports</h1>
          <p className="text-muted-foreground mt-2">Build custom reports and extract data from your wash tracking system</p>
        </div>

        <Tabs defaultValue="reports" className="w-full">
          <TabsList>
            <TabsTrigger value="reports">Custom Reports</TabsTrigger>
            <TabsTrigger value="entries">Data Management</TabsTrigger>
          </TabsList>

          <TabsContent value="reports" className="space-y-4">
            <ReportTemplateList
              templates={templates}
              onRunTemplate={handleRunTemplate}
              onCreateNew={() => setShowWizard(true)}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
            />
          </TabsContent>

          <TabsContent value="entries" className="space-y-4">
            {user && <WashEntryTableEditor userId={user.id} />}
          </TabsContent>
        </Tabs>

        <ReportBuilderPanel
          open={showWizard}
          onClose={() => setShowWizard(false)}
          onSave={() => {
            fetchTemplates();
            setShowWizard(false);
          }}
        />

        <RunReportDialog
          open={showRunDialog}
          template={selectedTemplate}
          onClose={() => {
            setShowRunDialog(false);
            setSelectedTemplate(null);
          }}
          onRun={executeTemplateReport}
          onSaved={fetchTemplates}
        />
      </div>
    </Layout>
  );
}
