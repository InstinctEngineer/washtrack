import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet, Play, Copy, Trash2, Plus } from 'lucide-react';
import { ReportTemplate } from '@/lib/reportBuilder';
import { format } from 'date-fns';

interface ReportTemplateListProps {
  templates: ReportTemplate[];
  onRunTemplate: (template: ReportTemplate) => void;
  onCreateNew: () => void;
  onDuplicate?: (template: ReportTemplate) => void;
  onDelete?: (template: ReportTemplate) => void;
}

export function ReportTemplateList({
  templates,
  onRunTemplate,
  onCreateNew,
  onDuplicate,
  onDelete
}: ReportTemplateListProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Saved Reports</h2>
          <p className="text-muted-foreground">Your custom report configurations for quick data extraction</p>
        </div>
        <Button onClick={onCreateNew}>
          <Plus className="h-4 w-4 mr-2" />
          Build New Report
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-1 font-medium">No saved reports yet</p>
            <p className="text-sm text-muted-foreground mb-4">Build your first custom report to extract and analyze your data</p>
            <Button onClick={onCreateNew} variant="outline">
              Build Your First Report
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{template.template_name}</CardTitle>
                    <CardDescription className="mt-1">
                      {template.description || 'No description'}
                    </CardDescription>
                  </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Used {template.use_count} times</span>
                    {template.last_used_at && (
                      <span>Last: {format(new Date(template.last_used_at), 'MMM d')}</span>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => onRunTemplate(template)} 
                      className="flex-1"
                      size="sm"
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Export Data
                    </Button>
                    
                    {onDuplicate && (
                      <Button
                        onClick={() => onDuplicate(template)}
                        variant="outline"
                        size="sm"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    )}
                    
                    {onDelete && (
                      <Button
                        onClick={() => onDelete(template)}
                        variant="outline"
                        size="sm"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
