import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type PayCode = {
  id: string;
  code: string;
  department: string;
  default_pay_type: string;
  description: string | null;
  is_active: boolean;
};

let cache: PayCode[] = [];
let loaded = false;
let inFlight: Promise<PayCode[]> | null = null;
const subscribers = new Set<(codes: PayCode[]) => void>();

const notify = () => subscribers.forEach(listener => listener(cache));

/** Reload the shared E code list from the database and update every subscriber. */
export const refreshPayCodes = async (): Promise<PayCode[]> => {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const { data, error } = await supabase
      .from('payroll_pay_codes')
      .select('id, code, department, default_pay_type, description, is_active')
      .order('code');
    if (!error) {
      cache = (data || []) as PayCode[];
      loaded = true;
      notify();
    }
    inFlight = null;
    return cache;
  })();
  return inFlight;
};

/** Label shown for an E code everywhere in the app. */
export const payCodeLabel = (code: PayCode) =>
  [code.code, code.department, code.description].filter(Boolean).join(' · ');

export const usePayCodes = () => {
  const [codes, setCodes] = useState<PayCode[]>(cache);
  const [loading, setLoading] = useState(!loaded);

  useEffect(() => {
    const listener = (next: PayCode[]) => {
      setCodes(next);
      setLoading(false);
    };
    subscribers.add(listener);
    if (!loaded) {
      void refreshPayCodes().finally(() => setLoading(false));
    } else {
      setCodes(cache);
      setLoading(false);
    }
    return () => {
      subscribers.delete(listener);
    };
  }, []);

  const activePayCodes = useMemo(() => codes.filter(code => code.is_active), [codes]);
  const payCodeById = useMemo(() => Object.fromEntries(codes.map(code => [code.id, code])) as Record<string, PayCode>, [codes]);

  return { payCodes: codes, activePayCodes, payCodeById, loading, refreshPayCodes };
};
