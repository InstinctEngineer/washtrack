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

// Unified column definitions - all available data fields
export const UNIFIED_COLUMNS = [
  // Wash Entry Details
  { id: 'wash_date', label: 'Date', category: 'Wash Entry', isAggregate: false },
  { id: 'time_started', label: 'Time Started', category: 'Wash Entry', isAggregate: false },
  { id: 'time_completed', label: 'Time Completed', category: 'Wash Entry', isAggregate: false },
  { id: 'wash_duration_minutes', label: 'Duration (min)', category: 'Wash Entry', isAggregate: false },
  { id: 'quality_rating', label: 'Quality Rating', category: 'Wash Entry', isAggregate: false },
  { id: 'damage_reported', label: 'Damage Reported', category: 'Wash Entry', isAggregate: false },
  { id: 'damage_description', label: 'Damage Description', category: 'Wash Entry', isAggregate: false },
  
  // Vehicle Information
  { id: 'vehicle_number', label: 'Vehicle Number', category: 'Vehicle', isAggregate: false },
  { id: 'vehicle_type', label: 'Vehicle Type', category: 'Vehicle', isAggregate: false },
  
  // Client Information
  { id: 'client_name', label: 'Client Name', category: 'Client', isAggregate: false },
  { id: 'client_code', label: 'Client Code', category: 'Client', isAggregate: false },
  { id: 'primary_contact', label: 'Primary Contact', category: 'Client', isAggregate: false },
  { id: 'contact_email', label: 'Contact Email', category: 'Client', isAggregate: false },
  
  // Location Information
  { id: 'location_name', label: 'Location', category: 'Location', isAggregate: false },
  { id: 'locations_serviced', label: 'Locations Serviced', category: 'Location', isAggregate: true },
  
  // Employee Information
  { id: 'employee_name', label: 'Employee Name', category: 'Employee', isAggregate: false },
  { id: 'employee_id', label: 'Employee ID', category: 'Employee', isAggregate: false },
  
  // Financial Information
  { id: 'rate_per_wash', label: 'Rate ($)', category: 'Financial', isAggregate: false },
  { id: 'rate_override', label: 'Custom Rate', category: 'Financial', isAggregate: false },
  { id: 'final_amount', label: 'Final Amount ($)', category: 'Financial', isAggregate: false },
  { id: 'customer_po_number', label: 'Client PO Number', category: 'Financial', isAggregate: false },
  
  // Aggregated Metrics
  { id: 'total_washes', label: 'Total Washes', category: 'Metrics', isAggregate: true },
  { id: 'total_revenue', label: 'Total Revenue ($)', category: 'Metrics', isAggregate: true },
  { id: 'avg_wash_value', label: 'Avg Wash Value ($)', category: 'Metrics', isAggregate: true },
  { id: 'avg_washes_per_day', label: 'Avg Washes/Day', category: 'Metrics', isAggregate: true },
  { id: 'avg_quality_rating', label: 'Avg Quality Rating', category: 'Metrics', isAggregate: true },
  { id: 'damage_reports_count', label: 'Damage Reports', category: 'Metrics', isAggregate: true },
  { id: 'avg_duration', label: 'Avg Duration (min)', category: 'Metrics', isAggregate: true },
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
      time_started,
      time_completed,
      wash_duration_minutes,
      quality_rating,
      damage_reported,
      damage_description,
      rate_override,
      final_amount,
      customer_po_number,
      vehicle:vehicles!inner(
        id,
        vehicle_number,
        client_id,
        vehicle_type:vehicle_types(type_name, rate_per_wash),
        client:clients(client_name)
      ),
      actual_location:locations!inner(id, name),
      employee:users!wash_entries_employee_id_fkey(id, name, employee_id)
    `);

  // Apply filters
  for (const filter of config.filters) {
    if (filter.field === 'wash_date' && filter.operator === 'between') {
      const [startDate, endDate] = resolveDateRange(filter.value);
      query = query.gte('wash_date', startDate).lte('wash_date', endDate);
    } else if (filter.field === 'damage_reported' && filter.operator === 'equals') {
      query = query.eq('damage_reported', filter.value);
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
          row['Date'] = entry.wash_date;
          break;
        case 'vehicle_number':
          row['Vehicle Number'] = entry.vehicle?.vehicle_number || '';
          break;
        case 'client_name':
          row['Client Name'] = entry.vehicle?.client?.client_name || '';
          break;
        case 'vehicle_type':
          row['Vehicle Type'] = entry.vehicle?.vehicle_type?.type_name || '';
          break;
        case 'rate_per_wash':
          row['Rate ($)'] = entry.vehicle?.vehicle_type?.rate_per_wash || '';
          break;
        case 'location_name':
          row['Location'] = entry.actual_location?.name || '';
          break;
        case 'employee_name':
          row['Employee Name'] = entry.employee?.name || '';
          break;
        case 'employee_id':
          row['Employee ID'] = entry.employee?.employee_id || '';
          break;
        case 'time_started':
          row['Time Started'] = entry.time_started || '';
          break;
        case 'time_completed':
          row['Time Completed'] = entry.time_completed || '';
          break;
        case 'wash_duration_minutes':
          row['Duration (min)'] = entry.wash_duration_minutes || '';
          break;
        case 'quality_rating':
          row['Quality Rating'] = entry.quality_rating || '';
          break;
        case 'damage_reported':
          row['Damage Reported'] = entry.damage_reported ? 'Yes' : 'No';
          break;
        case 'damage_description':
          row['Damage Description'] = entry.damage_description || '';
          break;
        case 'rate_override':
          row['Custom Rate'] = entry.rate_override || '';
          break;
        case 'final_amount':
          row['Final Amount ($)'] = entry.final_amount || '';
          break;
        case 'customer_po_number':
          row['Client PO Number'] = entry.customer_po_number || '';
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
      final_amount,
      vehicle:vehicles!inner(
        client_id,
        client:clients(client_name, client_code, primary_contact_name, primary_contact_email)
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
        client_code: entry.vehicle?.client?.client_code || '',
        primary_contact: entry.vehicle?.client?.primary_contact_name || '',
        contact_email: entry.vehicle?.client?.primary_contact_email || '',
        total_washes: 0,
        total_revenue: 0,
        locations: new Set<string>(),
      });
    }
    
    const client = clientMap.get(clientId);
    client.total_washes += 1;
    client.total_revenue += parseFloat(entry.final_amount || 0);
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
          row['Client Name'] = client.client_name;
          break;
        case 'client_code':
          row['Client Code'] = client.client_code;
          break;
        case 'total_washes':
          row['Total Washes'] = client.total_washes;
          break;
        case 'total_revenue':
          row['Total Revenue ($)'] = client.total_revenue.toFixed(2);
          break;
        case 'avg_wash_value':
          row['Avg Wash Value ($)'] = (client.total_revenue / client.total_washes).toFixed(2);
          break;
        case 'locations_serviced':
          row['Locations Serviced'] = Array.from(client.locations).join(', ');
          break;
        case 'primary_contact':
          row['Primary Contact'] = client.primary_contact;
          break;
        case 'contact_email':
          row['Contact Email'] = client.contact_email;
          break;
      }
    });
    
    return row;
  });

  // Sort by total revenue descending by default
  return results.sort((a, b) => {
    const aRev = parseFloat(a['Total Revenue ($)'] || '0');
    const bRev = parseFloat(b['Total Revenue ($)'] || '0');
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
      wash_duration_minutes,
      quality_rating,
      damage_reported,
      final_amount,
      employee:users!wash_entries_employee_id_fkey(id, name, employee_id, location_id),
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
  const datesSet = new Map<string, Set<string>>();
  
  data?.forEach((entry: any) => {
    const employeeId = entry.employee?.id;
    const employeeName = entry.employee?.name || 'Unknown';
    
    if (!employeeMap.has(employeeId)) {
      employeeMap.set(employeeId, {
        employee_name: employeeName,
        employee_id: entry.employee?.employee_id || '',
        location_name: locationMap.get(entry.employee?.location_id) || '',
        total_washes: 0,
        total_revenue: 0,
        total_duration: 0,
        duration_count: 0,
        quality_ratings: [] as number[],
        damage_reports: 0,
      });
      datesSet.set(employeeId, new Set<string>());
    }
    
    const employee = employeeMap.get(employeeId);
    employee.total_washes += 1;
    employee.total_revenue += parseFloat(entry.final_amount || 0);
    
    if (entry.wash_duration_minutes) {
      employee.total_duration += entry.wash_duration_minutes;
      employee.duration_count += 1;
    }
    
    if (entry.quality_rating) {
      employee.quality_ratings.push(entry.quality_rating);
    }
    
    if (entry.damage_reported) {
      employee.damage_reports += 1;
    }
    
    // Track unique dates for avg per day calculation
    datesSet.get(employeeId)?.add(entry.wash_date);
  });

  // Transform to array and calculate averages
  const results = Array.from(employeeMap.entries()).map(([employeeId, employee]) => {
    const uniqueDays = datesSet.get(employeeId)?.size || 1;
    const row: any = {};
    
    config.columns.forEach((col) => {
      switch (col) {
        case 'employee_name':
          row['Employee Name'] = employee.employee_name;
          break;
        case 'employee_id':
          row['Employee ID'] = employee.employee_id;
          break;
        case 'location_name':
          row['Location'] = employee.location_name;
          break;
        case 'total_washes':
          row['Total Washes'] = employee.total_washes;
          break;
        case 'total_revenue':
          row['Total Revenue ($)'] = employee.total_revenue.toFixed(2);
          break;
        case 'avg_washes_per_day':
          row['Avg Washes/Day'] = (employee.total_washes / uniqueDays).toFixed(1);
          break;
        case 'avg_quality_rating':
          const avgRating = employee.quality_ratings.length > 0
            ? employee.quality_ratings.reduce((a: number, b: number) => a + b, 0) / employee.quality_ratings.length
            : 0;
          row['Avg Quality Rating'] = avgRating.toFixed(1);
          break;
        case 'damage_reports_count':
          row['Damage Reports'] = employee.damage_reports;
          break;
        case 'avg_duration':
          const avgDuration = employee.duration_count > 0
            ? employee.total_duration / employee.duration_count
            : 0;
          row['Avg Duration (min)'] = avgDuration.toFixed(0);
          break;
      }
    });
    
    return row;
  });

  // Sort by total washes descending by default
  return results.sort((a, b) => {
    const aWashes = parseInt(a['Total Washes'] || '0');
    const bWashes = parseInt(b['Total Washes'] || '0');
    return bWashes - aWashes;
  });
}

// Unified query builder that intelligently routes based on selected columns
async function buildUnifiedQuery(config: ReportConfig) {
  // Check if any aggregate columns are selected
  const hasAggregateColumns = config.columns.some(col => 
    UNIFIED_COLUMNS.find(c => c.id === col)?.isAggregate
  );
  
  // If only client aggregate columns, use client billing logic
  const clientAggregates = ['total_washes', 'total_revenue', 'avg_wash_value', 'locations_serviced'];
  const hasClientAggregates = config.columns.some(col => clientAggregates.includes(col));
  const hasClientFields = config.columns.some(col => ['client_name', 'client_code', 'primary_contact', 'contact_email'].includes(col));
  
  // If only employee aggregate columns, use employee performance logic
  const employeeAggregates = ['avg_washes_per_day', 'avg_quality_rating', 'damage_reports_count', 'avg_duration'];
  const hasEmployeeAggregates = config.columns.some(col => employeeAggregates.includes(col));
  const hasEmployeeFields = config.columns.some(col => ['employee_name', 'employee_id'].includes(col));
  
  if (hasClientAggregates && hasClientFields) {
    return buildClientBillingQuery(config);
  } else if (hasEmployeeAggregates && hasEmployeeFields) {
    return buildEmployeePerformanceQuery(config);
  } else {
    // Default to wash entries for detailed data
    return buildWashEntriesQuery(config);
  }
}

// Main function to build query based on report type
export async function executeReport(config: ReportConfig) {
  return buildUnifiedQuery(config);
}

export function getColumnsByReportType(reportType: ReportType) {
  return UNIFIED_COLUMNS;
}
