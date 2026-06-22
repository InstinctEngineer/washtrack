import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { SortDirection } from '@/hooks/useTableSort';

interface SortableTableHeadProps {
  column: string;
  sortColumn: string | null;
  sortDirection: SortDirection;
  onSort: (column: string) => void;
  className?: string;
  align?: 'left' | 'right' | 'center';
  children: React.ReactNode;
}

export function SortableTableHead({
  column,
  sortColumn,
  sortDirection,
  onSort,
  className,
  align = 'left',
  children,
}: SortableTableHeadProps) {
  const active = sortColumn === column;
  const Icon = !active ? ArrowUpDown : sortDirection === 'asc' ? ArrowUp : ArrowDown;
  return (
    <TableHead
      className={cn('cursor-pointer select-none hover:bg-muted/50', className)}
      onClick={() => onSort(column)}
    >
      <div
        className={cn(
          'flex items-center gap-1',
          align === 'right' && 'justify-end',
          align === 'center' && 'justify-center'
        )}
      >
        {children}
        <Icon className={cn('h-3.5 w-3.5', !active && 'opacity-50')} />
      </div>
    </TableHead>
  );
}