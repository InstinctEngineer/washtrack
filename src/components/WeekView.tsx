import { startOfWeek, endOfWeek, addDays, format } from 'date-fns';
import { DayColumn } from './DayColumn';
import { WashEntryWithDetails } from '@/types/database';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface WeekViewProps {
  currentWeek: Date;
  entries: WashEntryWithDetails[];
  onAddWash: (date: Date, vehicleNumber: string, vehicleId: string) => void;
  onDeleteWash: (id: string) => void;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onCurrentWeek: () => void;
  cutoffDate: Date | null;
}

export function WeekView({
  currentWeek,
  entries,
  onAddWash,
  onDeleteWash,
  onPreviousWeek,
  onNextWeek,
  onCurrentWeek,
  cutoffDate
}: WeekViewProps) {
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 }); // Sunday

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getEntriesForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return entries.filter(entry => entry.wash_date === dateStr);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          Week of {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
        </h2>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onPreviousWeek}>
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button variant="outline" size="sm" onClick={onCurrentWeek}>
            Current Week
          </Button>
          <Button variant="outline" size="sm" onClick={onNextWeek}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Week Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {days.map((day) => (
          <DayColumn
            key={day.toISOString()}
            date={day}
            entries={getEntriesForDay(day)}
            onAddWash={onAddWash}
            onDeleteWash={onDeleteWash}
            cutoffDate={cutoffDate}
          />
        ))}
      </div>
    </div>
  );
}
