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
import { Card, CardContent } from '@/components/ui/card';

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

// Helper functions
const formatCurrency = (value: any): string => {
  if (value == null) return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

const formatBoolean = (value: any): string => {
  if (value == null) return 'N/A';
  return value ? 'Yes' : 'No';
};

const formatDateTime = (value: any): string => {
  if (!value) return 'N/A';
  try {
    return format(new Date(value), 'MMM d, yyyy h:mm a');
  } catch {
    return 'Invalid Date';
  }
};

const formatDate = (value: any): string => {
  if (!value) return 'N/A';
  try {
    return format(new Date(value), 'MMM d, yyyy');
  } catch {
    return 'Invalid Date';
  }
};

export function AuditLogTable() {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [vehicleMap, setVehicleMap] = useState<Map<string, string>>(new Map());
  const [locationMap, setLocationMap] = useState<Map<string, string>>(new Map());
  const [clientMap, setClientMap] = useState<Map<string, string>>(new Map());
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

      // Fetch related data (vehicles, locations, clients)
      if (data && data.length > 0) {
        const vehicleIds = new Set<string>();
        const locationIds = new Set<string>();
        const clientIds = new Set<string>();

        data.forEach((entry) => {
          const entryData = entry.action === 'DELETE' ? entry.old_data : entry.new_data;
          if (entryData && typeof entryData === 'object' && !Array.isArray(entryData)) {
            if ((entryData as any).vehicle_id) vehicleIds.add((entryData as any).vehicle_id);
            if ((entryData as any).actual_location_id) locationIds.add((entryData as any).actual_location_id);
            if ((entryData as any).client_id) clientIds.add((entryData as any).client_id);
          }
        });

        // Fetch vehicles
        if (vehicleIds.size > 0) {
          const { data: vehicles } = await supabase
            .from('vehicles')
            .select('id, vehicle_number')
            .in('id', Array.from(vehicleIds));

          if (vehicles) {
            setVehicleMap(new Map(vehicles.map((v) => [v.id, v.vehicle_number])));
          }
        }

        // Fetch locations
        if (locationIds.size > 0) {
          const { data: locations } = await supabase
            .from('locations')
            .select('id, name')
            .in('id', Array.from(locationIds));

          if (locations) {
            setLocationMap(new Map(locations.map((l) => [l.id, l.name])));
          }
        }

        // Fetch clients
        if (clientIds.size > 0) {
          const { data: clients } = await supabase
            .from('clients')
            .select('id, client_name')
            .in('id', Array.from(clientIds));

          if (clients) {
            setClientMap(new Map(clients.map((c) => [c.id, c.client_name])));
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

  const getTableBadge = (tableName: string) => {
    const nameMap: Record<string, string> = {
      wash_entries: 'Wash Entries',
      vehicles: 'Vehicles',
      users: 'Users',
      locations: 'Locations',
    };
    return (
      <Badge variant="outline" className="font-normal">
        {nameMap[tableName] || tableName}
      </Badge>
    );
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

  const getChangedFields = (oldData: any, newData: any) => {
    const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];
    const allKeys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);

    allKeys.forEach((key) => {
      const oldVal = oldData?.[key];
      const newVal = newData?.[key];
      
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push({ field: key, oldValue: oldVal, newValue: newVal });
      }
    });

    return changes;
  };

  const formatFieldValue = (field: string, value: any): string => {
    if (value == null || value === '') return 'N/A';

    // Currency fields
    if (field.includes('amount') || field.includes('rate') || field.includes('cost') || field.includes('price')) {
      return formatCurrency(value);
    }

    // Boolean fields
    if (typeof value === 'boolean') {
      return formatBoolean(value);
    }

    // Date/time fields
    if (field.includes('_at') && typeof value === 'string') {
      return formatDateTime(value);
    }
    if (field === 'wash_date' || field.includes('_date')) {
      return formatDate(value);
    }

    // ID fields - try to resolve
    if (field === 'vehicle_id') {
      return vehicleMap.get(value) || value;
    }
    if (field === 'actual_location_id') {
      return locationMap.get(value) || value;
    }
    if (field === 'client_id') {
      return clientMap.get(value) || value;
    }

    return String(value);
  };

  const formatFieldName = (field: string): string => {
    return field
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const renderDataComparison = (entry: AuditLogEntry) => {
    const data = entry.action === 'DELETE' ? entry.old_data : entry.new_data;

    if (entry.action === 'UPDATE') {
      const changes = getChangedFields(entry.old_data, entry.new_data);

      return (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-3">Overview</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Wash Date:</span>{' '}
                <span className="font-medium">{formatDate(data?.wash_date)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Vehicle:</span>{' '}
                <span className="font-medium">{vehicleMap.get(data?.vehicle_id) || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Location:</span>{' '}
                <span className="font-medium">{locationMap.get(data?.actual_location_id) || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Client:</span>{' '}
                <span className="font-medium">{clientMap.get(data?.client_id) || 'N/A'}</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-3">Changes Made ({changes.length})</h4>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Field</TableHead>
                    <TableHead>Old Value</TableHead>
                    <TableHead>New Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {changes.map((change, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{formatFieldName(change.field)}</TableCell>
                      <TableCell className="text-destructive">{formatFieldValue(change.field, change.oldValue)}</TableCell>
                      <TableCell className="text-green-600">{formatFieldValue(change.field, change.newValue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {(data?.comment || data?.employee_notes) && (
            <div>
              <h4 className="font-semibold mb-2">Notes</h4>
              <Card>
                <CardContent className="pt-4">
                  {data?.comment && (
                    <div className="mb-2">
                      <span className="text-sm text-muted-foreground">Comment:</span>{' '}
                      <span className="text-sm">{data.comment}</span>
                    </div>
                  )}
                  {data?.employee_notes && (
                    <div>
                      <span className="text-sm text-muted-foreground">Employee Notes:</span>{' '}
                      <span className="text-sm">{data.employee_notes}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      );
    } else if (entry.action === 'DELETE') {
      return (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-3">Deleted Entry Details</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Wash Date:</span>{' '}
                <span className="font-medium">{formatDate(data?.wash_date)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Vehicle:</span>{' '}
                <span className="font-medium">{vehicleMap.get(data?.vehicle_id) || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Location:</span>{' '}
                <span className="font-medium">{locationMap.get(data?.actual_location_id) || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Client:</span>{' '}
                <span className="font-medium">{clientMap.get(data?.client_id) || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Time Started:</span>{' '}
                <span className="font-medium">{formatDateTime(data?.time_started)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Time Completed:</span>{' '}
                <span className="font-medium">{formatDateTime(data?.time_completed)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Final Amount:</span>{' '}
                <span className="font-medium">{formatCurrency(data?.final_amount)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Damage Reported:</span>{' '}
                <span className="font-medium">{formatBoolean(data?.damage_reported)}</span>
              </div>
            </div>
          </div>

          {(data?.comment || data?.employee_notes || data?.deletion_reason) && (
            <div>
              <h4 className="font-semibold mb-2">Notes</h4>
              <Card>
                <CardContent className="pt-4 space-y-2">
                  {data?.comment && (
                    <div>
                      <span className="text-sm text-muted-foreground">Comment:</span>{' '}
                      <span className="text-sm">{data.comment}</span>
                    </div>
                  )}
                  {data?.employee_notes && (
                    <div>
                      <span className="text-sm text-muted-foreground">Employee Notes:</span>{' '}
                      <span className="text-sm">{data.employee_notes}</span>
                    </div>
                  )}
                  {data?.deletion_reason && (
                    <div>
                      <span className="text-sm text-muted-foreground">Deletion Reason:</span>{' '}
                      <span className="text-sm">{data.deletion_reason}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      );
    } else {
      // INSERT
      return (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-3">New Entry Details</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Wash Date:</span>{' '}
                <span className="font-medium">{formatDate(data?.wash_date)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Vehicle:</span>{' '}
                <span className="font-medium">{vehicleMap.get(data?.vehicle_id) || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Location:</span>{' '}
                <span className="font-medium">{locationMap.get(data?.actual_location_id) || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Client:</span>{' '}
                <span className="font-medium">{clientMap.get(data?.client_id) || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Time Started:</span>{' '}
                <span className="font-medium">{formatDateTime(data?.time_started)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Time Completed:</span>{' '}
                <span className="font-medium">{formatDateTime(data?.time_completed)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Final Amount:</span>{' '}
                <span className="font-medium">{formatCurrency(data?.final_amount)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Requires Approval:</span>{' '}
                <span className="font-medium">{formatBoolean(data?.requires_approval)}</span>
              </div>
            </div>
          </div>

          {(data?.comment || data?.employee_notes) && (
            <div>
              <h4 className="font-semibold mb-2">Notes</h4>
              <Card>
                <CardContent className="pt-4 space-y-2">
                  {data?.comment && (
                    <div>
                      <span className="text-sm text-muted-foreground">Comment:</span>{' '}
                      <span className="text-sm">{data.comment}</span>
                    </div>
                  )}
                  {data?.employee_notes && (
                    <div>
                      <span className="text-sm text-muted-foreground">Employee Notes:</span>{' '}
                      <span className="text-sm">{data.employee_notes}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
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
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="w-32">Table</TableHead>
                    <TableHead className="w-24">Action</TableHead>
                    <TableHead className="w-48">Employee</TableHead>
                    <TableHead className="w-32">Vehicle</TableHead>
                    <TableHead className="w-32">Date</TableHead>
                    <TableHead className="w-28">Time</TableHead>
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
                        <TableCell className="w-12 py-4">
                          {expandedRows.has(entry.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </TableCell>
                        <TableCell className="w-32 py-4">{getTableBadge(entry.table_name)}</TableCell>
                        <TableCell className="w-24 py-4">{getActionBadge(entry.action)}</TableCell>
                        <TableCell className="w-48 py-4">
                          {entry.changed_by_user?.name || 'Unknown'} ({entry.changed_by_user?.employee_id || 'N/A'})
                        </TableCell>
                        <TableCell className="w-32 py-4">{getVehicleNumber(entry)}</TableCell>
                        <TableCell className="w-32 py-4">{format(new Date(entry.changed_at), 'MMM d')}</TableCell>
                        <TableCell className="w-28 py-4">{format(new Date(entry.changed_at), 'h:mm a')}</TableCell>
                      </TableRow>
                    </CollapsibleTrigger>
                    <CollapsibleContent asChild>
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/30 p-6">
                          {renderDataComparison(entry)}
                        </TableCell>
                      </TableRow>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </TableBody>
              </Table>
            </div>
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
