import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

interface AuditLogEntry {
  id: string;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data: any;
  new_data: any;
  changed_by: string;
  changed_at: string;
  changed_by_user?: {
    id: string;
    name: string;
    employee_id: string;
  };
}

export function AuditLogTable() {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [vehicleMap, setVehicleMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const pageSize = 20;

  useEffect(() => {
    fetchAuditLogs();
  }, [page, actionFilter]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_log')
        .select('*, changed_by_user:users!changed_by(id, name, employee_id)', { count: 'exact' })
        .eq('table_name', 'wash_entries')
        .order('changed_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      setAuditLogs(data as AuditLogEntry[] || []);
      setTotalCount(count || 0);

      // Fetch vehicle data
      if (data && data.length > 0) {
        const vehicleIds = data
          .map((entry) => {
            const vehicleData = entry.action === 'DELETE' ? entry.old_data : entry.new_data;
            return (vehicleData as any)?.vehicle_id;
          })
          .filter(Boolean);

        if (vehicleIds.length > 0) {
          const { data: vehicles } = await supabase
            .from('vehicles')
            .select('id, vehicle_number')
            .in('id', vehicleIds);

          if (vehicles) {
            const map = new Map(vehicles.map((v) => [v.id, v.vehicle_number]));
            setVehicleMap(map);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getVehicleNumber = (entry: AuditLogEntry) => {
    const data = entry.action === 'DELETE' ? entry.old_data : entry.new_data;
    const vehicleId = (data as any)?.vehicle_id;
    return vehicleId ? vehicleMap.get(vehicleId) || 'Unknown' : 'N/A';
  };

  const getActionBadge = (action: string) => {
    const variants = {
      INSERT: { variant: 'default' as const, label: 'NEW', className: 'bg-green-600 hover:bg-green-700' },
      UPDATE: { variant: 'default' as const, label: 'EDIT', className: 'bg-yellow-600 hover:bg-yellow-700' },
      DELETE: { variant: 'destructive' as const, label: 'DEL', className: '' },
    };
    const config = variants[action as keyof typeof variants];
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const renderDataComparison = (entry: AuditLogEntry) => {
    if (entry.action === 'UPDATE') {
      return (
        <div className="grid grid-cols-2 gap-4 mt-2">
          <div>
            <h4 className="font-semibold mb-2 text-destructive">Before</h4>
            <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-64">
              {JSON.stringify(entry.old_data, null, 2)}
            </pre>
          </div>
          <div>
            <h4 className="font-semibold mb-2 text-green-600">After</h4>
            <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-64">
              {JSON.stringify(entry.new_data, null, 2)}
            </pre>
          </div>
        </div>
      );
    } else if (entry.action === 'DELETE') {
      return (
        <div className="mt-2">
          <h4 className="font-semibold mb-2">Deleted Data</h4>
          <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-64">
            {JSON.stringify(entry.old_data, null, 2)}
          </pre>
        </div>
      );
    } else {
      return (
        <div className="mt-2">
          <h4 className="font-semibold mb-2">Created Data</h4>
          <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-64">
            {JSON.stringify(entry.new_data, null, 2)}
          </pre>
        </div>
      );
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="INSERT">New Entries</SelectItem>
            <SelectItem value="UPDATE">Edits</SelectItem>
            <SelectItem value="DELETE">Deletions</SelectItem>
          </SelectContent>
        </Select>
        {actionFilter !== 'all' && (
          <Button variant="ghost" size="sm" onClick={() => setActionFilter('all')}>
            Reset
          </Button>
        )}
      </div>

      {auditLogs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No audit entries found</div>
      ) : (
        <>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="w-32">Action</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead className="w-32">Vehicle</TableHead>
                  <TableHead className="w-24">Date</TableHead>
                  <TableHead className="w-24">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map((entry) => (
                  <Collapsible key={entry.id} open={expandedRows.has(entry.id)}>
                    <CollapsibleTrigger asChild>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleRow(entry.id)}
                      >
                        <TableCell className="py-4">
                          {expandedRows.has(entry.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </TableCell>
                        <TableCell className="py-4">{getActionBadge(entry.action)}</TableCell>
                        <TableCell className="py-4">
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {entry.changed_by_user?.name || 'Unknown'}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              ({entry.changed_by_user?.employee_id || 'N/A'})
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">{getVehicleNumber(entry)}</TableCell>
                        <TableCell className="py-4">{format(new Date(entry.changed_at), 'MMM d')}</TableCell>
                        <TableCell className="py-4">{format(new Date(entry.changed_at), 'h:mm a')}</TableCell>
                      </TableRow>
                    </CollapsibleTrigger>
                    <CollapsibleContent asChild>
                      <TableRow>
                        <TableCell colSpan={6} className="bg-muted/30 p-4">
                          {renderDataComparison(entry)}
                        </TableCell>
                      </TableRow>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, totalCount)} of{' '}
              {totalCount} entries
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={(page + 1) * pageSize >= totalCount}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
