import { WashEntryWithDetails } from '@/types/database';
import { WashEntryCard } from './WashEntryCard';
import { format, isToday } from 'date-fns';

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
        const canDelete = isToday(new Date(entry.wash_date));
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
