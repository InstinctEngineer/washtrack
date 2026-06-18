import { supabase } from '@/integrations/supabase/client';

/**
 * Resolve the applicable per-vehicle rate for a dealership location.
 * Precedence:
 *   1. Active dealership_rates row matching client + location
 *   2. Active dealership_rates row for client (location_id = null)
 *   3. system_settings.dealership_default_rate
 *   4. Hard fallback 5.25
 */
export async function resolveDealershipRate(
  clientId: string,
  locationId: string
): Promise<number> {
  // Try location-specific
  const { data: locRate } = await supabase
    .from('dealership_rates' as any)
    .select('rate_per_vehicle')
    .eq('client_id', clientId)
    .eq('location_id', locationId)
    .eq('is_active', true)
    .maybeSingle();

  if (locRate && (locRate as any).rate_per_vehicle != null) {
    return Number((locRate as any).rate_per_vehicle);
  }

  // Client-wide
  const { data: clientRate } = await supabase
    .from('dealership_rates' as any)
    .select('rate_per_vehicle')
    .eq('client_id', clientId)
    .is('location_id', null)
    .eq('is_active', true)
    .maybeSingle();

  if (clientRate && (clientRate as any).rate_per_vehicle != null) {
    return Number((clientRate as any).rate_per_vehicle);
  }

  // Global default
  const { data: setting } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'dealership_default_rate')
    .maybeSingle();

  if (setting?.setting_value) {
    const parsed = parseFloat(setting.setting_value);
    if (!Number.isNaN(parsed)) return parsed;
  }

  return 5.25;
}