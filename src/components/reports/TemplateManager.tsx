import { useState, useEffect } from 'react';
import { Save, FolderOpen, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ExportColumn } from './ExportColumnConfigurator';

export interface ReportTemplateConfig {
  columns: ExportColumn[];
  defaultTerms?: string;
  defaultClass?: string;
  invoiceDateMode?: 'export_date' | 'end_date';
}

interface Template {
  id: string;
  template_name: string;
  description: string | null;
  config: ReportTemplateConfig;
  is_shared: boolean;
  created_by: string | null;
}

interface TemplateManagerProps {
  currentConfig: ReportTemplateConfig;
  onLoadTemplate: (config: ReportTemplateConfig) => void;
}

export function TemplateManager({ currentConfig, onLoadTemplate }: TemplateManagerProps) {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from('report_templates')
      .select('*')
      .eq('report_type', 'quickbooks_export')
      .order('template_name');

    if (error) {
      console.error('Error fetching templates:', error);
      return;
    }

    // Parse the config field
    const parsed = (data || []).map((t) => ({
      ...t,
      config: typeof t.config === 'string' ? JSON.parse(t.config) : t.config,
    })) as Template[];

    setTemplates(parsed);
  };

  const handleLoadTemplate = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      onLoadTemplate(template.config);
      setSelectedTemplateId(templateId);
      toast.success(`Loaded template: ${template.template_name}`);
    }
  };

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('report_templates').insert([{
        template_name: newTemplateName.trim(),
        description: newTemplateDescription.trim() || null,
        report_type: 'quickbooks_export',
        config: JSON.parse(JSON.stringify(currentConfig)),
        created_by: user?.id,
        is_shared: true,
      }]);

      if (error) throw error;

      toast.success('Template saved successfully');
      setSaveModalOpen(false);
      setNewTemplateName('');
      setNewTemplateDescription('');
      fetchTemplates();
    } catch (error: any) {
      console.error('Error saving template:', error);
      toast.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;

    if (!confirm(`Delete template "${template.template_name}"?`)) return;

    const { error } = await supabase
      .from('report_templates')
      .delete()
      .eq('id', templateId);

    if (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
      return;
    }

    toast.success('Template deleted');
    if (selectedTemplateId === templateId) {
      setSelectedTemplateId('');
    }
    fetchTemplates();
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedTemplateId} onValueChange={handleLoadTemplate}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Load template..." />
        </SelectTrigger>
        <SelectContent>
          {templates.length === 0 ? (
            <SelectItem value="none" disabled>
              No saved templates
            </SelectItem>
          ) : (
            templates.map((template) => (
              <SelectItem key={template.id} value={template.id}>
                {template.template_name}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      {selectedTemplateId && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleDeleteTemplate(selectedTemplateId)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}

      <Button variant="outline" onClick={() => setSaveModalOpen(true)}>
        <Save className="h-4 w-4 mr-2" />
        Save Template
      </Button>

      <Dialog open={saveModalOpen} onOpenChange={setSaveModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Report Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Template Name</label>
              <Input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="e.g., Weekly Invoice Export"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description (optional)</label>
              <Input
                value={newTemplateDescription}
                onChange={(e) => setNewTemplateDescription(e.target.value)}
                placeholder="e.g., Standard QuickBooks format for weekly billing"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate} disabled={saving}>
              {saving ? 'Saving...' : 'Save Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
