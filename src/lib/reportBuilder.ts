import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

export type ReportType = 'wash_entries' | 'client_billing' | 'employee_performance' | 'revenue_analysis';

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

// Column definitions for wash entries report
export const WASH_ENTRIES_COLUMNS = [
  { id: 'wash_date', label: 'Date', required: true },
  { id: 'vehicle_number', label: 'Vehicle Number', required: true },
  { id: 'client_name', label: 'Client Name', required: false },
  { id: 'vehicle_type', label: 'Vehicle Type', required: false },
  { id: 'rate_per_wash', label: 'Rate ($)', required: false },
  { id: 'location_name', label: 'Location', required: false },
  { id: 'employee_name', label: 'Employee Name', required: false },
  { id: 'employee_id', label: 'Employee ID', required: false },
  { id: 'time_started', label: 'Time Started', required: false },
  { id: 'time_completed', label: 'Time Completed', required: false },
  { id: 'wash_duration_minutes', label: 'Duration (min)', required: false },
  { id: 'quality_rating', label: 'Quality Rating', required: false },
  { id: 'damage_reported', label: 'Damage Reported', required: false },
  { id: 'damage_description', label: 'Damage Description', required: false },
  { id: 'rate_override', label: 'Custom Rate', required: false },
  { id: 'final_amount', label: 'Final Amount ($)', required: false },
  { id: 'customer_po_number', label: 'Client PO Number', required: false },
];

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
      vehicle:vehicles(
        vehicle_number,
        vehicle_type:vehicle_types(type_name, rate_per_wash),
        client:clients(client_name)
      ),
      actual_location:locations(name),
      employee:users(name, employee_id)
    `);

  // Apply filters
  for (const filter of config.filters) {
    if (filter.field === 'wash_date' && filter.operator === 'between') {
      const [startDate, endDate] = resolveDateRange(filter.value);
      query = query.gte('wash_date', startDate).lte('wash_date', endDate);
    } else if (filter.field === 'client_id' && filter.operator === 'in' && Array.isArray(filter.value)) {
      // This needs to be handled differently - filter after fetch
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

  // Transform data to flat structure based on selected columns
  return data?.map((entry: any) => {
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
  }) || [];
}

// Main function to build query based on report type
export async function executeReport(config: ReportConfig) {
  switch (config.reportType) {
    case 'wash_entries':
      return buildWashEntriesQuery(config);
    default:
      throw new Error(`Report type ${config.reportType} not implemented`);
  }
}
