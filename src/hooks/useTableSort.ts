import { useMemo, useState } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface UseTableSortOptions<T> {
  /** Map a column key to the raw value used for comparison. */
  getValue?: (item: T, column: string) => unknown;
  /** Initial column to sort by. */
  initialColumn?: string | null;
  /** Initial direction. Defaults to 'asc'. */
  initialDirection?: SortDirection;
}

/**
 * Generic client-side table sort helper. Returns sortedData plus
 * sort-state controls. Sorts numbers numerically, dates by time,
 * booleans (true first asc), and falls back to localeCompare for strings.
 */
export function useTableSort<T extends Record<string, any>>(
  data: T[],
  options: UseTableSortOptions<T> = {}
) {
  const { getValue, initialColumn = null, initialDirection = 'asc' } = options;
  const [sortColumn, setSortColumn] = useState<string | null>(initialColumn);
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialDirection);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortColumn) return data;
    const dir = sortDirection === 'asc' ? 1 : -1;
    const read = (item: T) => (getValue ? getValue(item, sortColumn) : item[sortColumn]);

    return [...data].sort((a, b) => {
      const av = read(a);
      const bv = read(b);

      if (av == null && bv == null) return 0;
      if (av == null) return 1; // nulls sort to end regardless of direction
      if (bv == null) return -1;

      // Dates
      if (av instanceof Date && bv instanceof Date) {
        return (av.getTime() - bv.getTime()) * dir;
      }
      // Numbers
      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * dir;
      }
      // Booleans (true first when asc)
      if (typeof av === 'boolean' && typeof bv === 'boolean') {
        return (Number(bv) - Number(av)) * dir;
      }
      // Fallback: stringify and locale-compare
      return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * dir;
    });
  }, [data, sortColumn, sortDirection, getValue]);

  return { sortedData, sortColumn, sortDirection, handleSort, setSortColumn, setSortDirection };
}