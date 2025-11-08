import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet, Play, Copy, Trash2, Plus, Star, DollarSign, Users } from 'lucide-react';
import { ReportTemplate, SYSTEM_TEMPLATES } from '@/lib/reportBuilder';
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
  // Convert system templates to full template format for display
  const systemTemplates: ReportTemplate[] = SYSTEM_TEMPLATES.map(st => ({
    ...st,
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_used_at: null,
    use_count: 0,
  }));

  const userTemplates = templates.filter(t => !t.is_system_template);
  const hasAnyTemplates = systemTemplates.length > 0 || userTemplates.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Report Templates</h2>
          <p className="text-muted-foreground">Quick-start templates and your custom configurations</p>
        </div>
        <Button onClick={onCreateNew}>
          <Plus className="h-4 w-4 mr-2" />
          Build Custom Report
        </Button>
      </div>

      {/* System Templates Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-yellow-500" />
          <h3 className="font-semibold">Quick Start Templates</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {systemTemplates.map((template) => (
            <Card key={template.id} className="hover:shadow-lg transition-shadow border-2 border-primary/20">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {template.id === 'system-invoice-report' ? (
                        <DollarSign className="h-4 w-4 text-primary" />
                      ) : (
                        <Users className="h-4 w-4 text-primary" />
                      )}
                      <CardTitle className="text-lg">{template.template_name}</CardTitle>
                    </div>
                    <CardDescription className="mt-1">
                      {template.description}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="ml-2">
                    <Star className="h-3 w-3 mr-1" />
                    System
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    {template.config.columns.length} fields • Editable after loading
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => onRunTemplate(template)} 
                      className="flex-1"
                      size="sm"
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Use Template
                    </Button>
                    
                    {onDuplicate && (
                      <Button
                        onClick={() => onDuplicate(template)}
                        variant="outline"
                        size="sm"
                        title="Duplicate and customize"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* User Templates Section */}
      {userTemplates.length === 0 ? (
        <div className="space-y-3">
          <h3 className="font-semibold text-muted-foreground">Your Custom Templates</h3>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-1 text-sm">No custom templates yet</p>
              <p className="text-xs text-muted-foreground mb-3">Start with a system template or build your own</p>
              <Button onClick={onCreateNew} variant="outline" size="sm">
                Build Custom Report
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="font-semibold text-muted-foreground">Your Custom Templates</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {userTemplates.map((template) => (
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
                    
                    {onDelete && !template.is_system_template && (
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
        </div>
      )}
    </div>
  );
}
