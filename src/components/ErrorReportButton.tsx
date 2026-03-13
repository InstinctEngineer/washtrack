import { useState, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logAction } from '@/lib/activityLogger';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, Send, Loader2, Camera } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';

export function ErrorReportButton() {
  const { userProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [capturing, setCapturing] = useState(false);

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

      // Upload screenshot to storage
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

      // Insert directly into error_reports table
      const { error: insertError } = await supabase.from('error_reports').insert({
        reported_by: userProfile.id,
        description: description.trim(),
        screenshot_url: screenshotUrl,
        page_url: window.location.pathname,
        user_agent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      });

      if (insertError) {
        throw insertError;
      }

      // Log to activity logs
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
    </>
  );
}
