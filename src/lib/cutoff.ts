import { supabase } from '@/integrations/supabase/client';
import { UserRole } from '@/types/database';

/**
 * Get the current cutoff date from system settings
 */
export async function getCurrentCutoff(): Promise<Date | null> {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'entry_cutoff_date')
      .single();

    if (error) throw error;
    if (!data) return null;

    return new Date(data.setting_value);
  } catch (error) {
    console.error('Error fetching cutoff date:', error);
    return null;
  }
}

/**
 * Check if a given date is before the cutoff date
 */
export async function isBeforeCutoff(date: Date): Promise<boolean> {
  const cutoff = await getCurrentCutoff();
  if (!cutoff) return false;
  
  return date < cutoff;
}

/**
 * Calculate the last Saturday at 23:59:59
 */
export function getLastSaturday(): Date {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
  
  let daysToSubtract: number;
  if (dayOfWeek === 0) {
    // If today is Sunday, go back 1 day to Saturday
    daysToSubtract = 1;
  } else {
    // Otherwise, go back to previous Saturday
    daysToSubtract = dayOfWeek + 1;
  }
  
  const lastSaturday = new Date(today);
  lastSaturday.setDate(today.getDate() - daysToSubtract);
  lastSaturday.setHours(23, 59, 59, 999);
  
  return lastSaturday;
}

/**
 * Check if a user can override the cutoff date restriction
 */
export function canUserOverrideCutoff(userRole: UserRole): boolean {
  return userRole === 'admin' || userRole === 'finance';
}

/**
 * Get days until the next auto-cutoff (next Saturday)
 */
export function getDaysUntilNextCutoff(): number {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
  
  // Calculate days until next Saturday
  const daysUntilSaturday = dayOfWeek === 6 ? 7 : (6 - dayOfWeek);
  
  return daysUntilSaturday;
}

/**
 * Get the status color based on days until cutoff
 */
export function getCutoffStatusColor(cutoffDate: Date): 'green' | 'yellow' | 'red' {
  const now = new Date();
  const daysUntilCutoff = Math.ceil((cutoffDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntilCutoff <= 1) return 'red'; // 1 day or less
  if (daysUntilCutoff <= 2) return 'yellow'; // 2 days or less
  return 'green'; // More than 2 days
}

/**
 * Update the cutoff date in system settings
 */
export async function updateCutoffDate(
  newDate: Date,
  userId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('system_settings')
      .update({
        setting_value: newDate.toISOString(),
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('setting_key', 'entry_cutoff_date');

    if (error) throw error;

    // If reason provided, update the latest audit record
    if (reason) {
      const { data: auditData } = await supabase
        .from('system_settings_audit')
        .select('id')
        .eq('setting_key', 'entry_cutoff_date')
        .order('changed_at', { ascending: false })
        .limit(1)
        .single();

      if (auditData) {
        await supabase
          .from('system_settings_audit')
          .update({ change_reason: reason })
          .eq('id', auditData.id);
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating cutoff date:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Extend cutoff date by specified number of days
 */
export async function extendCutoffByDays(
  days: number,
  userId: string,
  reason?: string
): Promise<{ success: boolean; error?: string; newDate?: Date }> {
  try {
    const currentCutoff = await getCurrentCutoff();
    if (!currentCutoff) {
      return { success: false, error: 'Current cutoff date not found' };
    }

    const newDate = new Date(currentCutoff);
    newDate.setDate(newDate.getDate() + days);

    const result = await updateCutoffDate(newDate, userId, reason);
    
    if (result.success) {
      return { success: true, newDate };
    }
    
    return result;
  } catch (error) {
    console.error('Error extending cutoff date:', error);
    return { success: false, error: String(error) };
  }
}
