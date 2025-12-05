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

// System templates with pre-configured smart defaults
export const SYSTEM_TEMPLATES: Omit<ReportTemplate, 'created_by' | 'created_at' | 'updated_at' | 'last_used_at' | 'use_count'>[] = [
  {
    id: 'system-invoice-report',
    template_name: 'Weekly Invoice Report',
    description: 'Generate client invoices by location with weekly totals and billable amounts',
    report_type: 'unified',
    is_shared: true,
    is_system_template: true,
    config: {
      reportType: 'unified',
      columns: [
        'client_name',
        'location_name',
        'vehicle_number',
        'vehicle_type',
        'wash_date',
        'rate_at_time_of_wash',
        'total_washes',
        'total_revenue',
      ],
      filters: [
        {
          field: 'wash_date',
          operator: 'between',
          value: 'current_month', // Will be resolved to actual dates
        }
      ],
      sorting: [
        { field: 'wash_date', direction: 'asc' }
      ],
    },
  },
  {
    id: 'system-payroll-report',
    template_name: 'Employee Payroll Report',
    description: 'Track employee work for payroll with wash counts, revenue, and performance metrics',
    report_type: 'unified',
    is_shared: true,
    is_system_template: true,
    config: {
      reportType: 'unified',
      columns: [
        'employee_name',
        'location_name',
        'wash_date',
        'vehicle_number',
        'vehicle_type',
        'rate_at_time_of_wash',
        'total_washes',
        'total_revenue',
        'avg_wash_value',
      ],
      filters: [
        {
          field: 'wash_date',
          operator: 'between',
          value: 'current_month',
        }
      ],
      sorting: [
        { field: 'wash_date', direction: 'asc' }
      ],
    },
  },
];

// Unified column definitions - only fields currently being captured in the app
export const UNIFIED_COLUMNS = [
  // Wash Entry Details - Main
  { id: 'wash_date', label: 'Date', category: 'Wash Entry', isAggregate: false, isAdvanced: false },
  
  // Vehicle Information - Main
  { id: 'vehicle_number', label: 'Vehicle Number', category: 'Vehicle', isAggregate: false, isAdvanced: false },
  { id: 'vehicle_type', label: 'Vehicle Type', category: 'Vehicle', isAggregate: false, isAdvanced: false },
  
  // Client Information - Main
  { id: 'client_name', label: 'Client Name', category: 'Client', isAggregate: false, isAdvanced: false },
  
  // Location Information - Main
  { id: 'location_name', label: 'Vehicle Location', category: 'Location', isAggregate: false, isAdvanced: false },
  
  // Employee Information - Main
  { id: 'employee_name', label: 'Employee Name', category: 'Employee', isAggregate: false, isAdvanced: false },
  
  // Financial Information - Main
  { id: 'rate_at_time_of_wash', label: 'Rate ($)', category: 'Financial', isAggregate: false, isAdvanced: false },
  
  // Aggregated Metrics - Main
  { id: 'total_washes', label: 'Total Washes', category: 'Metrics', isAggregate: true, isAdvanced: false },
  { id: 'total_revenue', label: 'Total Revenue ($)', category: 'Metrics', isAggregate: true, isAdvanced: false },
  { id: 'avg_wash_value', label: 'Avg Wash Value ($)', category: 'Metrics', isAggregate: true, isAdvanced: false },
  { id: 'locations_serviced', label: 'Locations Serviced', category: 'Metrics', isAggregate: true, isAdvanced: false },

  // ============ ADVANCED FIELDS ============
  
  // Wash Entry Details - Advanced
  { id: 'created_at', label: 'Entry Created', category: 'Wash Entry', isAggregate: false, isAdvanced: true },
  { id: 'comment', label: 'Comment/Notes', category: 'Wash Entry', isAggregate: false, isAdvanced: true },
  { id: 'time_started', label: 'Time Started', category: 'Wash Entry', isAggregate: false, isAdvanced: true },
  { id: 'time_completed', label: 'Time Completed', category: 'Wash Entry', isAggregate: false, isAdvanced: true },
  { id: 'wash_duration_minutes', label: 'Duration (mins)', category: 'Wash Entry', isAggregate: false, isAdvanced: true },
  { id: 'service_type', label: 'Service Type', category: 'Wash Entry', isAggregate: false, isAdvanced: true },
  { id: 'customer_po_number', label: 'PO Number', category: 'Wash Entry', isAggregate: false, isAdvanced: true },

  // Vehicle Details - Advanced
  { id: 'fleet_number', label: 'Fleet Number', category: 'Vehicle', isAggregate: false, isAdvanced: true },
  { id: 'license_plate', label: 'License Plate', category: 'Vehicle', isAggregate: false, isAdvanced: true },
  { id: 'vehicle_make', label: 'Make', category: 'Vehicle', isAggregate: false, isAdvanced: true },
  { id: 'vehicle_model', label: 'Model', category: 'Vehicle', isAggregate: false, isAdvanced: true },
  { id: 'vehicle_year', label: 'Year', category: 'Vehicle', isAggregate: false, isAdvanced: true },
  { id: 'vehicle_color', label: 'Color', category: 'Vehicle', isAggregate: false, isAdvanced: true },

  // Client Details - Advanced
  { id: 'client_code', label: 'Client Code', category: 'Client', isAggregate: false, isAdvanced: true },
  { id: 'client_contact_name', label: 'Client Contact', category: 'Client', isAggregate: false, isAdvanced: true },
  { id: 'client_contact_email', label: 'Client Email', category: 'Client', isAggregate: false, isAdvanced: true },
  { id: 'client_contact_phone', label: 'Client Phone', category: 'Client', isAggregate: false, isAdvanced: true },

  // Location Details - Advanced
  { id: 'location_address', label: 'Location Address', category: 'Location', isAggregate: false, isAdvanced: true },
  { id: 'location_city', label: 'City', category: 'Location', isAggregate: false, isAdvanced: true },
  { id: 'location_state', label: 'State', category: 'Location', isAggregate: false, isAdvanced: true },

  // Employee Details - Advanced
  { id: 'employee_id_number', label: 'Employee ID', category: 'Employee', isAggregate: false, isAdvanced: true },
  { id: 'employee_email', label: 'Employee Email', category: 'Employee', isAggregate: false, isAdvanced: true },
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
  // Check if we need advanced fields to optimize the query
  const needsAdvancedWashFields = config.columns.some(col => 
    ['created_at', 'comment', 'time_started', 'time_completed', 'wash_duration_minutes', 'service_type', 'customer_po_number'].includes(col)
  );
  const needsAdvancedVehicleFields = config.columns.some(col => 
    ['fleet_number', 'license_plate', 'vehicle_make', 'vehicle_model', 'vehicle_year', 'vehicle_color'].includes(col)
  );
  const needsAdvancedClientFields = config.columns.some(col => 
    ['client_code', 'client_contact_name', 'client_contact_email', 'client_contact_phone'].includes(col)
  );
  const needsAdvancedLocationFields = config.columns.some(col => 
    ['location_address', 'location_city', 'location_state'].includes(col)
  );
  const needsAdvancedEmployeeFields = config.columns.some(col => 
    ['employee_id_number', 'employee_email'].includes(col)
  );

  // Build dynamic select based on needed fields
  let selectParts = [
    'id',
    'wash_date',
    'rate_at_time_of_wash',
  ];
  
  if (needsAdvancedWashFields) {
    selectParts.push('created_at', 'comment', 'time_started', 'time_completed', 'wash_duration_minutes', 'service_type', 'customer_po_number');
  }

  // Build vehicle select
  let vehicleSelect = 'id, vehicle_number, client_id';
  if (needsAdvancedVehicleFields) {
    vehicleSelect += ', fleet_number, license_plate, make, model, year, color';
  }
  
  // Build client select within vehicle
  let clientSelect = 'client_name';
  if (needsAdvancedClientFields) {
    clientSelect += ', client_code, primary_contact_name, primary_contact_email, primary_contact_phone';
  }

  // Build location select
  let locationSelect = 'id, name';
  if (needsAdvancedLocationFields) {
    locationSelect += ', address, city, state';
  }

  // Build employee select
  let employeeSelect = 'id, name';
  if (needsAdvancedEmployeeFields) {
    employeeSelect += ', employee_id, email';
  }

  const fullSelect = `
    ${selectParts.join(', ')},
    vehicle:vehicles!inner(
      ${vehicleSelect},
      vehicle_type:vehicle_types(type_name),
      client:clients(${clientSelect})
    ),
    actual_location:locations!wash_entries_actual_location_id_fkey(${locationSelect}),
    employee:users!wash_entries_employee_id_fkey(${employeeSelect})
  `;

  let query = supabase
    .from('wash_entries')
    .select(fullSelect);

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
        // Main fields
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
        
        // Advanced wash entry fields
        case 'created_at':
          row['created_at'] = entry.created_at || '';
          break;
        case 'comment':
          row['comment'] = entry.comment || '';
          break;
        case 'time_started':
          row['time_started'] = entry.time_started || '';
          break;
        case 'time_completed':
          row['time_completed'] = entry.time_completed || '';
          break;
        case 'wash_duration_minutes':
          row['wash_duration_minutes'] = entry.wash_duration_minutes || '';
          break;
        case 'service_type':
          row['service_type'] = entry.service_type || '';
          break;
        case 'customer_po_number':
          row['customer_po_number'] = entry.customer_po_number || '';
          break;
        
        // Advanced vehicle fields
        case 'fleet_number':
          row['fleet_number'] = entry.vehicle?.fleet_number || '';
          break;
        case 'license_plate':
          row['license_plate'] = entry.vehicle?.license_plate || '';
          break;
        case 'vehicle_make':
          row['vehicle_make'] = entry.vehicle?.make || '';
          break;
        case 'vehicle_model':
          row['vehicle_model'] = entry.vehicle?.model || '';
          break;
        case 'vehicle_year':
          row['vehicle_year'] = entry.vehicle?.year || '';
          break;
        case 'vehicle_color':
          row['vehicle_color'] = entry.vehicle?.color || '';
          break;
        
        // Advanced client fields
        case 'client_code':
          row['client_code'] = entry.vehicle?.client?.client_code || '';
          break;
        case 'client_contact_name':
          row['client_contact_name'] = entry.vehicle?.client?.primary_contact_name || '';
          break;
        case 'client_contact_email':
          row['client_contact_email'] = entry.vehicle?.client?.primary_contact_email || '';
          break;
        case 'client_contact_phone':
          row['client_contact_phone'] = entry.vehicle?.client?.primary_contact_phone || '';
          break;
        
        // Advanced location fields
        case 'location_address':
          row['location_address'] = entry.actual_location?.address || '';
          break;
        case 'location_city':
          row['location_city'] = entry.actual_location?.city || '';
          break;
        case 'location_state':
          row['location_state'] = entry.actual_location?.state || '';
          break;
        
        // Advanced employee fields
        case 'employee_id_number':
          row['employee_id_number'] = entry.employee?.employee_id || '';
          break;
        case 'employee_email':
          row['employee_email'] = entry.employee?.email || '';
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
    const clientName = entry.vehicle?.client?.client_name || 'No Client Assigned';
    
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
    const employeeName = entry.employee?.name || 'No Employee Assigned';
    
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

// Build query for combined client + employee aggregate report
async function buildCombinedAggregateQuery(config: ReportConfig) {
  let query = supabase
    .from('wash_entries')
    .select(`
      id,
      wash_date,
      rate_at_time_of_wash,
      employee:users!wash_entries_employee_id_fkey(id, name),
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

  // Group by both client AND employee
  const combinedMap = new Map<string, any>();
  
  data?.forEach((entry: any) => {
    const clientName = entry.vehicle?.client?.client_name || 'No Client';
    const employeeName = entry.employee?.name || 'No Employee';
    const key = `${clientName}|${employeeName}`;
    
    if (!combinedMap.has(key)) {
      combinedMap.set(key, {
        client_name: clientName,
        employee_name: employeeName,
        total_washes: 0,
        total_revenue: 0,
        locations: new Set<string>(),
      });
    }
    
    const row = combinedMap.get(key);
    row.total_washes += 1;
    row.total_revenue += parseFloat(entry.rate_at_time_of_wash || 0);
    if (entry.actual_location?.name) {
      row.locations.add(entry.actual_location.name);
    }
  });

  // Transform to array with requested columns
  const results = Array.from(combinedMap.values()).map(item => {
    const row: any = {};
    config.columns.forEach((col) => {
      switch (col) {
        case 'client_name':
          row['client_name'] = item.client_name;
          break;
        case 'employee_name':
          row['employee_name'] = item.employee_name;
          break;
        case 'total_washes':
          row['total_washes'] = item.total_washes;
          break;
        case 'total_revenue':
          row['total_revenue'] = item.total_revenue.toFixed(2);
          break;
        case 'avg_wash_value':
          row['avg_wash_value'] = (item.total_revenue / item.total_washes).toFixed(2);
          break;
        case 'locations_serviced':
          row['locations_serviced'] = Array.from(item.locations).join(', ');
          break;
      }
    });
    return row;
  });

  // Sort by client name, then employee name
  return results.sort((a, b) => {
    const clientCompare = (a['client_name'] || '').localeCompare(b['client_name'] || '');
    if (clientCompare !== 0) return clientCompare;
    return (a['employee_name'] || '').localeCompare(b['employee_name'] || '');
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
    
    // Build aggregate summary - include the grouping field + aggregate columns
    const aggregateColumns = config.columns.filter(col => 
      UNIFIED_COLUMNS.find(c => c.id === col)?.isAggregate
    );
    
    // Determine which grouping fields to include
    const groupingFields: string[] = [];
    if (hasClientFields) groupingFields.push('client_name');
    if (hasEmployeeFields) groupingFields.push('employee_name');

    const aggregateConfig = { 
      ...config, 
      columns: [...groupingFields, ...aggregateColumns]
    };
    
    let aggregateData: any[] = [];
    
    // Choose the right query based on which grouping fields are selected
    if (hasClientFields && hasEmployeeFields) {
      // BOTH client and employee selected - use combined query
      aggregateData = await buildCombinedAggregateQuery(aggregateConfig);
    } else if (hasClientAggregates && hasClientFields) {
      aggregateData = await buildClientBillingQuery(aggregateConfig);
    } else if (hasEmployeeAggregates && hasEmployeeFields) {
      aggregateData = await buildEmployeePerformanceQuery(aggregateConfig);
    }
    
    // Combine detail and aggregate data
    // Add a separator row
    const separator: any = {};
    config.columns.forEach(col => {
      separator[col] = '';
    });
    
    // Add summary section header - use ALL columns for consistent Excel layout
    const summaryHeader: any = {};
    config.columns.forEach(col => {
      summaryHeader[col] = col === config.columns[0] ? '--- SUMMARY ---' : '';
    });
    
    // Merge aggregate data to include ALL columns (detail columns stay empty in summary)
    const expandedAggregateData = aggregateData.map(row => {
      const expandedRow: any = {};
      config.columns.forEach(col => {
        // Keep aggregate and grouping columns, empty strings for detail columns
        expandedRow[col] = row[col] !== undefined ? row[col] : '';
      });
      return expandedRow;
    });
    
    // Expand detail data to include ALL columns for consistent structure
    const expandedDetailData = detailData.map(row => {
      const expandedRow: any = {};
      config.columns.forEach(col => {
        expandedRow[col] = row[col] !== undefined ? row[col] : '';
      });
      return expandedRow;
    });
    
    return [
      ...expandedDetailData,
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
