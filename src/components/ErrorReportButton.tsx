import { useState, useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logAction } from '@/lib/activityLogger';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, Send, Loader2, X, Camera } from 'lucide-react';
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
        ignoreElements: (el) => {
          // Ignore the error report button itself and any open dialogs
          return el.hasAttribute('data-error-report-trigger');
        },
      });
      const dataUrl = canvas.toDataURL('image/png');
      setScreenshot(dataUrl);
      setOpen(true);
    } catch (err) {
      console.error('Screenshot capture failed:', err);
      // Still open the dialog even if screenshot fails
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
      let screenshotPath: string | null = null;

      // Upload screenshot to storage if captured
      if (screenshot) {
        const blob = await (await fetch(screenshot)).blob();
        const fileName = `${userProfile.id}/${Date.now()}-error-report.png`;
        const { error: uploadError } = await supabase.storage
          .from('error-reports')
          .upload(fileName, blob, { contentType: 'image/png' });

        if (!uploadError) {
          screenshotPath = fileName;
        }
      }

      // Log to activity_logs
      logAction('error_report', window.location.pathname, {
        description: description.trim(),
        screenshot_path: screenshotPath,
        user_agent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        url: window.location.href,
        user_name: userProfile.name,
        user_email: userProfile.email,
        user_role: userProfile.role,
      });

      // Find super_admin user(s) to send message to
      const { data: superAdminRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'super_admin')
        .limit(1);

      const superAdminId = superAdminRoles?.[0]?.user_id;

      if (superAdminId) {
        // Send as an employee_comment (message) to the super admin
        const now = new Date();
        const dayOfWeek = now.getDay();
        const monday = new Date(now);
        monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
        const weekStartDate = monday.toISOString().split('T')[0];

        const messageText = [
          `🚨 ERROR REPORT`,
          ``,
          `From: ${userProfile.name} (${userProfile.email})`,
          `Page: ${window.location.pathname}`,
          `Time: ${new Date().toLocaleString()}`,
          ``,
          `Description:`,
          description.trim(),
          screenshotPath ? `\n📎 Screenshot attached (error-reports/${screenshotPath})` : '',
        ].join('\n');

        await supabase.from('employee_comments').insert({
          employee_id: userProfile.id,
          recipient_id: superAdminId,
          comment_text: messageText,
          week_start_date: weekStartDate,
        });
      }

      toast({
        title: 'Error report submitted',
        description: 'Your report has been sent to the admin team. Thank you!',
      });

      // Reset and close
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
        variant="destructive"
        size="sm"
        className="gap-2 shadow-lg"
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
            {/* Screenshot preview */}
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

            {/* Description */}
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

            {/* Context info */}
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
