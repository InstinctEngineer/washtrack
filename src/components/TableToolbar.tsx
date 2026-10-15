import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface ToolbarFilter {
  key: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  placeholder?: string;
  filters?: ToolbarFilter[];
  shown?: number;
  total?: number;
}

/** Shared search + filter bar for every table. Use "all" as the no-filter option value. */
export function TableToolbar({ search, onSearchChange, placeholder = 'Search...', filters = [], shown, total }: Props) {
  const active = search !== '' || filters.some((f) => f.value !== 'all');
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder={placeholder} className="pl-9" />
      </div>
      {filters.map((f) => (
        <Select key={f.key} value={f.value} onValueChange={f.onChange}>
          <SelectTrigger className="w-44" aria-label={f.label}>
            <SelectValue placeholder={f.label} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All {f.label}</SelectItem>
            {f.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
      {active && (
        <Button variant="ghost" size="sm" onClick={() => { onSearchChange(''); filters.forEach((f) => f.onChange('all')); }}>
          <X className="h-4 w-4 mr-1" />Clear
        </Button>
      )}
      {shown !== undefined && total !== undefined && (
        <span className="text-sm text-muted-foreground">Showing {shown} of {total}</span>
      )}
    </div>
  );
}

/** Case-insensitive match of a query against any of the given values. */
export function matchesSearch(query: string, values: unknown[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return values.some((v) => v != null && String(v).toLowerCase().includes(q));
}
