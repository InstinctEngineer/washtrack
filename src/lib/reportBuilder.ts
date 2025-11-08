import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

export type ReportType = 'unified';

export interface ReportFilter {
  field: string;
  operator: 'equals' | 'contains' | 'between' | 'in' | 'greater_than' | 'less_than';
  value: any;
}

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

export interface ReportConfig {
  reportType: ReportType;
  columns: string[];
  filters: ReportFilter[];
  sorting: SortConfig[];
  groupBy?: string;
}

export interface ReportTemplate {
  id: string;
  template_name: string;
  description: string | null;
  report_type: ReportType;
  config: ReportConfig;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
  use_count: number;
  is_shared: boolean;
  is_system_template: boolean;
}

// Unified column definitions - only fields currently being captured in the app
export const UNIFIED_COLUMNS = [
  // Wash Entry Details
  { id: 'wash_date', label: 'Date', category: 'Wash Entry', isAggregate: false },
  
  // Vehicle Information
  { id: 'vehicle_number', label: 'Vehicle Number', category: 'Vehicle', isAggregate: false },
  { id: 'vehicle_type', label: 'Vehicle Type', category: 'Vehicle', isAggregate: false },
  
  // Client Information
  { id: 'client_name', label: 'Client Name', category: 'Client', isAggregate: false },
  
  // Location Information
  { id: 'location_name', label: 'Vehicle Location', category: 'Location', isAggregate: false },
  
  // Employee Information
  { id: 'employee_name', label: 'Employee Name', category: 'Employee', isAggregate: false },
  
  // Financial Information
  { id: 'rate_at_time_of_wash', label: 'Rate ($)', category: 'Financial', isAggregate: false },
  
  // Aggregated Metrics
  { id: 'total_washes', label: 'Total Washes', category: 'Metrics', isAggregate: true },
  { id: 'total_revenue', label: 'Total Revenue ($)', category: 'Metrics', isAggregate: true },
  { id: 'avg_wash_value', label: 'Avg Wash Value ($)', category: 'Metrics', isAggregate: true },
  { id: 'locations_serviced', label: 'Locations Serviced', category: 'Metrics', isAggregate: true },
];

// Legacy column arrays for backward compatibility
export const WASH_ENTRIES_COLUMNS = UNIFIED_COLUMNS.filter(c => !c.isAggregate);
export const CLIENT_BILLING_COLUMNS = UNIFIED_COLUMNS.filter(c => c.category === 'Client' || c.category === 'Metrics');
export const EMPLOYEE_PERFORMANCE_COLUMNS = UNIFIED_COLUMNS.filter(c => c.category === 'Employee' || c.category === 'Metrics' || c.id === 'location_name');

// Helper function to resolve date range values
function resolveDateRange(value: string | [string, string]): [string, string] {
  const today = new Date();
  
  if (Array.isArray(value)) {
    return value as [string, string];
  }
  
  switch (value) {
    case 'last_7_days':
      return [format(subDays(today, 7), 'yyyy-MM-dd'), format(today, 'yyyy-MM-dd')];
    case 'current_month':
      return [format(startOfMonth(today), 'yyyy-MM-dd'), format(endOfMonth(today), 'yyyy-MM-dd')];
    case 'last_month':
      const lastMonth = subDays(startOfMonth(today), 1);
      return [format(startOfMonth(lastMonth), 'yyyy-MM-dd'), format(endOfMonth(lastMonth), 'yyyy-MM-dd')];
    default:
      return [format(today, 'yyyy-MM-dd'), format(today, 'yyyy-MM-dd')];
  }
}

// Build query for wash entries report
export async function buildWashEntriesQuery(config: ReportConfig) {
  let query = supabase
    .from('wash_entries')
    .select(`
      id,
      wash_date,
      rate_at_time_of_wash,
      vehicle:vehicles!inner(
        id,
        vehicle_number,
        client_id,
        vehicle_type:vehicle_types(type_name),
        client:clients(client_name)
      ),
      actual_location:locations!wash_entries_actual_location_id_fkey(id, name),
      employee:users!wash_entries_employee_id_fkey(id, name)
    `);

  // Apply filters
  for (const filter of config.filters) {
    if (filter.field === 'wash_date' && filter.operator === 'between') {
      const [startDate, endDate] = resolveDateRange(filter.value);
      query = query.gte('wash_date', startDate).lte('wash_date', endDate);
    }
  }

  // Apply sorting
  for (const sort of config.sorting) {
    if (sort.field === 'wash_date') {
      query = query.order('wash_date', { ascending: sort.direction === 'asc' });
    }
  }

  const { data, error } = await query;

  if (error) throw error;

  let filteredData = data || [];

  // Apply post-fetch filters (for nested fields)
  for (const filter of config.filters) {
    if (filter.field === 'client_id' && filter.operator === 'in' && Array.isArray(filter.value) && filter.value.length > 0) {
      filteredData = filteredData.filter((entry: any) => 
        filter.value.includes(entry.vehicle?.client_id)
      );
    } else if (filter.field === 'location_id' && filter.operator === 'in' && Array.isArray(filter.value) && filter.value.length > 0) {
      filteredData = filteredData.filter((entry: any) => 
        filter.value.includes(entry.actual_location?.id)
      );
    } else if (filter.field === 'employee_id' && filter.operator === 'in' && Array.isArray(filter.value) && filter.value.length > 0) {
      filteredData = filteredData.filter((entry: any) => 
        filter.value.includes(entry.employee?.id)
      );
    }
  }

  // Transform data to flat structure based on selected columns
  return filteredData.map((entry: any) => {
    const row: any = {};
    
    config.columns.forEach((col) => {
      switch (col) {
        case 'wash_date':
          row['wash_date'] = entry.wash_date;
          break;
        case 'vehicle_number':
          row['vehicle_number'] = entry.vehicle?.vehicle_number || '';
          break;
        case 'client_name':
          row['client_name'] = entry.vehicle?.client?.client_name || '';
          break;
        case 'vehicle_type':
          row['vehicle_type'] = entry.vehicle?.vehicle_type?.type_name || '';
          break;
        case 'rate_at_time_of_wash':
          row['rate_at_time_of_wash'] = entry.rate_at_time_of_wash || '';
          break;
        case 'location_name':
          row['location_name'] = entry.actual_location?.name || '';
          break;
        case 'employee_name':
          row['employee_name'] = entry.employee?.name || '';
          break;
      }
    });
    
    return row;
  });
}

// Build query for client billing report
export async function buildClientBillingQuery(config: ReportConfig) {
  let query = supabase
    .from('wash_entries')
    .select(`
      id,
      wash_date,
      rate_at_time_of_wash,
      vehicle:vehicles!inner(
        client_id,
        client:clients(client_name)
      ),
      actual_location:locations(name)
    `);

  // Apply date filter
  for (const filter of config.filters) {
    if (filter.field === 'wash_date' && filter.operator === 'between') {
      const [startDate, endDate] = resolveDateRange(filter.value);
      query = query.gte('wash_date', startDate).lte('wash_date', endDate);
    }
  }

  const { data, error } = await query;

  if (error) throw error;

  // Group by client
  const clientMap = new Map<string, any>();
  
  data?.forEach((entry: any) => {
    const clientId = entry.vehicle?.client_id;
    const clientName = entry.vehicle?.client?.client_name || 'Unknown';
    
    if (!clientMap.has(clientId)) {
      clientMap.set(clientId, {
        client_name: clientName,
        total_washes: 0,
        total_revenue: 0,
        locations: new Set<string>(),
      });
    }
    
    const client = clientMap.get(clientId);
    client.total_washes += 1;
    client.total_revenue += parseFloat(entry.rate_at_time_of_wash || 0);
    if (entry.actual_location?.name) {
      client.locations.add(entry.actual_location.name);
    }
  });

  // Transform to array and calculate averages
  const results = Array.from(clientMap.values()).map(client => {
    const row: any = {};
    
    config.columns.forEach((col) => {
      switch (col) {
        case 'client_name':
          row['client_name'] = client.client_name;
          break;
        case 'total_washes':
          row['total_washes'] = client.total_washes;
          break;
        case 'total_revenue':
          row['total_revenue'] = client.total_revenue.toFixed(2);
          break;
        case 'avg_wash_value':
          row['avg_wash_value'] = (client.total_revenue / client.total_washes).toFixed(2);
          break;
        case 'locations_serviced':
          row['locations_serviced'] = Array.from(client.locations).join(', ');
          break;
      }
    });
    
    return row;
  });

  // Sort by total revenue descending by default
  return results.sort((a, b) => {
    const aRev = parseFloat(a['total_revenue'] || '0');
    const bRev = parseFloat(b['total_revenue'] || '0');
    return bRev - aRev;
  });
}

// Build query for employee performance report
export async function buildEmployeePerformanceQuery(config: ReportConfig) {
  let query = supabase
    .from('wash_entries')
    .select(`
      id,
      wash_date,
      rate_at_time_of_wash,
      employee:users!wash_entries_employee_id_fkey(id, name, location_id),
      actual_location:locations(name)
    `);

  // Apply date filter
  for (const filter of config.filters) {
    if (filter.field === 'wash_date' && filter.operator === 'between') {
      const [startDate, endDate] = resolveDateRange(filter.value);
      query = query.gte('wash_date', startDate).lte('wash_date', endDate);
    }
  }

  const { data, error } = await query;

  if (error) throw error;

  // Get location names
  const { data: locations } = await supabase
    .from('locations')
    .select('id, name');

  const locationMap = new Map(locations?.map(l => [l.id, l.name]) || []);

  // Group by employee
  const employeeMap = new Map<string, any>();
  
  data?.forEach((entry: any) => {
    const employeeId = entry.employee?.id;
    const employeeName = entry.employee?.name || 'Unknown';
    
    if (!employeeMap.has(employeeId)) {
      employeeMap.set(employeeId, {
        employee_name: employeeName,
        location_name: locationMap.get(entry.employee?.location_id) || '',
        total_washes: 0,
        total_revenue: 0,
        locations: new Set<string>(),
      });
    }
    
    const employee = employeeMap.get(employeeId);
    employee.total_washes += 1;
    employee.total_revenue += parseFloat(entry.rate_at_time_of_wash || 0);
    
    if (entry.actual_location?.name) {
      employee.locations.add(entry.actual_location.name);
    }
  });

  // Transform to array and calculate averages
  const results = Array.from(employeeMap.values()).map(employee => {
    const row: any = {};
    
    config.columns.forEach((col) => {
      switch (col) {
        case 'employee_name':
          row['employee_name'] = employee.employee_name;
          break;
        case 'location_name':
          row['location_name'] = employee.location_name;
          break;
        case 'total_washes':
          row['total_washes'] = employee.total_washes;
          break;
        case 'total_revenue':
          row['total_revenue'] = employee.total_revenue.toFixed(2);
          break;
        case 'avg_wash_value':
          row['avg_wash_value'] = (employee.total_revenue / employee.total_washes).toFixed(2);
          break;
        case 'locations_serviced':
          row['locations_serviced'] = Array.from(employee.locations).join(', ');
          break;
      }
    });
    
    return row;
  });

  // Sort by total washes descending by default
  return results.sort((a, b) => {
    const aWashes = parseInt(a['total_washes'] || '0');
    const bWashes = parseInt(b['total_washes'] || '0');
    return bWashes - aWashes;
  });
}

// Unified query builder that intelligently routes based on selected columns
async function buildUnifiedQuery(config: ReportConfig) {
  // Check if any aggregate columns are selected
  const hasAggregateColumns = config.columns.some(col => 
    UNIFIED_COLUMNS.find(c => c.id === col)?.isAggregate
  );
  
  // Check if any detail columns are selected
  const detailColumns = config.columns.filter(col => 
    !UNIFIED_COLUMNS.find(c => c.id === col)?.isAggregate
  );
  const hasDetailColumns = detailColumns.length > 0;
  
  // Aggregate column groups
  const clientAggregates = ['total_washes', 'total_revenue', 'avg_wash_value', 'locations_serviced'];
  const hasClientAggregates = config.columns.some(col => clientAggregates.includes(col));
  const hasClientFields = config.columns.some(col => ['client_name'].includes(col));
  
  const employeeAggregates = ['total_washes', 'total_revenue', 'avg_wash_value', 'locations_serviced'];
  const hasEmployeeAggregates = config.columns.some(col => employeeAggregates.includes(col));
  const hasEmployeeFields = config.columns.some(col => ['employee_name'].includes(col));
  
  // MIXED MODE: Both detail and aggregate columns selected
  if (hasDetailColumns && hasAggregateColumns) {
    // Build detail rows with only detail columns
    const detailConfig = { ...config, columns: detailColumns };
    const detailData = await buildWashEntriesQuery(detailConfig);
    
    // Build aggregate summary
    const aggregateConfig = { ...config, columns: config.columns.filter(col => 
      UNIFIED_COLUMNS.find(c => c.id === col)?.isAggregate || 
      col === 'client_name' || 
      col === 'employee_name'
    )};
    
    let aggregateData: any[] = [];
    if (hasClientAggregates && hasClientFields) {
      aggregateData = await buildClientBillingQuery(aggregateConfig);
    } else if (hasEmployeeAggregates && hasEmployeeFields) {
      aggregateData = await buildEmployeePerformanceQuery(aggregateConfig);
    }
    
    // Combine detail and aggregate data
    // Add a separator row
    const separator: any = {};
    detailColumns.forEach(col => {
      const colDef = UNIFIED_COLUMNS.find(c => c.id === col);
      separator[col] = '';
    });
    
    // Add section headers
    const detailHeader: any = {};
    detailColumns.forEach(col => {
      const colDef = UNIFIED_COLUMNS.find(c => c.id === col);
      detailHeader[col] = col === detailColumns[0] ? '--- DETAIL ROWS ---' : '';
    });
    
    const summaryHeader: any = {};
    config.columns.forEach(col => {
      summaryHeader[col] = col === config.columns[0] ? '--- SUMMARY ---' : '';
    });
    
    // Merge aggregate data to include detail columns (empty)
    const expandedAggregateData = aggregateData.map(row => {
      const expandedRow: any = {};
      config.columns.forEach(col => {
        expandedRow[col] = row[col] || '';
      });
      return expandedRow;
    });
    
    return [
      detailHeader,
      ...detailData,
      separator,
      summaryHeader,
      ...expandedAggregateData
    ];
  }
  
  // AGGREGATE ONLY MODE
  if (hasClientAggregates && hasClientFields && !hasDetailColumns) {
    return buildClientBillingQuery(config);
  } else if (hasEmployeeAggregates && hasEmployeeFields && !hasDetailColumns) {
    return buildEmployeePerformanceQuery(config);
  }
  
  // DETAIL ONLY MODE (default)
  return buildWashEntriesQuery(config);
}

// Main function to build query based on report type
export async function executeReport(config: ReportConfig) {
  return buildUnifiedQuery(config);
}

// Generate a preview of the report with limited rows
export async function generateReportPreview(config: ReportConfig, limit: number = 20) {
  // Add reportType if not present
  const fullConfig = {
    ...config,
    reportType: 'unified' as ReportType,
  };
  
  // Execute the full query
  const data = await buildUnifiedQuery(fullConfig);
  
  // Determine report type based on columns
  const hasAggregateFields = config.columns.some(col =>
    UNIFIED_COLUMNS.find(c => c.id === col)?.isAggregate
  );
  const hasDetailFields = config.columns.some(col =>
    !UNIFIED_COLUMNS.find(c => c.id === col)?.isAggregate
  );
  
  // Determine if mixed mode
  const isMixed = hasAggregateFields && hasDetailFields;
  
  // Return limited data with metadata
  return {
    data: data.slice(0, limit),
    totalCount: data.length,
    reportType: isMixed ? 'mixed' as const : (hasAggregateFields ? 'aggregated' as const : 'detail' as const),
  };
}

export function getColumnsByReportType(reportType: ReportType) {
  return UNIFIED_COLUMNS;
}
