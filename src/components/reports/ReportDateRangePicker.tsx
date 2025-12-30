import { useState } from 'react';
import { format, startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface ReportDateRangePickerProps {
  startDate: Date | undefined;
  endDate: Date | undefined;
  onStartDateChange: (date: Date | undefined) => void;
  onEndDateChange: (date: Date | undefined) => void;
}

export function ReportDateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: ReportDateRangePickerProps) {
  const today = new Date();
  
  // Week starts on Monday (1)
  const thisWeekStart = startOfWeek(today, { weekStartsOn: 1 });
  const thisWeekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const lastWeekStart = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
  const lastWeekEnd = endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
  
  // Pay periods are the same as weeks for this system
  const thisPayPeriodStart = thisWeekStart;
  const thisPayPeriodEnd = thisWeekEnd;
  const lastPayPeriodStart = lastWeekStart;
  const lastPayPeriodEnd = lastWeekEnd;
  
  const thisMonthStart = startOfMonth(today);
  const thisMonthEnd = endOfMonth(today);
  const lastMonthStart = startOfMonth(subMonths(today, 1));
  const lastMonthEnd = endOfMonth(subMonths(today, 1));

  const quickSelects = [
    { label: 'This Week', start: thisWeekStart, end: thisWeekEnd },
    { label: 'Last Week', start: lastWeekStart, end: lastWeekEnd },
    { label: 'This Pay Period', start: thisPayPeriodStart, end: thisPayPeriodEnd },
    { label: 'Last Pay Period', start: lastPayPeriodStart, end: lastPayPeriodEnd },
    { label: 'This Month', start: thisMonthStart, end: thisMonthEnd },
    { label: 'Last Month', start: lastMonthStart, end: lastMonthEnd },
  ];

  const handleQuickSelect = (start: Date, end: Date) => {
    onStartDateChange(start);
    onEndDateChange(end);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-muted-foreground">Start Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-[200px] justify-start text-left font-normal',
                  !startDate && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, 'PPP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-popover" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={onStartDateChange}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-muted-foreground">End Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-[200px] justify-start text-left font-normal',
                  !endDate && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, 'PPP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-popover" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={onEndDateChange}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {quickSelects.map((qs) => (
          <Button
            key={qs.label}
            variant="secondary"
            size="sm"
            onClick={() => handleQuickSelect(qs.start, qs.end)}
            className={cn(
              startDate?.getTime() === qs.start.getTime() &&
              endDate?.getTime() === qs.end.getTime() &&
              'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
          >
            {qs.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
