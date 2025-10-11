import { format, isToday, isBefore, startOfDay } from 'date-fns';
import { VehicleSearchInput } from './VehicleSearchInput';
import { WashEntryList } from './WashEntryList';
import { WashEntryWithDetails } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface DayColumnProps {
  date: Date;
  entries: WashEntryWithDetails[];
  onAddWash: (date: Date, vehicleNumber: string, vehicleId: string) => void;
  onDeleteWash: (id: string) => void;
  cutoffDate: Date | null;
}

export function DayColumn({ date, entries, onAddWash, onDeleteWash, cutoffDate }: DayColumnProps) {
  const isBeforeCutoff = cutoffDate ? isBefore(startOfDay(date), startOfDay(cutoffDate)) : false;
  const isDateToday = isToday(date);
  
  return (
    <div
      className={cn(
        "border rounded-lg p-4 bg-card",
        isDateToday && "ring-2 ring-primary"
      )}
    >
      <div className="mb-4">
        <div className="font-semibold text-lg">
          {format(date, 'EEE, MMM d')}
        </div>
        {isDateToday && (
          <Badge variant="default" className="mt-1">Today</Badge>
        )}
        {isBeforeCutoff && (
          <Badge variant="secondary" className="mt-1">Entry Closed</Badge>
        )}
      </div>
      
      {!isBeforeCutoff && (
        <div className="mb-4">
          <VehicleSearchInput
            onSelect={(vehicleNumber, vehicleId) => onAddWash(date, vehicleNumber, vehicleId)}
            disabled={isBeforeCutoff}
            placeholder="Add vehicle..."
          />
        </div>
      )}
      
      <div className="mb-3">
        <div className="text-sm font-medium text-muted-foreground">
          {entries.length} {entries.length === 1 ? 'vehicle' : 'vehicles'} washed
        </div>
      </div>
      
      <WashEntryList entries={entries} onDelete={onDeleteWash} />
    </div>
  );
}
