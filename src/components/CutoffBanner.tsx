import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { getCurrentCutoff, getCutoffStatusColor } from '@/lib/cutoff';
import { format } from 'date-fns';

export function CutoffBanner() {
  const [cutoffDate, setCutoffDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCutoff = async () => {
      const cutoff = await getCurrentCutoff();
      setCutoffDate(cutoff);
      setLoading(false);
    };

    fetchCutoff();
  }, []);

  if (loading) {
    return null;
  }

  // If no cutoff date exists, show info message
  if (!cutoffDate) {
    return (
      <Alert variant="default" className="bg-blue-50 text-blue-900 border-blue-200">
        <CheckCircle className="h-4 w-4" />
        <AlertDescription className="font-medium">
          ℹ No entry cutoff set - all dates allowed
        </AlertDescription>
      </Alert>
    );
  }

  const statusColor = getCutoffStatusColor(cutoffDate);
  
  const StatusIcon = statusColor === 'green' ? CheckCircle : statusColor === 'yellow' ? AlertTriangle : XCircle;
  
  const variant = statusColor === 'red' ? 'destructive' : 'default';
  const className = statusColor === 'green' 
    ? 'bg-green-50 text-green-900 border-green-200' 
    : statusColor === 'yellow' 
    ? 'bg-yellow-50 text-yellow-900 border-yellow-200'
    : '';

  const message = statusColor === 'green'
    ? `✓ Entry period open until ${format(cutoffDate, 'EEEE, MMMM d, yyyy')} at ${format(cutoffDate, 'h:mm a')}`
    : statusColor === 'yellow'
    ? `⚠ Entry deadline approaching: ${format(cutoffDate, 'EEEE, MMMM d, yyyy')} at ${format(cutoffDate, 'h:mm a')}`
    : `✖ Less than 1 day until cutoff: ${format(cutoffDate, 'EEEE, MMMM d, yyyy')} at ${format(cutoffDate, 'h:mm a')}. Contact your manager for corrections.`;

  return (
    <Alert variant={variant} className={className}>
      <StatusIcon className="h-4 w-4" />
      <AlertDescription className="font-medium">
        {message}
      </AlertDescription>
    </Alert>
  );
}
