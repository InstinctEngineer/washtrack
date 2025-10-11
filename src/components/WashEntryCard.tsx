import { WashEntryWithDetails } from '@/types/database';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface WashEntryCardProps {
  entry: WashEntryWithDetails;
  onDelete?: (id: string) => void;
  canDelete: boolean;
}

export function WashEntryCard({ entry, onDelete, canDelete }: WashEntryCardProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-card border rounded-md">
      <div className="flex-1">
        <div className="font-medium">
          Vehicle #{entry.vehicle?.vehicle_number}
        </div>
        <div className="text-sm text-muted-foreground">
          {entry.vehicle?.vehicle_type?.type_name}
          {' • '}
          {format(new Date(entry.created_at), 'h:mm a')}
        </div>
      </div>
      
      {canDelete && onDelete && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(entry.id)}
          className="h-8 w-8 text-destructive hover:text-destructive"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
