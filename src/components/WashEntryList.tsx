import { WashEntryWithDetails } from '@/types/database';
import { WashEntryCard } from './WashEntryCard';
import { isToday } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';

interface WashEntryListProps {
  entries: WashEntryWithDetails[];
  onDelete: (id: string) => void;
}

export function WashEntryList({ entries, onDelete }: WashEntryListProps) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No vehicles washed yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => {
        const canDelete = isToday(parseLocalDate(entry.work_date));
        return (
          <WashEntryCard
            key={entry.id}
            entry={entry}
            onDelete={onDelete}
            canDelete={canDelete}
          />
        );
      })}
    </div>
  );
}
