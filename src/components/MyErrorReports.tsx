import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertTriangle, ChevronDown, CheckCircle2, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface ErrorReport {
  id: string;
  description: string;
  page_url: string | null;
  status: string;
  created_at: string;
}

export function MyErrorReports() {
  const { user } = useAuth();
  const [reports, setReports] = useState<ErrorReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    const fetchReports = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('error_reports')
        .select('id, description, page_url, status, created_at')
        .eq('reported_by', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setReports(data);
      }
      setLoading(false);
    };

    fetchReports();
  }, [user?.id]);

  if (loading && reports.length === 0) return null;
  if (reports.length === 0) return null;

  const openCount = reports.filter(r => r.status === 'open').length;
  const resolvedCount = reports.filter(r => r.status === 'resolved').length;

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <div>
                  <CardTitle className="text-base">My Error Reports</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Track the status of issues you've reported
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {openCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {openCount} open
                  </Badge>
                )}
                {resolvedCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {resolvedCount} resolved
                  </Badge>
                )}
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            {reports.map((report) => (
              <div
                key={report.id}
                className={`flex items-start gap-3 rounded-lg border p-3 ${
                  report.status === 'open' ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-muted/30'
                }`}
              >
                {report.status === 'resolved' ? (
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />
                ) : (
                  <Clock className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug">{report.description}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                    <span>{format(new Date(report.created_at), 'MMM d, h:mm a')}</span>
                    {report.page_url && (
                      <>
                        <span>·</span>
                        <span className="truncate">{report.page_url}</span>
                      </>
                    )}
                  </div>
                </div>
                <Badge
                  variant={report.status === 'open' ? 'destructive' : 'secondary'}
                  className="shrink-0 text-xs"
                >
                  {report.status === 'resolved' ? 'Resolved' : 'Open'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
