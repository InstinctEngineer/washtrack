import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentCutoff } from '@/lib/cutoff';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkItemWithDetails } from '@/components/WorkItemGrid';

export interface RateConfigWithDetails {
  id: string;
  rate: number | null;
  frequency: string | null;
  work_type: {
    id: string;
    name: string;
    rate_type: string;
  };
}

interface LogWorkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workItem?: WorkItemWithDetails;
  rateConfig?: RateConfigWithDetails;
  onSuccess: () => void;
}

export function LogWorkModal({ open, onOpenChange, workItem, rateConfig, onSuccess }: LogWorkModalProps) {
  const { user } = useAuth();
  const [date, setDate] = useState<Date>(new Date());
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cutoffDate, setCutoffDate] = useState<Date | null>(null);

  const isHourly = rateConfig !== undefined;
  const config = workItem?.rate_config || rateConfig;

  useEffect(() => {
    getCurrentCutoff().then(setCutoffDate);
  }, []);

  useEffect(() => {
    if (open) {
      setDate(new Date());
      setQuantity(isHourly ? '' : '1');
      setNotes('');
    }
  }, [open, isHourly]);

  const handleSubmit = async () => {
    if (!user || !config) return;

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error(isHourly ? 'Please enter valid hours' : 'Please enter a valid quantity');
      return;
    }

    setSubmitting(true);
    try {
      const insertData = {
        work_item_id: workItem?.id || null,
        rate_config_id: workItem ? null : rateConfig?.id || null,
        employee_id: user.id,
        work_date: format(date, 'yyyy-MM-dd'),
        quantity: qty,
        notes: notes.trim() || null,
      };

      const { error } = await supabase.from('work_logs').insert(insertData);

      if (error) throw error;

      toast.success(isHourly ? 'Hours logged successfully' : 'Work logged successfully');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error logging work:', error);
      toast.error(error.message || 'Failed to log work');
    } finally {
      setSubmitting(false);
    }
  };

  const isDateDisabled = (checkDate: Date) => {
    if (cutoffDate && checkDate > cutoffDate) return true;
    if (checkDate > new Date()) return true;
    return false;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isHourly ? 'Log Hours' : 'Log Work'}
            {workItem && (
              <Badge variant="outline" className="font-mono">
                {workItem.identifier}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Info display */}
          <div className="flex flex-wrap gap-2">
            <Badge>{config?.work_type.name}</Badge>
            {config?.frequency && (
              <Badge variant="secondary">{config.frequency}</Badge>
            )}
            {config?.rate && (
              <Badge variant="outline">
                ${config.rate.toFixed(2)}{isHourly ? '/hr' : ''}
              </Badge>
            )}
          </div>

          {/* Date picker */}
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !date && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  disabled={isDateDisabled}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Quantity/Hours input */}
          <div className="space-y-2">
            <Label>{isHourly ? 'Hours' : 'Quantity'}</Label>
            <Input
              type="number"
              min="0.1"
              step={isHourly ? '0.25' : '1'}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={isHourly ? 'Enter hours' : 'Enter quantity'}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isHourly ? 'Log Hours' : 'Log Work'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
