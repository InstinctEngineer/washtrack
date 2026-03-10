import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ImageIcon, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ErrorScreenshotViewerProps {
  /** Storage path like "userId/timestamp-error-report.png" */
  screenshotPath: string;
  /** Compact inline preview vs full button */
  variant?: 'inline' | 'button';
}

export function ErrorScreenshotViewer({ screenshotPath, variant = 'inline' }: ErrorScreenshotViewerProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const loadScreenshot = async () => {
    if (signedUrl || loading) return;
    setLoading(true);
    setError(false);
    try {
      const { data, error: urlError } = await supabase.storage
        .from('error-reports')
        .createSignedUrl(screenshotPath, 3600); // 1 hour expiry

      if (urlError || !data?.signedUrl) {
        setError(true);
        return;
      }
      setSignedUrl(data.signedUrl);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScreenshot();
  }, [screenshotPath]);

  if (variant === 'button') {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-xs"
          onClick={() => {
            loadScreenshot();
            setFullscreen(true);
          }}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageIcon className="h-3 w-3" />}
          View Screenshot
        </Button>

        <Dialog open={fullscreen} onOpenChange={setFullscreen}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Error Report Screenshot
              </DialogTitle>
            </DialogHeader>
            <div className="overflow-auto max-h-[70vh]">
              {signedUrl ? (
                <img src={signedUrl} alt="Error report screenshot" className="w-full h-auto rounded-lg" />
              ) : error ? (
                <p className="text-sm text-muted-foreground text-center py-8">Could not load screenshot</p>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Inline variant
  return (
    <div className="space-y-2">
      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading screenshot...
        </div>
      )}
      {error && (
        <p className="text-xs text-muted-foreground">Could not load screenshot</p>
      )}
      {signedUrl && (
        <>
          <div
            className="rounded-lg border overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
            onClick={() => setFullscreen(true)}
          >
            <img src={signedUrl} alt="Error report screenshot" className="w-full h-auto max-h-[200px] object-contain bg-muted/30" />
          </div>
          <p className="text-xs text-muted-foreground">Click to enlarge</p>

          <Dialog open={fullscreen} onOpenChange={setFullscreen}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Error Report Screenshot
                </DialogTitle>
              </DialogHeader>
              <div className="overflow-auto max-h-[70vh]">
                <img src={signedUrl} alt="Error report screenshot" className="w-full h-auto rounded-lg" />
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

/**
 * Extract screenshot path from an error report message text.
 * Looks for pattern: "error-reports/userId/timestamp-error-report.png"
 */
export function extractScreenshotPath(text: string): string | null {
  const match = text.match(/error-reports\/([^\s)]+)/);
  return match ? match[1] : null;
}
