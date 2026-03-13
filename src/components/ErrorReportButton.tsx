import { useState, useCallback, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logAction } from '@/lib/activityLogger';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Send, Loader2, Camera, History, CheckCircle2, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface ErrorReport {
  id: string;
  description: string;
  page_url: string | null;
  status: string;
  created_at: string;
}

export function ErrorReportButton() {
  const { userProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [myReports, setMyReports] = useState<ErrorReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);

  const fetchMyReports = useCallback(async () => {
    if (!userProfile) return;
    setLoadingReports(true);
    try {
      const { data, error } = await supabase
        .from('error_reports')
        .select('id, description, page_url, status, created_at')
        .eq('reported_by', userProfile.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (!error && data) {
        setMyReports(data);
      }
    } catch {
      // silent
    } finally {
      setLoadingReports(false);
    }
  }, [userProfile]);

  useEffect(() => {
    if (historyOpen) fetchMyReports();
  }, [historyOpen, fetchMyReports]);

  const captureScreenshot = useCallback(async () => {
    setCapturing(true);
    try {
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        allowTaint: true,
        scale: 1,
        logging: false,
        ignoreElements: (el) => el.hasAttribute('data-error-report-trigger'),
      });
      setScreenshot(canvas.toDataURL('image/png'));
      setOpen(true);
    } catch (err) {
      console.error('Screenshot capture failed:', err);
      setOpen(true);
      toast({
        title: 'Screenshot failed',
        description: 'Could not capture screen. You can still submit the report.',
        variant: 'destructive',
      });
    } finally {
      setCapturing(false);
    }
  }, []);

  const handleSubmit = async () => {
    if (!userProfile || !description.trim()) return;
    setSubmitting(true);

    try {
      let screenshotUrl: string | null = null;

      if (screenshot) {
        const blob = await (await fetch(screenshot)).blob();
        const fileName = `${userProfile.id}/${Date.now()}-error-report.png`;
        const { error: uploadError } = await supabase.storage
          .from('error-reports')
          .upload(fileName, blob, { contentType: 'image/png' });

        if (!uploadError) {
          screenshotUrl = fileName;
        } else {
          console.error('Screenshot upload failed:', uploadError);
        }
      }

      const { error: insertError } = await supabase.from('error_reports').insert({
        reported_by: userProfile.id,
        description: description.trim(),
        screenshot_url: screenshotUrl,
        page_url: window.location.pathname,
        user_agent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      });

      if (insertError) throw insertError;

      logAction('error_report', window.location.pathname, {
        description: description.trim(),
        screenshot_path: screenshotUrl,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        url: window.location.href,
        user_name: userProfile.name,
        user_email: userProfile.email,
        user_role: userProfile.role,
      });

      toast({
        title: 'Error report submitted',
        description: 'Your report has been sent to the admin team. Thank you!',
      });

      setDescription('');
      setScreenshot(null);
      setOpen(false);
    } catch (err) {
      console.error('Failed to submit error report:', err);
      toast({
        title: 'Submission failed',
        description: 'Could not submit your report. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setOpen(false);
      setDescription('');
      setScreenshot(null);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          data-error-report-trigger
          variant="outline"
          size="sm"
          className="gap-2 border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={captureScreenshot}
          disabled={capturing}
        >
          {capturing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">Report Issue</span>
        </Button>
        <Button
          data-error-report-trigger
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          onClick={() => setHistoryOpen(true)}
          title="View my reports"
        >
          <History className="h-4 w-4" />
        </Button>
      </div>

      {/* Submit Report Dialog */}
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Report an Issue
            </DialogTitle>
            <DialogDescription>
              A screenshot of your screen has been captured. Describe what went wrong and we'll look into it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {screenshot && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Camera className="h-4 w-4" />
                  Screen Capture
                </div>
                <div className="rounded-lg border overflow-hidden bg-muted/30">
                  <img
                    src={screenshot}
                    alt="Screenshot of current screen"
                    className="w-full h-auto max-h-[200px] object-contain"
                  />
                </div>
              </div>
            )}

            {!screenshot && (
              <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                Screenshot could not be captured. You can still describe the issue below.
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="error-description" className="text-sm font-medium">
                What happened? <span className="text-destructive">*</span>
              </label>
              <Textarea
                id="error-description"
                placeholder="Describe the issue you're experiencing... What were you trying to do? What happened instead?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>

            <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <p><strong>Page:</strong> {window.location.pathname}</p>
              <p><strong>User:</strong> {userProfile?.name} ({userProfile?.email})</p>
              <p><strong>Time:</strong> {new Date().toLocaleString()}</p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleSubmit}
              disabled={submitting || !description.trim()}
              className="gap-2"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Submit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* My Reports History Sheet */}
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              My Error Reports
            </SheetTitle>
            <SheetDescription>
              Track the status of issues you've reported.
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-10rem)] mt-4 pr-2">
            {loadingReports ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : myReports.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                You haven't submitted any error reports yet.
              </div>
            ) : (
              <div className="space-y-3">
                {myReports.map((report) => (
                  <div
                    key={report.id}
                    className="rounded-lg border p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-snug line-clamp-2">
                        {report.description}
                      </p>
                      <Badge
                        variant={report.status === 'resolved' ? 'default' : 'secondary'}
                        className={`shrink-0 gap-1 text-xs ${
                          report.status === 'resolved'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                        }`}
                      >
                        {report.status === 'resolved' ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                        {report.status === 'resolved' ? 'Resolved' : 'Open'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {report.page_url && <span>{report.page_url}</span>}
                      <span>{format(new Date(report.created_at), 'MMM d, yyyy h:mm a')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}