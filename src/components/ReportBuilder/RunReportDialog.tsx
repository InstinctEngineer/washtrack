import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Download, Save } from 'lucide-react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { ReportTemplate, ReportConfig } from '@/lib/reportBuilder';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RunReportDialogProps {
  open: boolean;
  template: ReportTemplate | null;
  onClose: () => void;
  onRun: (config: ReportConfig) => Promise<void>;
  onSaved?: () => void;
}

export function RunReportDialog({ open, template, onClose, onRun, onSaved }: RunReportDialogProps) {
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [saveAsNew, setSaveAsNew] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [loading, setLoading] = useState(false);

  // Set current week dates when dialog opens
  useEffect(() => {
    if (open && template) {
      const hasDateFilter = template.config.filters.some(f => f.field === 'work_date');
      if (hasDateFilter) {
        const today = new Date();
        const weekStart = startOfWeek(today, { weekStartsOn: 0 }); // Sunday
        const weekEnd = endOfWeek(today, { weekStartsOn: 0 }); // Saturday
        setDateRange({ from: weekStart, to: weekEnd });
      }
    }
  }, [open, template]);

  if (!template) return null;

  const hasDateFilter = template.config.filters.some(f => f.field === 'work_date');

  const handleRun = async () => {
    setLoading(true);
    try {
      let config = { 
        ...template.config,
        reportType: template.report_type
      };
      
      // Update date filter if user changed it
      if (dateRange.from && dateRange.to && hasDateFilter) {
        config.filters = config.filters.map(f => 
          f.field === 'work_date' 
            ? { ...f, value: [format(dateRange.from!, 'yyyy-MM-dd'), format(dateRange.to!, 'yyyy-MM-dd')] }
            : f
        );
      }

      await onRun(config);
      onClose();
    } catch (error) {
      console.error('Error running report:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndRun = async () => {
    if (!newTemplateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let config = { 
        ...template.config,
        reportType: template.report_type
      };
      
      // Update date filter if user changed it
      if (dateRange.from && dateRange.to && hasDateFilter) {
        config.filters = config.filters.map(f => 
          f.field === 'work_date' 
            ? { ...f, value: [format(dateRange.from!, 'yyyy-MM-dd'), format(dateRange.to!, 'yyyy-MM-dd')] }
            : f
        );
      }

      const { error } = await supabase.from('report_templates').insert({
        template_name: newTemplateName,
        description: `Based on ${template.template_name}`,
        report_type: template.report_type,
        config: config as any,
        created_by: user.id,
      } as any);

      if (error) throw error;

      toast.success('Template saved successfully!');
      onSaved?.();
      
      await onRun(config);
      onClose();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Failed to save template');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Run Report: {template.template_name}</DialogTitle>
          <DialogDescription>
            Adjust settings before running the report
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {hasDateFilter && (
            <div className="space-y-2">
              <Label>Date Range (defaults to current week)</Label>
              <div className="grid grid-cols-2 gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start text-left">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.from ? format(dateRange.from, 'PP') : 'From'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateRange.from}
                      onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start text-left">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.to ? format(dateRange.to, 'PP') : 'To'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateRange.to}
                      onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="saveAsNew"
              checked={saveAsNew}
              onChange={(e) => setSaveAsNew(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="saveAsNew" className="cursor-pointer">
              Save as new template
            </Label>
          </div>

          {saveAsNew && (
            <div className="space-y-2">
              <Label htmlFor="newTemplateName">New Template Name</Label>
              <Input
                id="newTemplateName"
                placeholder="e.g., Custom Monthly Report"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {saveAsNew ? (
            <Button onClick={handleSaveAndRun} disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              Save & Run
            </Button>
          ) : (
            <Button onClick={handleRun} disabled={loading}>
              <Download className="h-4 w-4 mr-2" />
              Run Report
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
